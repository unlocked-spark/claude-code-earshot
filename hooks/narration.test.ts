import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

type Log = { spoken: string[]; logged: string[] }

// A host with no screen reader running, in or out of screen reader mode.
function host(on: On, world: { modeOn: boolean }): Log {
  const log: Log = { spoken: [], logged: [] }
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
    if (e.path.endsWith('plugin.json')) return { value: '{ "name": "a11y-companion", "version": "0.1.0" }' }
    throw new Error(`no such file ${e.path}`)
  })
  on('audio.speak', (_$, e) => {
    log.spoken.push(e.text)
    return { value: { via: 'system' as const } }
  })
  on('ui.log', (_$, e) => {
    log.logged.push(e.text)
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
  plugin: 'a11y-companion',
  surface: 'terminal' as const,
  component: 'ToolUse' as const,
  props: { tool_use_id: id, tool: 'Bash', input: { command: 'ls -la && grep -ril x .', description: 'List files and search for x' }, ...flags, ...extra },
})
const bashResult = (id: string, stdout: string, isErrored = false) => ({
  plugin: 'a11y-companion',
  surface: 'terminal' as const,
  component: 'ToolResult' as const,
  props: { tool_use_id: id, tool: 'Bash', output: { stdout, stderr: '', interrupted: false }, isErrored },
})
const command = (args: string) => ({ command: 'a11y-last', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } })

test('draws the call row from the Bash description in buffered delivery (AC-001, AC-002)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
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
  const ui = await $.ui.mount(bashUse('t5'))
  expect(await ui.find({ type: 'Text', text: 'tool: List files and search for x' })).toBeUndefined()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine row')
  await ui.unmount()
})

test('draws the result as a count and keeps the text for /a11y-last (AC-004, AC-006)', async ($, on) => {
  host(on, { modeOn: true })
  await $.session.start(start)
  expect((await $.command.run(command(''))).text).toBe('No tool result stored yet.')
  const use = await $.ui.mount(bashUse('t6'))
  await use.unmount()
  const result = await $.ui.mount(bashResult('t6', 'AGENTS.md\ncatalog\nCHANGELOG.md\n'))
  expect((await result.find({ type: 'Text' }))?.text).toBe('result: 3 lines')
  expect(await result.findAll({ type: 'Text' })).toHaveLength(1)
  await result.unmount()
  const errored = await $.ui.mount(bashResult('t7', 'ls: no such file\n', true))
  expect((await errored.find({ type: 'Text' }))?.text).toBe('error: 1 line')
  await errored.unmount()
  expect((await $.command.run(command(''))).text).toBe('Result of: Bash\nls: no such file\n')
  expect((await $.command.run(command('2'))).text).toBe('Result of: List files and search for x\nAGENTS.md\ncatalog\nCHANGELOG.md\n')
  expect((await $.command.run(command('3'))).text).toBe('Only 2 results are kept; ask for 1 to 2.')
  expect((await $.command.run(command('x'))).text).toBe('Usage: /a11y-last or /a11y-last <n>.')
})
