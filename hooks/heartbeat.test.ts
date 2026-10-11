import { expect, mock, test } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'
import type { EngineInterface, On, TurnCompleteInput, TurnStartInput, TurnStepChunk, TurnStepResult } from 'claude-code'

type Log = { spoken: string[]; logged: string[]; stored: { key: string; value: unknown }[] }

// A host with no screen reader running, in or out of screen reader mode, a
// mocked clock the test moves by hand, and a scripted model step.
function host(on: On, world: { modeOn: boolean; script: TurnStepChunk[] }): { log: Log; clock: MockClock } {
  const log: Log = { spoken: [], logged: [], stored: [] }
  mock.env(on, { HOME: '/Users/t' })
  on('store.set', { key: 'heartbeat' }, (_$, e, next) => {
    log.stored.push({ key: e.key, value: e.value })
    return next(e)
  })
  mock.store(on)
  const clock = mock.clock(on, { now: 1_000_000 })
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
  on('audio.play', () => ({ value: undefined }))
  on('ui.log', (_$, e) => {
    if (e.to !== 'debug') log.logged.push(e.text)
    return { value: undefined }
  })
  on('ui.notify', () => ({ value: { isSent: true as const, channel: 'terminal_bell' as const } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$: EngineInterface, e: TurnStartInput) => ({ turnId: e.turnId }))
  on('turn.complete', (_$: EngineInterface, e: TurnCompleteInput) => ({ text: e.answer }))
  on('turn.step', async function* (_$, e) {
    for (const chunk of world.script) yield chunk
    const result: TurnStepResult = { turnId: e.turnId, index: e.index, answer: 'x', toolUses: [], stopReason: 'end_turn', usage: null }
    return result
  })
  return { log, clock }
}

const start = { cwd: '/work', surface: 'terminal' as const, isInteractive: true }
const step = () => ({ turnId: 't1', index: 0, model: 'test-model', messageCount: 1 })
const complete = () => ({ answer: 'x', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' as const })
const command = (args: string) => ({ command: 'earshot-heartbeat', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } })

const SCRIPT: TurnStepChunk[] = [
  { kind: 'text', index: 0, text: 'A paragraph.' },
  { kind: 'stop', stopReason: 'end_turn', usage: null },
]

async function drain(stream: AsyncIterable<TurnStepChunk>): Promise<void> {
  const iterator = stream[Symbol.asyncIterator]()
  for (;;) {
    const item = await iterator.next()
    if (item.done) return
  }
}

test('opens the turn with a line and says every 20 seconds of silence in screen reader mode (AC-016, AC-020)', async ($, on) => {
  const { log, clock } = host(on, { modeOn: true, script: SCRIPT })
  await $.session.start(start)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await clock.advance(19_000)
  expect(log.logged).toEqual(['Starting work.'])
  await clock.advance(1_500)
  expect(log.logged).toEqual(['Starting work.', 'Still working, 20 seconds.'])
  expect(log.spoken).toEqual(['Starting work.', 'Still working, 20 seconds.'])
  await clock.advance(20_000)
  expect(log.logged).toEqual(['Starting work.', 'Still working, 20 seconds.', 'Still working, 40 seconds.'])
  // A step with text is visible output: the silence restarts at the next tick.
  await drain($.turn.step(step()))
  await clock.advance(19_500)
  expect(log.logged).toHaveLength(3)
  await clock.advance(2_000)
  expect(log.logged).toHaveLength(4)
  expect(log.logged[3]).toBe('Still working, 20 seconds.')
  // The end of the turn stops the ticks.
  await $.turn.complete(complete())
  await clock.advance(120_000)
  expect(log.logged).toHaveLength(4)
})

test('stays silent outside screen reader mode, without the start line (AC-016, AC-020)', async ($, on) => {
  const { log, clock } = host(on, { modeOn: false, script: SCRIPT })
  await $.session.start(start)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await clock.advance(60_000)
  expect(log.logged).toEqual([])
  await $.turn.complete(complete())
})

test('/earshot-heartbeat sets the interval, switches off and reports (AC-017)', async ($, on) => {
  const { log, clock } = host(on, { modeOn: true, script: SCRIPT })
  await $.session.start(start)
  expect((await $.command.run(command(''))).text).toBe('Heartbeat every 20 seconds of silence while an answer is being prepared, in screen reader mode.')
  expect((await $.command.run(command('5'))).text).toBe('Heartbeat set to every 5 seconds of silence.')
  expect(log.stored.at(-1)).toMatchObject({ key: 'heartbeat', value: { seconds: 5 } })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await clock.advance(5_500)
  expect(log.logged).toEqual(['Starting work.', 'Still working, 5 seconds.'])
  await $.turn.complete(complete())
  expect((await $.command.run(command('off'))).text).toBe('Heartbeat off.')
  expect(log.stored.at(-1)).toMatchObject({ key: 'heartbeat', value: { seconds: 0 } })
  // With the heartbeat off the turn still opens with its line (AC-020).
  await $.turn.start({ text: 'again', turnId: 't2' })
  await clock.advance(60_000)
  expect(log.logged).toEqual(['Starting work.', 'Still working, 5 seconds.', 'Starting work.'])
  await $.turn.complete({ ...complete(), turnId: 't2' })
  expect((await $.command.run(command('3'))).text).toBe('Usage: /earshot-heartbeat, /earshot-heartbeat <seconds> (5 to 600), or /earshot-heartbeat off.')
  expect((await $.command.run(command(''))).text).toBe('Heartbeat off.')
})
