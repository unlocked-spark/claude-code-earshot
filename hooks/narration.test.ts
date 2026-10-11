import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

type Log = { spoken: string[]; logged: string[]; debug: string[] }

// A host with no screen reader running, in or out of screen reader mode.
function host(on: On, world: { modeOn: boolean }): Log {
  const log: Log = { spoken: [], logged: [], debug: [] }
  mock.env(on, { HOME: '/Users/t' })
  mock.store(on)
  mock.clock(on)
  on('process.run', (_$, e) => {
    const ok = (exitCode: number, stdout: string) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv[0] === 'uname') return ok(0, 'Darwin\n')
    if (e.argv[0] === 'pgrep') return ok(1, '')
    throw new Error(`unexpected command ${e.argv.join(' ')}`)
  })
  on('settings.read', () => ({ value: world.modeOn ? { axScreenReader: true } : {} }))
  on('fs.exists', () => ({ value: false }))
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('plugin.json')) return { value: '{ "name": "earshot", "version": "0.1.0" }' }
    throw new Error(`no such file ${e.path}`)
  })
  on('audio.speak', (_$, e) => {
    log.spoken.push(e.text)
    return { value: { via: 'system' as const } }
  })
  on('ui.log', (_$, e) => {
    if (e.to === 'debug') log.debug.push(e.text)
    else log.logged.push(e.text)
    return { value: undefined }
  })
  on('ui.notify', () => ({ value: { isSent: true as const, channel: 'terminal_bell' as const } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  // The engine's own drawing of a row, for the cases the mod leaves alone.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, null, 'engine row') as RenderElement
  })
  return log
}

const start = { cwd: '/work', surface: 'terminal' as const, isInteractive: true }
const flags = { isRunning: false, isErrored: false, isInterrupted: false }
const bashUse = (id: string, extra: Partial<typeof flags> = {}) => ({
  plugin: 'earshot',
  surface: 'terminal' as const,
  component: 'ToolUse' as const,
  props: { tool_use_id: id, tool: 'Bash', input: { command: 'ls -la && grep -ril x .', description: 'List files and search for x' }, ...flags, ...extra },
})
const bashResult = (id: string, stdout: string, isErrored = false) => ({
  plugin: 'earshot',
  surface: 'terminal' as const,
  component: 'ToolResult' as const,
  props: { tool_use_id: id, tool: 'Bash', output: { stdout, stderr: '', interrupted: false }, isErrored },
})
const notice = (text: string, command: string | null) => ({
  plugin: 'earshot',
  surface: 'terminal' as const,
  component: 'InfoNotice' as const,
  props: { text, command },
})
const command = (name: string, args = '') => ({ command: name, args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } })

test('draws nothing for tool rows by default in screen reader mode (AC-012)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
  expect((await $.command.run(command('a11y-tools'))).text).toBe('Tool narration off (whole answer delivery).')
  const use = await $.ui.mount(bashUse('t0'))
  expect(await use.findAll({ type: 'Text' })).toHaveLength(0)
  await use.unmount()
  const result = await $.ui.mount(bashResult('t0', 'a\nb\n'))
  expect(await result.findAll({ type: 'Text' })).toHaveLength(0)
  await result.unmount()
  // The result is still kept for /a11y-last.
  expect((await $.command.run(command('a11y-last'))).text).toBe('Result of: List files and search for x\na\nb\n')
})

test('draws the call row from the Bash description in brief narration (AC-001, AC-002)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
  expect((await $.command.run(command('a11y-tools', 'brief'))).text).toBe('Tool narration brief (forced). One line per tool call and a count per result.')
  const ui = await $.ui.mount(bashUse('t1'))
  const row = await ui.find({ type: 'Text', text: /^tool/ })
  expect(row?.text).toBe('tool: List files and search for x')
  const all = await ui.findAll({ type: 'Text' })
  expect(all).toHaveLength(1)
  await ui.unmount()
})

test('labels running and errored calls (AC-001)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
  await $.command.run(command('a11y-tools', 'brief'))
  const running = await $.ui.mount(bashUse('t2', { isRunning: true }))
  expect((await running.find({ type: 'Text' }))?.text).toBe('tool running: List files and search for x')
  await running.unmount()
  const errored = await $.ui.mount(bashUse('t3', { isErrored: true }))
  expect((await errored.find({ type: 'Text' }))?.text).toBe('tool error: List files and search for x')
  await errored.unmount()
})

test('leaves AskUserQuestion rows and live delivery to the engine (AC-005, AC-007)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
  const ask = await $.ui.mount({ ...bashUse('t4'), props: { ...bashUse('t4').props, tool: 'AskUserQuestion', input: { questions: [] } } })
  expect(await ask.find({ type: 'Text', text: /^tool: / })).toBeUndefined()
  expect((await ask.find({ type: 'Text' }))?.text).toBe('engine row')
  await ask.unmount()
})

