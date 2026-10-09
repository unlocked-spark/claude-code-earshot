import { expect, mock, test } from 'claude-code/testing'
import type { On, TurnStepChunk, TurnStepResult } from 'claude-code'

type Log = { spoken: string[]; logged: string[]; notified: number; yielded: number; stored: { key: string; value: unknown }[]; deleted: string[] }

// A host with no screen reader running (so session.start stays silent), in or
// out of screen reader mode, with an optional stored override, and a scripted
// model response played by the bottom turn.step hook.
function host(on: On, world: { modeOn: boolean; override?: { mode: 'buffered' | 'live'; setAt: string }; script: TurnStepChunk[]; answer: string }): Log {
  const log: Log = { spoken: [], logged: [], notified: 0, yielded: 0, stored: [], deleted: [] }
  mock.env(on, { HOME: '/Users/t' })
  // A matcher keeps these distinct from mock.store's own hooks; registered first, they run above it.
  on('store.set', { key: 'streamDelivery' }, (_$, e, next) => {
    log.stored.push({ key: e.key, value: e.value })
    return next(e)
  })
  on('store.delete', { key: 'streamDelivery' }, (_$, e, next) => {
    log.deleted.push(e.key)
    return next(e)
  })
  mock.store(on, world.override ? { streamDelivery: world.override } : {})
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
  on('ui.notify', () => {
    log.notified += 1
    return { value: { isSent: true as const, channel: 'terminal_bell' as const } }
  })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.step', async function* (_$, e) {
    for (const chunk of world.script) {
      log.yielded += 1
      yield chunk
    }
    const result: TurnStepResult = { turnId: e.turnId, index: e.index, answer: world.answer, toolUses: [], stopReason: 'end_turn', usage: null }
    return result
  })
  return log
}

const start = { cwd: '/work', surface: 'terminal' as const, isInteractive: true }
const step = (agentId?: string) => ({ turnId: 't1', index: 0, model: 'test-model', messageCount: 1, ...(agentId === undefined ? {} : { agentId }) })
const command = (args: string) => ({ command: 'a11y-stream', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } })

// No engine chunks: a test's bottom hook cannot fabricate them (the kit refuses a ref it never pulled).
const SCRIPT: TurnStepChunk[] = [
  { kind: 'thinking', index: 0, text: 'let me think' },
  { kind: 'text', index: 1, text: 'First paragraph.\n\n' },
  { kind: 'text', index: 1, text: 'Second paragraph.' },
  { kind: 'tool', index: 2, id: 'toolu_1', name: 'Read' },
  { kind: 'input', index: 2, json: '{"file_path":"/x"}' },
  { kind: 'stop', stopReason: 'tool_use', usage: null },
]

async function collect(stream: AsyncIterable<TurnStepChunk>, log: Log): Promise<{ kinds: string[]; firstSeenAfter: number; text: string }> {
  const kinds: string[] = []
  let firstSeenAfter = -1
  let text = ''
  for await (const chunk of stream) {
    if (firstSeenAfter < 0) firstSeenAfter = log.yielded
    kinds.push(chunk.kind)
    if (chunk.kind === 'text') text += chunk.text
  }
  return { kinds, firstSeenAfter, text }
}

test('holds the whole step, drops thinking, keeps order and rings once (AC-001 to AC-005)', async ($, on) => {
  const log = host(on, { modeOn: true, script: SCRIPT, answer: 'First paragraph.\n\nSecond paragraph.' })
  await $.session.start(start)
  const stream = $.turn.step(step())
  const seen = await collect(stream, log)
  expect(seen.firstSeenAfter).toBe(SCRIPT.length)
  expect(seen.kinds).toEqual(['text', 'text', 'tool', 'input', 'stop'])
  expect(seen.text).toBe('First paragraph.\n\nSecond paragraph.')
  expect(log.notified).toBe(1)
  const result = await stream.result
  expect(result.answer).toBe('First paragraph.\n\nSecond paragraph.')
})

test('streams live outside screen reader mode, thinking included, no bell (AC-006)', async ($, on) => {
  const log = host(on, { modeOn: false, script: SCRIPT, answer: 'x' })
  await $.session.start(start)
  const seen = await collect($.turn.step(step()), log)
  expect(seen.firstSeenAfter).toBe(1)
  expect(seen.kinds).toEqual(['thinking', 'text', 'text', 'tool', 'input', 'stop'])
  expect(log.notified).toBe(0)
})

test('never holds a subagent step (AC-008)', async ($, on) => {
  const log = host(on, { modeOn: true, script: SCRIPT, answer: 'x' })
  await $.session.start(start)
  const seen = await collect($.turn.step(step('agent-1')), log)
  expect(seen.firstSeenAfter).toBe(1)
  expect(seen.kinds).toContain('thinking')
  expect(log.notified).toBe(0)
})

test('rings no bell for a step without text (AC-005)', async ($, on) => {
  const toolsOnly: TurnStepChunk[] = [
    { kind: 'tool', index: 0, id: 'toolu_1', name: 'Bash' },
    { kind: 'input', index: 0, json: '{"command":"ls"}' },
    { kind: 'stop', stopReason: 'tool_use', usage: null },
  ]
  const log = host(on, { modeOn: true, script: toolsOnly, answer: '' })
  await $.session.start(start)
  const seen = await collect($.turn.step(step()), log)
  expect(seen.firstSeenAfter).toBe(toolsOnly.length)
  expect(seen.kinds).toEqual(['tool', 'input', 'stop'])
  expect(log.notified).toBe(0)
})

test('a stored override forces buffering outside the mode and survives sessions (AC-007, TC-006)', async ($, on) => {
  const log = host(on, { modeOn: false, override: { mode: 'buffered', setAt: '2026-10-09T20:00:00.000Z' }, script: SCRIPT, answer: 'x' })
  await $.session.start(start)
  const report = await $.command.run(command(''))
  expect(report.text).toBe('Whole answer delivery on (forced).')
  const seen = await collect($.turn.step(step()), log)
  expect(seen.firstSeenAfter).toBe(SCRIPT.length)
})

test('/a11y-stream on, off and auto change the mode and the store (AC-007)', async ($, on) => {
  const log = host(on, { modeOn: false, script: SCRIPT, answer: 'x' })
  await $.session.start(start)
  expect((await $.command.run(command('on'))).text).toBe('Whole answer delivery on (forced). Answers appear whole; thinking is hidden.')
  expect(log.stored.at(-1)).toMatchObject({ key: 'streamDelivery', value: { mode: 'buffered' } })
  expect((await collect($.turn.step(step()), log)).firstSeenAfter).toBe(SCRIPT.length)
  log.yielded = 0
  expect((await $.command.run(command('off'))).text).toBe('Whole answer delivery off (forced). Answers stream live.')
  expect((await collect($.turn.step(step()), log)).firstSeenAfter).toBe(1)
  expect((await $.command.run(command('auto'))).text).toBe('Override removed. Whole answer delivery off (screen reader mode is off).')
  expect(log.deleted).toContain('streamDelivery')
  expect((await $.command.run(command('maybe'))).text).toBe('Usage: /a11y-stream, /a11y-stream on, /a11y-stream off, or /a11y-stream auto.')
  expect(log.spoken.length).toBeGreaterThanOrEqual(4)
})
