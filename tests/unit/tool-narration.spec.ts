import { describe, expect, it } from 'vitest'
import {
  countLines,
  createLastResults,
  describeToolUse,
  isToolsOverride,
  labelFor,
  parseLastArg,
  parseToolsArg,
  resolveToolNarration,
  resultLine,
  SUMMARY_LIMIT,
  summaryLine,
  textOfResult,
} from '../../hooks/lib/tool-narration'
import { messages } from '../../hooks/lib/messages'

const done = { isRunning: false, isErrored: false, isInterrupted: false }

describe('describeToolUse (AC-002, AC-003)', () => {
  it('uses the Bash description when present', () => {
    expect(describeToolUse('Bash', { command: 'ls -la && grep -ril x .', description: 'List files and search for x' })).toBe('List files and search for x')
  })
  it('falls back to the command, cut at 60 characters with newlines collapsed', () => {
    const command = 'cd /Users/lukasz/projects && for d in a b c; do\n  echo "$d"\ndone && ls -la --color=never /tmp'
    const summary = describeToolUse('Bash', { command })
    expect(summary).toBe('cd /Users/lukasz/projects && for d in a b c; do echo "$d" do…')
    expect(summary.length).toBe(SUMMARY_LIMIT + 1)
    expect(summary).not.toContain('\n')
  })
  it('keeps a short command whole', () => {
    expect(describeToolUse('Bash', { command: 'ls', description: '   ' })).toBe('ls')
  })
  it('names files for reads and edits', () => {
    expect(describeToolUse('Read', { file_path: '/a/b/README.md' })).toBe('Read README.md')
    expect(describeToolUse('Write', { file_path: '/a/b/out.txt', content: 'x' })).toBe('Write out.txt')
    expect(describeToolUse('Edit', { file_path: 'src/mod.ts' })).toBe('Edit mod.ts')
    expect(describeToolUse('NotebookEdit', { notebook_path: '/n/book.ipynb' })).toBe('NotebookEdit book.ipynb')
  })
  it('names patterns for searches', () => {
    expect(describeToolUse('Grep', { pattern: 'TODO', path: '.' })).toBe('Grep TODO')
    expect(describeToolUse('Glob', { pattern: '**/*.ts' })).toBe('Glob **/*.ts')
  })
  it('describes agents, fetches and searches', () => {
    expect(describeToolUse('Agent', { description: 'Review the diff', prompt: '...' })).toBe('Agent: Review the diff')
    expect(describeToolUse('Agent', { prompt: '...' })).toBe('Agent')
    expect(describeToolUse('WebFetch', { url: 'https://code.claude.com/docs/en/x.md' })).toBe('WebFetch code.claude.com')
    expect(describeToolUse('WebSearch', { query: 'nvda controller client' })).toBe('WebSearch nvda controller client')
  })
  it('reads MCP tool names as server and tool', () => {
    expect(describeToolUse('mcp__github__create_issue', {})).toBe('github create_issue')
  })
  it('falls back to the tool name', () => {
    expect(describeToolUse('AskUserQuestion', { questions: [] })).toBe('AskUserQuestion')
    expect(describeToolUse('Bash', null)).toBe('Bash')
    expect(describeToolUse('Read', 'garbage')).toBe('Read')
  })
})

describe('labelFor and summaryLine (AC-001, AC-009)', () => {
  it('labels by state with interrupted over errored over running', () => {
    expect(labelFor(done)).toBe('tool')
    expect(labelFor({ ...done, isRunning: true })).toBe('tool running')
    expect(labelFor({ ...done, isErrored: true, isRunning: true })).toBe('tool error')
    expect(labelFor({ ...done, isInterrupted: true, isErrored: true })).toBe('tool interrupted')
  })
  it('joins label and summary into one plain line', () => {
    const line = summaryLine({ ...done, isErrored: true }, 'Bash', { command: 'cat x', description: 'Read x' })
    expect(line).toBe('tool error: Read x')
    // eslint-disable-next-line no-control-regex
    expect(line).not.toMatch(/[\n\r\t\u001b]/)
  })
  it('strips control characters and newlines from a description', () => {
    expect(summaryLine(done, 'Bash', { command: 'x', description: 'first\nsecond\u001b[0m' })).toBe('tool: first second')
  })
})

describe('textOfResult and countLines (AC-004)', () => {
  it('joins Bash stdout and stderr', () => {
    expect(textOfResult('Bash', { stdout: 'a\nb\n', stderr: 'warn', interrupted: false })).toBe('a\nb\nwarn')
    expect(textOfResult('Bash', { stdout: 'a\n', stderr: '', interrupted: false })).toBe('a\n')
  })
  it('reads known text fields', () => {
    expect(textOfResult('Read', { file: { filePath: '/x', content: 'l1\nl2' } })).toBe('l1\nl2')
    expect(textOfResult('Grep', { content: 'm1\nm2\nm3' })).toBe('m1\nm2\nm3')
    expect(textOfResult('X', { text: 't' })).toBe('t')
    expect(textOfResult('X', 'plain')).toBe('plain')
  })
  it('falls back to JSON and to empty', () => {
    expect(textOfResult('X', { a: 1 })).toBe('{"a":1}')
    expect(textOfResult('X', undefined)).toBe('')
    expect(textOfResult('X', null)).toBe('')
  })
  it('counts lines without counting a trailing newline twice', () => {
    expect(countLines('')).toBe(0)
    expect(countLines('one')).toBe(1)
    expect(countLines('a\nb\n')).toBe(2)
    expect(countLines('a\r\nb')).toBe(2)
  })
  it('writes the result line', () => {
    expect(resultLine(false, 292)).toBe('result: 292 lines')
    expect(resultLine(false, 1)).toBe('result: 1 line')
    expect(resultLine(true, 3)).toBe('error: 3 lines')
    expect(resultLine(false, 0)).toBe('result: 0 lines')
  })
})

