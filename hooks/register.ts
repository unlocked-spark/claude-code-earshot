import type { CommandSpec, EngineInterface, Register, Timer, TurnStepChunk, TurnStepResult } from 'claude-code'
import { ANSWER_TIMEOUT_MS, consentReducer, IDLE } from './lib/consent'
import type { ConsentEffect, ConsentEvent, ConsentState } from './lib/consent'
import { detect, platformFromEnv } from './lib/detect'
import { messages } from './lib/messages'
import { decide, isStoredConsent, resolveModeState } from './lib/mode-state'
import { applyAxSetting, settingsPath } from './lib/settings-file'
import type { ApplyResult } from './lib/settings-file'
import { createHold, parseStreamArg, resolveDelivery } from './lib/stream-delivery'
import type { Delivery } from './lib/stream-delivery'
import type { DeliveryMode, DetectionResult, ModeState, Platform, SettingsLike, StoredConsent } from './lib/types'

// The only module that touches the mod API. Decisions live in ./lib and take
// plain values, so Vitest covers them; this file turns them into $ calls.
// The loader only lets `$` reach functions declared at the top of this file,
// so every helper is a top-level function and the session's facts live in
// one module-level record (reset on every reload, like the rest of the module).

const CONSENT_KEY = 'screenReaderConsent'
const STREAM_KEY = 'streamDelivery'

const COMMANDS: readonly CommandSpec[] = [
  { name: 'a11y-on', description: 'Enable Claude Code screen reader mode from the next start' },
  { name: 'a11y-off', description: 'Disable Claude Code screen reader mode from the next start' },
  { name: 'a11y-status', description: 'Report the detected screen reader and the screen reader mode state' },
  { name: 'a11y-stream', description: 'Whole answer delivery: show each answer at once instead of streaming it', argumentHint: '[on|off|auto]' },
]

type Facts = {
  platform?: Platform
  detection?: DetectionResult
  mode?: ModeState
  modVersion: string
  settingsPath?: string
  backedUp: boolean
  delivery: Delivery
}

type ChangeOutcome = { ok: true; applied: Extract<ApplyResult, { ok: true }> } | { ok: false; text: string }

const session: { consent: ConsentState; timer: Timer | undefined; facts: Facts } = {
  consent: IDLE,
  timer: undefined,
  facts: { modVersion: '0.0.0', backedUp: false, delivery: { mode: 'live', source: 'mode' } },
}

// Speech and transcript always carry the same line (AC-012). Speech is not
// awaited: it resolves only once the utterance ends.
function say($: EngineInterface, text: string): void {
  $.ui.log(text)
  void $.audio.speak(text).catch(() => undefined)
}

// The native channel rings the terminal bell when the user chose that channel.
function ring($: EngineInterface, text: string): void {
  void $.ui.notify(text).catch(() => undefined)
}

function cancelTimer(): void {
  session.timer?.cancel()
  session.timer = undefined
}

function step(event: ConsentEvent): ConsentEffect {
  const next = consentReducer(session.consent, event)
  session.consent = next.state
  return next.effect
}

