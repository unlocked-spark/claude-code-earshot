import { describe, expect, it } from 'vitest'
import { createRenderMemo, describeRender, isRenderLogSetting, LINE_LIMIT, parseLogArg, resolveRenderLog } from '../../hooks/lib/render-log'
import { messages } from '../../hooks/lib/messages'

const render = (component: string, props: unknown, requestId = 'r1') => describeRender({ component, requestId, props })

describe('describeRender (AC-014)', () => {
  it('summarises transcript rows with their marks', () => {
    expect(render('AssistantMessage', { text: 'Done.\nTwo files changed.', isFirstOfReply: true })).toBe('ui.render AssistantMessage r1 [first]: Done. Two files changed.')
    expect(render('AssistantMessage', { text: 'between calls', isFirstOfReply: false, isSummary: true })).toBe('ui.render AssistantMessage r1 [summary]: between calls')
    expect(render('UserMessage', { text: 'hello', origin: { kind: 'composer' }, isExpanded: false })).toBe('ui.render UserMessage r1 [composer]: hello')
    expect(render('UserMessage', { text: 'built', origin: { kind: 'task-notification' }, isExpanded: false, task: { id: 'x', status: 'completed' } })).toBe(
      'ui.render UserMessage r1 [task-notification completed]: built',
    )
  })
  it('summarises tool rows', () => {
    expect(render('ToolUse', { tool_use_id: 't', tool: 'Bash', input: { command: 'ls' }, isRunning: true, isErrored: false, isInterrupted: false })).toBe(
      'ui.render ToolUse r1 [Bash running]: {"command":"ls"}',
    )
    expect(render('ToolResult', { tool_use_id: 't', tool: 'Bash', output: { stdout: 'a\nb\n', stderr: '' }, isErrored: true })).toBe('ui.render ToolResult r1 [Bash error]: 2 lines')
    expect(render('ToolGroup', { calls: [{ tool: 'Read' }, { tool: 'Grep' }], isActive: true, isExpanded: false })).toBe('ui.render ToolGroup r1 [2 calls active]: Read Grep')
    expect(render('ToolProgress', { tool_use_id: 't', kind: 'background_hint', hint: '(ctrl+b to run in background)' })).toBe(
      'ui.render ToolProgress r1 [background_hint]: (ctrl+b to run in background)',
    )
    expect(render('CommandOutput', { command: 'cost', args: '', text: 'Total: $0.12', isErrored: false })).toBe('ui.render CommandOutput r1 [/cost]: Total: $0.12')
  })
  it('summarises the chrome around the prompt', () => {
    expect(render('Spinner', { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' })).toBe('ui.render Spinner r1 [thinking]: Sauteing…')
    expect(render('Spinner', { word: 'Sauteing', message: 'Waiting for permission', suffix: '', mode: 'tool-use' })).toBe('ui.render Spinner r1 [tool-use]: Waiting for permission')
    expect(render('TurnDuration', { word: 'Baked', durationMs: 3200 })).toBe('ui.render TurnDuration r1: Baked 3200 ms')
    expect(render('InfoNotice', { text: 'Context left until auto-compact: 12%', command: 'compact' })).toBe('ui.render InfoNotice r1: Context left until auto-compact: 12% /compact')
    expect(render('InfoNotice', { text: 'Tip', command: null })).toBe('ui.render InfoNotice r1: Tip')
    expect(render('SessionMode', { modes: ['focus', 'memory paused'] })).toBe('ui.render SessionMode r1: focus & memory paused')
    expect(render('PromptHint', { isDraft: false, isWorking: true, hint: 'esc to interrupt', tail: '12% left' })).toBe('ui.render PromptHint r1 [working]: esc to interrupt 12% left')
    expect(render('AbovePrompt', { hasSurvey: true, isWorking: false, maxRows: 8 })).toBe('ui.render AbovePrompt r1 [survey]: 8 rows')
    expect(render('Pane', { title: 'Notes', isFocused: true })).toBe('ui.render Pane r1 [focused]: Notes')
    expect(render('AskUserQuestion', { tool: 'AskUserQuestion', questions: [{}] })).toBe('ui.render AskUserQuestion r1: 1 question')
  })
  it('clips long text to one line and survives odd props', () => {
    const long = 'x'.repeat(LINE_LIMIT + 40)
    const line = render('AssistantMessage', { text: `${long}\u001b[0m` })
    expect(line.endsWith('…')).toBe(true)
    expect(line.length).toBe('ui.render AssistantMessage r1: '.length + LINE_LIMIT + 1)
    expect(render('AssistantMessage', null)).toBe('ui.render AssistantMessage r1: ')
    expect(render('Unknown', { a: 1 })).toBe('ui.render Unknown r1: {"a":1}')
  })
})

describe('createRenderMemo (AC-014)', () => {
  it('reports a line once until it changes', () => {
    const memo = createRenderMemo(3)
    expect(memo.changed('a', 'one')).toBe(true)
    expect(memo.changed('a', 'one')).toBe(false)
    expect(memo.changed('a', 'two')).toBe(true)
    expect(memo.changed('b', 'one')).toBe(true)
  })
  it('forgets the oldest instance past the limit', () => {
    const memo = createRenderMemo(2)
    memo.changed('a', '1')
    memo.changed('b', '1')
    memo.changed('c', '1')
    expect(memo.changed('a', '1')).toBe(true)
    expect(memo.changed('c', '1')).toBe(false)
  })
})

describe('log setting and command (AC-015)', () => {
  it('is on unless stored off', () => {
    expect(resolveRenderLog(undefined)).toBe(true)
    expect(resolveRenderLog({ on: false, setAt: '2026-10-11T00:00:00Z' })).toBe(false)
    expect(resolveRenderLog({ on: true, setAt: '2026-10-11T00:00:00Z' })).toBe(true)
    expect(resolveRenderLog({ on: 'no' })).toBe(true)
    expect(isRenderLogSetting({ on: false })).toBe(false)
  })
  it('reads the argument', () => {
    expect(parseLogArg('')).toBe('report')
    expect(parseLogArg(' ON ')).toBe('on')
    expect(parseLogArg('off')).toBe('off')
    expect(parseLogArg('verbose')).toBe('invalid')
  })
  it('has the reply lines', () => {
    expect(messages.logReport(false)).toBe('Render log off.')
    expect(messages.logReport(true)).toMatch(/^Render log on\./)
    expect(messages.logInvalid()).toBe('Usage: /a11y-log, /a11y-log on, or /a11y-log off.')
  })
})
