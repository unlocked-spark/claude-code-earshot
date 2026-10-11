import { countLines, textOfResult } from './tool-narration'
import type { RenderLogSetting } from './types'

// One line per drawn component for the debug log, so a session with
// `claude --debug` shows what the terminal put in front of the screen reader:
// notices, hints, spinner words, mode labels, and the transcript rows.
// Nothing here reaches the screen; the hook sends the line to the debug sink.

export const LINE_LIMIT = 160

export type RenderMemo = {
  // True when `line` differs from the last line noted under `key`.
  changed(key: string, line: string): boolean
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g

function clip(text: string): string {
  const line = text.replace(/\s*\r?\n\s*/g, ' ').replace(CONTROL, '').replace(/\s+/g, ' ').trim()
  return line.length > LINE_LIMIT ? `${line.slice(0, LINE_LIMIT).trimEnd()}…` : line
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function str(props: Record<string, unknown>, name: string): string {
  const value = props[name]
  return typeof value === 'string' ? value : ''
}

function num(props: Record<string, unknown>, name: string): number | undefined {
  const value = props[name]
  return typeof value === 'number' ? value : undefined
}

function flags(props: Record<string, unknown>, names: Record<string, string>): string[] {
  return Object.entries(names)
    .filter(([prop]) => props[prop] === true)
    .map(([, word]) => word)
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

type Summary = { marks: string[]; text: string }

function summarize(component: string, p: Record<string, unknown>): Summary {
  switch (component) {
    case 'AssistantMessage':
      return { marks: flags(p, { isFirstOfReply: 'first', isSummary: 'summary' }), text: str(p, 'text') }
    case 'UserMessage': {
      const origin = record(p['origin'])
      const from = record(p['from'])
      const task = record(p['task'])
      const marks = [str(origin, 'kind'), str(from, 'name'), str(task, 'status')].filter((m) => m.length > 0)
      return { marks, text: str(p, 'text') }
    }
    case 'ToolUse':
      return {
        marks: [str(p, 'tool'), ...flags(p, { isRunning: 'running', isErrored: 'error', isInterrupted: 'interrupted' })],
        text: json(p['input']),
      }
    case 'ToolResult': {
      const lines = countLines(textOfResult(str(p, 'tool'), p['output']))
      return { marks: [str(p, 'tool'), ...flags(p, { isErrored: 'error' })], text: `${lines} ${lines === 1 ? 'line' : 'lines'}` }
    }
    case 'ToolGroup': {
      const calls = Array.isArray(p['calls']) ? (p['calls'] as unknown[]) : []
      const tools = calls.map((call) => str(record(call), 'tool')).join(' ')
      return { marks: [`${calls.length} calls`, ...flags(p, { isActive: 'active', isExpanded: 'expanded' })], text: tools }
    }
    case 'CommandOutput':
      return { marks: [`/${str(p, 'command')} ${str(p, 'args')}`.trim(), ...flags(p, { isErrored: 'error' })], text: str(p, 'text') }
    case 'ToolProgress':
      return { marks: [str(p, 'kind')], text: str(p, 'hint') }
    case 'Spinner': {
      const message = typeof p['message'] === 'string' ? p['message'] : str(p, 'word')
      return { marks: [str(p, 'mode')], text: `${message}${str(p, 'suffix')}` }
    }
    case 'TurnDuration':
      return { marks: [], text: `${str(p, 'word')} ${num(p, 'durationMs') ?? 0} ms` }
    case 'InfoNotice': {
      const command = typeof p['command'] === 'string' ? ` /${p['command']}` : ''
      return { marks: [], text: `${str(p, 'text')}${command}` }
    }
    case 'SessionMode': {
      const modes = Array.isArray(p['modes']) ? (p['modes'] as unknown[]).filter((m): m is string => typeof m === 'string') : []
      return { marks: [], text: modes.join(' & ') }
    }
    case 'PromptHint': {
      const tail = typeof p['tail'] === 'string' ? ` ${p['tail']}` : ''
      return { marks: flags(p, { isDraft: 'draft', isWorking: 'working' }), text: `${str(p, 'hint')}${tail}` }
    }
    case 'AbovePrompt':
      return { marks: flags(p, { hasSurvey: 'survey', isWorking: 'working' }), text: `${num(p, 'maxRows') ?? 0} rows` }
    case 'Pane':
      return { marks: flags(p, { isFocused: 'focused' }), text: str(p, 'title') }
    case 'AskUserQuestion': {
      const questions = Array.isArray(p['questions']) ? (p['questions'] as unknown[]).length : 0
      return { marks: [], text: `${questions} ${questions === 1 ? 'question' : 'questions'}` }
    }
    default:
      return { marks: [], text: json(p) }
  }
}

// `ui.render <Component> <instance> [<marks>]: <text>`, one line, clipped.
export function describeRender(e: { component: string; requestId: string; props: unknown }): string {
  const { marks, text } = summarize(e.component, record(e.props))
  const head = marks.length > 0 ? ` [${marks.join(' ')}]` : ''
  return `ui.render ${e.component} ${e.requestId}${head}: ${clip(text)}`
}

// The same row is drawn several times per change (start, running, done, a
// scroll); only a line that differs from the last one for its instance is
// worth a log entry.
export function createRenderMemo(limit: number): RenderMemo {
  const last = new Map<string, string>()
  return {
    changed(key, line) {
      if (last.get(key) === line) return false
      last.delete(key)
      last.set(key, line)
      if (last.size > limit) {
        const oldest = last.keys().next().value
        if (oldest !== undefined) last.delete(oldest)
      }
      return true
    },
  }
}

export function isRenderLogSetting(value: unknown): value is RenderLogSetting {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return typeof r['on'] === 'boolean' && typeof r['setAt'] === 'string'
}

// The log is on until switched off: it costs nothing on screen and shows up
// only in the debug log.
export function resolveRenderLog(stored: unknown): boolean {
  return isRenderLogSetting(stored) ? stored.on : true
}

export type LogArg = 'report' | 'on' | 'off' | 'invalid'

export function parseLogArg(args: string): LogArg {
  const word = args.trim().toLowerCase()
  if (word === '') return 'report'
  if (word === 'on' || word === 'off') return word
  return 'invalid'
}