describe('createLastResults (AC-006)', () => {
  it('keeps the newest first and uses the noted summary', () => {
    const last = createLastResults(5)
    last.note('t1', 'Read x')
    last.put({ id: 't1', text: 'one', fallbackSummary: 'Bash' })
    last.put({ id: 't2', text: 'two', fallbackSummary: 'Read' })
    expect(last.size()).toBe(2)
    expect(last.get(1)).toEqual({ id: 't2', summary: 'Read', text: 'two' })
    expect(last.get(2)).toEqual({ id: 't1', summary: 'Read x', text: 'one' })
  })
  it('replaces an entry drawn again with the same id', () => {
    const last = createLastResults(5)
    last.put({ id: 't1', text: 'partial', fallbackSummary: 'Bash' })
    last.put({ id: 't1', text: 'full', fallbackSummary: 'Bash' })
    expect(last.size()).toBe(1)
    expect(last.get(1)?.text).toBe('full')
  })
  it('drops the oldest past the limit', () => {
    const last = createLastResults(2)
    for (const id of ['a', 'b', 'c']) last.put({ id, text: id, fallbackSummary: id })
    expect(last.size()).toBe(2)
    expect(last.get(1)?.id).toBe('c')
    expect(last.get(2)?.id).toBe('b')
    expect(last.get(3)).toBeUndefined()
  })
  it('answers nothing when empty or out of range', () => {
    const last = createLastResults(5)
    expect(last.get(1)).toBeUndefined()
    expect(last.get(0)).toBeUndefined()
  })
})

describe('parseLastArg and messages (AC-006)', () => {
  it('reads the argument', () => {
    expect(parseLastArg('')).toBe(1)
    expect(parseLastArg(' 2 ')).toBe(2)
    expect(parseLastArg('0')).toBe('invalid')
    expect(parseLastArg('two')).toBe('invalid')
  })
  it('has the reply lines', () => {
    expect(messages.lastHeader('Read x')).toBe('Result of: Read x')
    expect(messages.lastNone()).toBe('No tool result stored yet.')
    expect(messages.lastOutOfRange(2)).toBe('Only 2 results are kept; ask for 1 to 2.')
    expect(messages.lastOutOfRange(1)).toBe('Only 1 result is kept; ask for 1.')
    expect(messages.lastInvalid()).toBe('Usage: /earshot-last or /earshot-last <n>.')
  })
})

describe('resolveToolNarration and parseToolsArg (AC-012, AC-013)', () => {
  it('hides the rows under buffered delivery and leaves them under live delivery', () => {
    expect(resolveToolNarration({ delivery: 'buffered', override: undefined })).toEqual({ mode: 'off', source: 'mode' })
    expect(resolveToolNarration({ delivery: 'live', override: undefined })).toEqual({ mode: 'full', source: 'mode' })
  })
  it('lets a stored override win', () => {
    const override = { mode: 'brief', setAt: '2026-10-11T00:00:00Z' }
    expect(resolveToolNarration({ delivery: 'live', override })).toEqual({ mode: 'brief', source: 'override' })
    expect(resolveToolNarration({ delivery: 'buffered', override: { mode: 'loud', setAt: 'x' } })).toEqual({ mode: 'off', source: 'mode' })
    expect(isToolsOverride(override)).toBe(true)
    expect(isToolsOverride({ mode: 'off' })).toBe(false)
    expect(isToolsOverride(null)).toBe(false)
  })
  it('reads the argument', () => {
    expect(parseToolsArg('')).toBe('report')
    expect(parseToolsArg(' Brief ')).toBe('brief')
    expect(parseToolsArg('off')).toBe('off')
    expect(parseToolsArg('full')).toBe('full')
    expect(parseToolsArg('auto')).toBe('auto')
    expect(parseToolsArg('on')).toBe('invalid')
  })
  it('has the reply lines', () => {
    expect(messages.toolsReport({ mode: 'off', source: 'mode' })).toBe('Tool narration off (whole answer delivery).')
    expect(messages.toolsReport({ mode: 'full', source: 'mode' })).toBe('Tool narration full (whole answer delivery is off).')
    expect(messages.toolsReport({ mode: 'brief', source: 'override' })).toBe('Tool narration brief (forced).')
    expect(messages.toolsSet('off')).toMatch(/^Tool narration off \(forced\)\./)
    expect(messages.toolsSet('brief')).toMatch(/^Tool narration brief \(forced\)\./)
    expect(messages.toolsSet('full')).toMatch(/^Tool narration full \(forced\)\./)
    expect(messages.toolsAuto()).toBe('Override removed.')
    expect(messages.toolsInvalid()).toBe('Usage: /earshot-tools, /earshot-tools off, /earshot-tools brief, /earshot-tools full, or /earshot-tools auto.')
  })
})