async function readOwnVersion($: EngineInterface): Promise<string> {
  try {
    const manifest = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

async function platformOf($: EngineInterface): Promise<Platform> {
  const os = await $.env.get('OS')
  if (os === 'Windows_NT') return 'win32'
  let uname: string | undefined
  try {
    uname = (await $.process.run(['uname', '-s'], { timeoutMs: 2000 })).stdout
  } catch {
    uname = undefined
  }
  return platformFromEnv(os, uname)
}

async function loadMode($: EngineInterface): Promise<ModeState> {
  const envValue = await $.env.get('CLAUDE_AX_SCREEN_READER')
  const userSettings = (await $.settings.read({ source: 'user' })) as SettingsLike
  const mergedSettings = (await $.settings.read()) as SettingsLike
  return resolveModeState({ envValue, userSettings, mergedSettings })
}

async function storedConsent($: EngineInterface): Promise<StoredConsent | undefined> {
  const value = await $.store.get(CONSENT_KEY)
  return isStoredConsent(value) ? value : undefined
}

async function changeSetting($: EngineInterface, value: true | 'remove'): Promise<ChangeOutcome> {
  const path = session.facts.settingsPath
  if (path === undefined) return { ok: false, text: messages.error('no-home', undefined) }
  let before: string | undefined
  try {
    before = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
  } catch {
    return { ok: false, text: messages.error('write-failed', path) }
  }
  const applied = applyAxSetting(before, value)
  if (!applied.ok) return { ok: false, text: messages.error(applied.reason, path) }
  if (!applied.changed) return { ok: true, applied }
  try {
    if (before !== undefined && !session.facts.backedUp) {
      await $.fs.write(`${path}.a11y-backup`, before)
      session.facts.backedUp = true
    }
    await $.fs.write(path, applied.text)
    if ((await $.fs.read(path)) !== applied.text) return { ok: false, text: messages.error('verify-mismatch', path) }
  } catch {
    return { ok: false, text: messages.error('write-failed', path) }
  }
  return { ok: true, applied }
}

async function enable($: EngineInterface): Promise<string> {
  const outcome = await changeSetting($, true)
  if (!outcome.ok) return outcome.text
  await $.store.delete(CONSENT_KEY)
  const mode = session.facts.mode
  if (mode !== undefined) session.facts.mode = { ...mode, userSetting: true }
  return messages.enabled()
}

async function disable($: EngineInterface): Promise<string> {
  const outcome = await changeSetting($, 'remove')
  if (!outcome.ok) return outcome.text
  const mode = session.facts.mode
  if (!outcome.applied.hadKey) {
    return mode?.on === true && mode.source === 'settings-other' ? messages.offElsewhere() : messages.offNothing()
  }
  if (mode !== undefined) session.facts.mode = { ...mode, userSetting: undefined }
  return messages.offDone()
}

async function decline($: EngineInterface): Promise<string> {
  const declinedAt = new Date(await $.clock.now()).toISOString()
  await $.store.set(CONSENT_KEY, { declined: true, declinedAt, modVersion: session.facts.modVersion } satisfies StoredConsent)
  return messages.declined()
}

// Runs the effect the state machine named and returns the line it produced.
async function settle($: EngineInterface, effect: ConsentEffect): Promise<string | undefined> {
  if (effect === 'none' || effect === 'passthrough') return undefined
  cancelTimer()
  const text = effect === 'enable' ? await enable($) : effect === 'decline' ? await decline($) : messages.withdrawn()
  say($, text)
  if (effect === 'enable') ring($, text)
  return text
}

async function registerCommands($: EngineInterface): Promise<void> {
  for (const spec of COMMANDS) {
    try {
      await $.command.register(spec)
    } catch {
      // The name is taken; the rest of the mod still works.
    }
  }
}

async function startSession($: EngineInterface): Promise<void> {
  const facts = session.facts
  facts.modVersion = await readOwnVersion($)
  facts.platform = await platformOf($)
  facts.settingsPath = settingsPath(facts.platform, { HOME: await $.env.get('HOME'), USERPROFILE: await $.env.get('USERPROFILE') })
  facts.mode = await loadMode($)
  facts.delivery = resolveDelivery({ modeOn: facts.mode.on, override: await $.store.get(STREAM_KEY) })
  facts.detection = await detect({ platform: facts.platform, run: (argv, init) => $.process.run(argv, init), now: () => Date.now() })
  const decision = decide({ mode: facts.mode, detection: facts.detection, consent: await $.store.get(CONSENT_KEY), modVersion: facts.modVersion })
  if (decision.action !== 'ask') return
  step({ type: 'ask', reader: decision.reader, at: Date.now() })
  const question = messages.question(decision.reader)
  say($, question)
  ring($, question)
  session.timer = $.clock.after(ANSWER_TIMEOUT_MS, () => {
    void settle($, step({ type: 'timeout' }))
  })
}

// A command's returned text prints in the transcript, so it is only spoken here.
function speak($: EngineInterface, text: string): { text: string } {
  void $.audio.speak(text).catch(() => undefined)
  return { text }
}

async function onCommand($: EngineInterface): Promise<{ text: string }> {
  cancelTimer()
  step({ type: 'command' })
  return speak($, await enable($))
}

async function offCommand($: EngineInterface): Promise<{ text: string }> {
  cancelTimer()
  step({ type: 'command' })
  return speak($, await disable($))
}

async function setDelivery($: EngineInterface, mode: DeliveryMode): Promise<{ text: string }> {
  const setAt = new Date(await $.clock.now()).toISOString()
  await $.store.set(STREAM_KEY, { mode, setAt })
  session.facts.delivery = { mode, source: 'override' }
  return speak($, messages.streamSet(mode))
}

async function streamCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  const arg = parseStreamArg(args)
  if (arg === 'invalid') return speak($, messages.streamInvalid())
  if (arg === 'on') return setDelivery($, 'buffered')
  if (arg === 'off') return setDelivery($, 'live')
  if (arg === 'auto') {
    await $.store.delete(STREAM_KEY)
    session.facts.delivery = resolveDelivery({ modeOn: session.facts.mode?.on === true, override: undefined })
    return speak($, `${messages.streamAuto()} ${messages.streamReport(session.facts.delivery)}`)
  }
  return speak($, messages.streamReport(session.facts.delivery))
}

async function statusCommand($: EngineInterface): Promise<{ text: string }> {
  const { detection, mode } = session.facts
  return speak($, messages.status({ detection, mode, consent: await storedConsent($) }))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await registerCommands($)
    if (e.isInteractive) await startSession($)
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    if (session.consent.status !== 'pending') return next(e)
    const effect = step({ type: 'prompt', text: e.text })
    if (effect === 'passthrough') {
      cancelTimer()
      $.ui.log(messages.withdrawn())
      return next(e)
    }
    const text = await settle($, effect)
    return { drop: text ?? 'Answered.' }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'a11y-on' }, ($) => onCommand($))
  on('command.run', { command: 'a11y-off' }, ($) => offCommand($))
  on('command.run', { command: 'a11y-status' }, ($) => statusCommand($))
  on('command.run', { command: 'a11y-stream' }, ($, e) => streamCommand($, e.args))

  // Whole answer delivery: in buffered mode the step's chunks are held until
  // the stream beneath ends, then yielded at once, so the screen reader reads
  // the answer as one block. Thinking is dropped from the display; the engine
  // keeps its own signed thinking block. Subagent steps stream live.
  on('turn.step', async function* ($, e, next) {
    if (session.facts.delivery.mode !== 'buffered' || e.agentId !== undefined) return yield* next(e)
    const hold = createHold<TurnStepChunk>()
    // Iterated by hand: the stream's return value is the step's result, which
    // a for-await loop would discard.
    const iterator = next(e)[Symbol.asyncIterator]()
    let result: TurnStepResult | undefined
    let failure: unknown
    let failed = false
    try {
      for (;;) {
        const item = await iterator.next()
        if (item.done) {
          result = item.value
          break
        }
        hold.take(item.value)
      }
    } catch (caught) {
      failure = caught
      failed = true
    }
    const held = hold.release()
    for (const chunk of held.chunks) yield chunk
    if (failed) throw failure
    if (held.hasText && !next.signal.aborted) ring($, 'Answer ready.')
    return result
  }).catch(async function* ($, e, next) {
    return yield* next(e)
  })
}