test('draws the engine row outside buffered delivery (AC-007)', async ($, on) => {
  host(on, { modeOn: false })
  await $.session.start(start)
  expect((await $.command.run(command('a11y-tools'))).text).toBe('Tool narration full (whole answer delivery is off).')
  const ui = await $.ui.mount(bashUse('t5'))
  expect(await ui.find({ type: 'Text', text: 'tool: List files and search for x' })).toBeUndefined()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine row')
  await ui.unmount()
})

test('/a11y-tools full and auto switch the rows and the store (AC-012, AC-013)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
  expect((await $.command.run(command('a11y-tools', 'full'))).text).toBe('Tool narration full (forced). Tool rows are drawn by Claude Code itself.')
  const full = await $.ui.mount(bashUse('t8'))
  expect((await full.find({ type: 'Text' }))?.text).toBe('engine row')
  await full.unmount()
  expect((await $.command.run(command('a11y-tools', 'auto'))).text).toBe('Override removed. Tool narration off (whole answer delivery).')
  const off = await $.ui.mount(bashUse('t9'))
  expect(await off.findAll({ type: 'Text' })).toHaveLength(0)
  await off.unmount()
  expect((await $.command.run(command('a11y-tools', 'loud'))).text).toBe('Usage: /a11y-tools, /a11y-tools off, /a11y-tools brief, /a11y-tools full, or /a11y-tools auto.')
  // A forced mode survives a change of delivery; a mode-derived one follows it.
  await $.command.run(command('a11y-tools', 'brief'))
  await $.command.run(command('a11y-stream', 'off'))
  expect((await $.command.run(command('a11y-tools'))).text).toBe('Tool narration brief (forced).')
  await $.command.run(command('a11y-tools', 'auto'))
  expect((await $.command.run(command('a11y-tools'))).text).toBe('Tool narration full (whole answer delivery is off).')
})

test('draws the result as a count and keeps the text for /a11y-last (AC-004, AC-006)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
  await $.command.run(command('a11y-tools', 'brief'))
  expect((await $.command.run(command('a11y-last'))).text).toBe('No tool result stored yet.')
  const use = await $.ui.mount(bashUse('t6'))
  await use.unmount()
  const result = await $.ui.mount(bashResult('t6', 'AGENTS.md\ncatalog\nCHANGELOG.md\n'))
  expect((await result.find({ type: 'Text' }))?.text).toBe('result: 3 lines')
  expect(await result.findAll({ type: 'Text' })).toHaveLength(1)
  await result.unmount()
  const errored = await $.ui.mount(bashResult('t7', 'ls: no such file\n', true))
  expect((await errored.find({ type: 'Text' }))?.text).toBe('error: 1 line')
  await errored.unmount()
  expect((await $.command.run(command('a11y-last'))).text).toBe('Result of: Bash\nls: no such file\n')
  expect((await $.command.run(command('a11y-last', '2'))).text).toBe('Result of: List files and search for x\nAGENTS.md\ncatalog\nCHANGELOG.md\n')
  expect((await $.command.run(command('a11y-last', '3'))).text).toBe('Only 2 results are kept; ask for 1 to 2.')
  expect((await $.command.run(command('a11y-last', 'x'))).text).toBe('Usage: /a11y-last or /a11y-last <n>.')
})

test('writes every drawn component to the debug log until /a11y-log off (AC-014, AC-015)', async ($, on) => {
  const log = host(on, { modeOn: true })
  await $.session.start(start)
  expect((await $.command.run(command('a11y-log'))).text).toBe('Render log on. Every drawn component is written to the debug log of a session started with claude --debug.')
  const use = await $.ui.mount(bashUse('t10', { isRunning: true }))
  await use.unmount()
  const useLine = log.debug.find((line) => line.startsWith('ui.render ToolUse '))
  expect(useLine).toMatch(/^ui\.render ToolUse \S+ \[Bash running\]: \{"command":"ls -la && grep -ril x \."/)
  // A notice the mod leaves to the engine is logged all the same.
  const shown = await $.ui.mount(notice('Context left until auto-compact: 12%', 'compact'))
  expect((await shown.find({ type: 'Text' }))?.text).toBe('engine row')
  await shown.unmount()
  expect(log.debug.some((line) => /^ui\.render InfoNotice \S+: Context left until auto-compact: 12% \/compact$/.test(line))).toBe(true)
  expect(log.logged).toHaveLength(0)
  // Off: nothing more is written, and the choice is stored.
  expect((await $.command.run(command('a11y-log', 'off'))).text).toBe('Render log off.')
  const before = log.debug.length
  const quiet = await $.ui.mount(notice('Tip: use /compact', null))
  await quiet.unmount()
  expect(log.debug).toHaveLength(before)
  expect((await $.command.run(command('a11y-log', 'maybe'))).text).toBe('Usage: /a11y-log, /a11y-log on, or /a11y-log off.')
  expect((await $.command.run(command('a11y-log', 'on'))).text).toBe('Render log on. Every drawn component is written to the debug log of a session started with claude --debug.')
})
