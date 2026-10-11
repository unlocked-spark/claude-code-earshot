import type { DeliveryMode, DeliverySource, LastResultEntry, ToolFlags, ToolLabel, ToolNarrationMode, ToolsOverride } from './types'

// One line per tool call and one count per result, from what the model
// already wrote: a screen reader hears the work, not shell syntax or dumps.

export const SUMMARY_LIMIT = 60

export type ToolNarration = { mode: ToolNarrationMode; source: DeliverySource }

export type ToolsArg = 'report' | ToolNarrationMode | 'auto' | 'invalid'

export function isToolsOverride(value: unknown): value is ToolsOverride {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const mode = record['mode']
  return (mode === 'off' || mode === 'brief' || mode === 'full') && typeof record['setAt'] === 'string'
}

// An override from /a11y-tools wins. Otherwise whole answer delivery decides:
// buffered (screen reader mode) hides the tool rows, so the transcript carries
// the answers alone; live delivery leaves the engine's own rows.
export function resolveToolNarration(args: { delivery: DeliveryMode; override: unknown }): ToolNarration {
  if (isToolsOverride(args.override)) return { mode: args.override.mode, source: 'override' }
  return { mode: args.delivery === 'buffered' ? 'off' : 'full', source: 'mode' }
}

export function parseToolsArg(args: string): ToolsArg {
  const word = args.trim().toLowerCase()
  if (word === '') return 'report'
  if (word === 'off' || word === 'brief' || word === 'full' || word === 'auto') return word
  return 'invalid'
}

export type LastResults = {
  note(id: string, summary: string): void
  put(entry: { id: string; text: string; fallbackSummary: string }): void
  get(n: number): LastResultEntry | undefined
  size(): number
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g

function oneLine(text: string): string {
  return text.replace(ANSI, '').replace(/\s*\r?\n\s*/g, ' ').replace(CONTROL, '').replace(/\s+/g, ' ').trim()
}

function field(input: unknown, name: string): string | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const value = (input as Record<string, unknown>)[name]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function describeToolUse(tool: string, input: unknown): string {
  const mcp = tool.split('__')
  if (mcp[0] === 'mcp' && mcp.length >= 3) return `${mcp[1]} ${mcp.slice(2).join('__')}`
  switch (tool) {
    case 'Bash': {
      const description = field(input, 'description')
      if (description !== undefined) return oneLine(description)
      const command = field(input, 'command')
      if (command === undefined) return tool
      const line = oneLine(command)
      return line.length > SUMMARY_LIMIT ? `${line.slice(0, SUMMARY_LIMIT).trimEnd()}…` : line
    }
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit': {
      const path = field(input, 'file_path')
      return path === undefined ? tool : `${tool} ${basename(path)}`
    }
    case 'NotebookEdit': {
      const path = field(input, 'notebook_path')
      return path === undefined ? tool : `${tool} ${basename(path)}`
    }
    case 'Grep':
    case 'Glob': {
      const pattern = field(input, 'pattern')
      return pattern === undefined ? tool : `${tool} ${oneLine(pattern)}`
    }
    case 'Agent': {
      const description = field(input, 'description')
      return description === undefined ? tool : `Agent: ${oneLine(description)}`
    }
    case 'WebFetch': {
      const url = field(input, 'url')
      return url === undefined ? tool : `WebFetch ${hostOf(url)}`
    }
    case 'WebSearch': {
      const query = field(input, 'query')
      return query === undefined ? tool : `WebSearch ${oneLine(query)}`
    }
    default:
      return tool
  }
}

export function labelFor(flags: ToolFlags): ToolLabel {
  if (flags.isInterrupted) return 'tool interrupted'
  if (flags.isErrored) return 'tool error'
  if (flags.isRunning) return 'tool running'
  return 'tool'
}

export function summaryLine(flags: ToolFlags, tool: string, input: unknown): string {
  return `${labelFor(flags)}: ${oneLine(describeToolUse(tool, input))}`
}

export function textOfResult(tool: string, output: unknown): string {
  if (output === undefined || output === null) return ''
  if (typeof output === 'string') return output
  if (typeof output !== 'object') return String(output)
  const record = output as Record<string, unknown>
  if (typeof record['stdout'] === 'string' || typeof record['stderr'] === 'string') {
    const stdout = typeof record['stdout'] === 'string' ? record['stdout'] : ''
    const stderr = typeof record['stderr'] === 'string' ? record['stderr'] : ''
    if (stderr.length === 0) return stdout
    return stdout.length === 0 || stdout.endsWith('\n') ? `${stdout}${stderr}` : `${stdout}\n${stderr}`
  }
  const file = record['file']
  if (typeof file === 'object' && file !== null && typeof (file as Record<string, unknown>)['content'] === 'string') {
    return (file as Record<string, string>)['content'] as string
  }
  if (typeof record['content'] === 'string') return record['content']
  if (typeof record['text'] === 'string') return record['text']
  return JSON.stringify(output)
}

export function countLines(text: string): number {
  if (text.length === 0) return 0
  const trimmed = text.endsWith('\r\n') ? text.slice(0, -2) : text.endsWith('\n') ? text.slice(0, -1) : text
  return trimmed.split(/\r?\n/).length
}

export function resultLine(isErrored: boolean, lines: number): string {
  return `${isErrored ? 'error' : 'result'}: ${lines} ${lines === 1 ? 'line' : 'lines'}`
}

export function parseLastArg(args: string): number | 'invalid' {
  const word = args.trim()
  if (word === '') return 1
  if (!/^\d+$/.test(word)) return 'invalid'
  const n = Number(word)
  return n >= 1 ? n : 'invalid'
}

export function createLastResults(limit: number): LastResults {
  const entries: LastResultEntry[] = []
  const notes = new Map<string, string>()
  return {
    note(id, summary) {
      notes.set(id, summary)
      if (notes.size > 50) {
        const oldest = notes.keys().next().value
        if (oldest !== undefined) notes.delete(oldest)
      }
    },
    put({ id, text, fallbackSummary }) {
      const at = entries.findIndex((entry) => entry.id === id)
      if (at >= 0) entries.splice(at, 1)
      entries.unshift({ id, summary: notes.get(id) ?? fallbackSummary, text })
      if (entries.length > limit) entries.length = limit
    },
    get(n) {
      return n >= 1 ? entries[n - 1] : undefined
    },
    size() {
      return entries.length
    },
  }
}
