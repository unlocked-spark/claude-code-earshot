import type { EngineInterface, Register, RenderElement, TurnStepChunk, TurnStepResult } from 'claude-code'
import { ANSWER_TIMEOUT_MS } from './lib/consent'
import type { ConsentEffect } from './lib/consent'
import { detect, platformFromEnv } from './lib/detect'
import { createSilence, HEARTBEAT_TICK_MS, parseHeartbeatArg, resolveHeartbeat, tick } from './lib/heartbeat'
import { resolveLanguage } from './lib/language'
import { messages, setLanguage } from './lib/messages'
import { decide, isStoredConsent, resolveModeState } from './lib/mode-state'
import { describeRender, parseLogArg, resolveRenderLog } from './lib/render-log'
import { applyAxSetting, settingsPath } from './lib/settings-file'
import type { ApplyResult } from './lib/settings-file'
import { coalesceText, createHold, parseStreamArg, resolveDelivery } from './lib/stream-delivery'
import { countLines, describeToolUse, parseLastArg, parseToolsArg, resolveToolNarration, resultLine, summaryLine, textOfResult } from './lib/tool-narration'
import type { DeliveryMode, HeartbeatSetting, ModeState, Platform, RenderLogSetting, SettingsLike, StoredConsent, ToolNarrationMode, ToolsOverride } from './lib/types'
import { cancelTimer, COMMANDS, endTurn, markVisible, session, step, toolNarration } from './state'

// The only module that touches the mod API. Decisions live in ./lib and take
// plain values, so Vitest covers them; this file turns them into $ calls.
// The loader only lets `$` reach functions declared at the top of this file,
// so every helper is a top-level function and the session's facts live in
// one module-level record (reset on every reload, like the rest of the module).

const CONSENT_KEY = 'screenReaderConsent'
const STREAM_KEY = 'streamDelivery'
const TOOLS_KEY = 'toolNarration'
const LOG_KEY = 'renderLog'
const HEARTBEAT_KEY = 'heartbeat'

type ChangeOutcome = { ok: true; applied: Extract<ApplyResult, { ok: true }> } | { ok: false; text: string }

// Speech and transcript always carry the same line (AC-012). Speech is not
// awaited: it resolves only once the utterance ends.
function say($: EngineInterface, text: string): void {
  $.ui.log(text)
  void $.audio.speak(text).catch(() => undefined)
}

const READY_EARCON = 'assets/earcons/answer-ready.wav'

// The native channel rings the terminal bell when the user chose one. When
// nothing delivers it (no channel for this terminal, or disabled), a short
// earcon plays instead, independent of the terminal's bell and of speech.
function ring($: EngineInterface, text: string): void {
  void $.ui
    .notify(text)
    .then((sent) => {
      $.ui.log(`notify: ${sent.isSent ? sent.channel : sent.reason}`, { to: 'debug' })
      return sent.isSent ? undefined : $.audio.play({ asset: READY_EARCON })
    })
    .catch(() => undefined)
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

// The mod's lines follow the system's display language (English when it is
// one the mod has no lines for), settled before the commands are listed so
// their descriptions match.
async function chooseLanguage($: EngineInterface): Promise<void> {
  const platform = await platformOf($)
  session.facts.platform = platform
  const env = { LC_ALL: await $.env.get('LC_ALL'), LC_MESSAGES: await $.env.get('LC_MESSAGES'), LANG: await $.env.get('LANG') }
  setLanguage(await resolveLanguage({ platform, env, run: (argv, init) => $.process.run(argv, init) }))
}

async function registerCommands($: EngineInterface): Promise<void> {
  for (const spec of COMMANDS) {
    try {
      await $.command.register({ ...spec, description: messages.commandDescriptions[spec.name] ?? spec.description })
    } catch {
      // The name is taken; the rest of the mod still works.
    }
  }
}

async function startSession($: EngineInterface): Promise<void> {
  const facts = session.facts
  facts.modVersion = await readOwnVersion($)
  facts.platform ??= await platformOf($)
  facts.settingsPath = settingsPath(facts.platform, { HOME: await $.env.get('HOME'), USERPROFILE: await $.env.get('USERPROFILE') })
  facts.mode = await loadMode($)
  facts.delivery = resolveDelivery({ modeOn: facts.mode.on, override: await $.store.get(STREAM_KEY) })
  await refreshTools($)
  facts.renderLog = resolveRenderLog(await $.store.get(LOG_KEY))
  facts.heartbeatSeconds = resolveHeartbeat(await $.store.get(HEARTBEAT_KEY))
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

// Tool narration follows the delivery unless /earshot-tools forced a mode, so
// every change of delivery recomputes it.
async function refreshTools($: EngineInterface): Promise<void> {
  session.facts.tools = resolveToolNarration({ delivery: session.facts.delivery.mode, override: await $.store.get(TOOLS_KEY) })
}

async function setDelivery($: EngineInterface, mode: DeliveryMode): Promise<{ text: string }> {
  const setAt = new Date(await $.clock.now()).toISOString()
  await $.store.set(STREAM_KEY, { mode, setAt })
  session.facts.delivery = { mode, source: 'override' }
  await refreshTools($)
  return speak($, messages.streamSet(mode))
}

async function setTools($: EngineInterface, mode: ToolNarrationMode): Promise<{ text: string }> {
  const setAt = new Date(await $.clock.now()).toISOString()
  await $.store.set(TOOLS_KEY, { mode, setAt } satisfies ToolsOverride)
  session.facts.tools = { mode, source: 'override' }
  return speak($, messages.toolsSet(mode))
}

async function toolsCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  const arg = parseToolsArg(args)
  if (arg === 'invalid') return speak($, messages.toolsInvalid())
  if (arg === 'report') return speak($, messages.toolsReport(session.facts.tools))
  if (arg === 'auto') {
    await $.store.delete(TOOLS_KEY)
    await refreshTools($)
    return speak($, `${messages.toolsAuto()} ${messages.toolsReport(session.facts.tools)}`)
  }
  return setTools($, arg)
}

// Heartbeat: while a turn runs in screen reader mode, a tick each second
// compares the rows the hooks counted with the clock, and says every N
// seconds of silence that work goes on. The line is printed and spoken like
// every other line of the mod; it does not count as output of its own.
async function startTurn($: EngineInterface): Promise<void> {
  endTurn()
  session.turn = { active: true, silence: createSilence(await $.clock.now()), timer: undefined }
  if (session.facts.heartbeatSeconds === 0 || session.facts.delivery.mode !== 'buffered') return
  session.turn.timer = $.clock.every(HEARTBEAT_TICK_MS, () => {
    void beat($)
  })
}

async function beat($: EngineInterface): Promise<void> {
  if (!session.turn.active) return
  const now = await $.clock.now()
  if (!session.turn.active) return
  const { state, announce } = tick(session.turn.silence, now, session.facts.heartbeatSeconds)
  session.turn.silence = state
  if (announce !== undefined) say($, messages.heartbeat(announce))
}

async function heartbeatCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  const arg = parseHeartbeatArg(args)
  if (arg === 'invalid') return speak($, messages.heartbeatInvalid())
  if (arg === 'report') return speak($, messages.heartbeatReport(session.facts.heartbeatSeconds))
  const seconds = arg === 'off' ? 0 : arg
  const setAt = new Date(await $.clock.now()).toISOString()
  await $.store.set(HEARTBEAT_KEY, { seconds, setAt } satisfies HeartbeatSetting)
  session.facts.heartbeatSeconds = seconds
  return speak($, messages.heartbeatSet(seconds))
}

async function logCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  const arg = parseLogArg(args)
  if (arg === 'invalid') return speak($, messages.logInvalid())
  if (arg !== 'report') {
    const setAt = new Date(await $.clock.now()).toISOString()
    await $.store.set(LOG_KEY, { on: arg === 'on', setAt } satisfies RenderLogSetting)
    session.facts.renderLog = arg === 'on'
  }
  return speak($, messages.logReport(session.facts.renderLog))
}

async function streamCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  const arg = parseStreamArg(args)
  if (arg === 'invalid') return speak($, messages.streamInvalid())
  if (arg === 'on') return setDelivery($, 'buffered')
  if (arg === 'off') return setDelivery($, 'live')
  if (arg === 'auto') {
    await $.store.delete(STREAM_KEY)
    session.facts.delivery = resolveDelivery({ modeOn: session.facts.mode?.on === true, override: undefined })
    await refreshTools($)
    return speak($, `${messages.streamAuto()} ${messages.streamReport(session.facts.delivery)}`)
  }
  return speak($, messages.streamReport(session.facts.delivery))
}

function lastCommand($: EngineInterface, args: string): { text: string } {
  const n = parseLastArg(args)
  if (n === 'invalid') return speak($, messages.lastInvalid())
  const kept = session.lastResults.size()
  if (kept === 0) return speak($, messages.lastNone())
  const entry = session.lastResults.get(n)
  if (entry === undefined) return speak($, messages.lastOutOfRange(kept))
  const header = messages.lastHeader(entry.summary)
  void $.audio.speak(header).catch(() => undefined)
  return { text: `${header}\n${entry.text}` }
}

async function statusCommand($: EngineInterface): Promise<{ text: string }> {
  const { detection, mode } = session.facts
  return speak($, messages.status({ detection, mode, consent: await storedConsent($) }))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await chooseLanguage($)
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
    return { drop: text ?? messages.answered() }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'earshot-on' }, ($) => onCommand($))
  on('command.run', { command: 'earshot-off' }, ($) => offCommand($))
  on('command.run', { command: 'earshot-status' }, ($) => statusCommand($))
  on('command.run', { command: 'earshot-stream' }, ($, e) => streamCommand($, e.args))
  on('command.run', { command: 'earshot-tools' }, ($, e) => toolsCommand($, e.args))
  on('command.run', { command: 'earshot-last' }, ($, e) => lastCommand($, e.args))
  on('command.run', { command: 'earshot-log' }, ($, e) => logCommand($, e.args))
  on('command.run', { command: 'earshot-heartbeat' }, ($, e) => heartbeatCommand($, e.args))

  on('turn.start', async ($, e, next) => {
    await startTurn($)
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) endTurn()
    return next(e)
  })

  // Render log: one debug line per drawn terminal component, when its line
  // changed, so `claude --debug` shows what the screen reader was given.
  // Registered first, so it sees every row before the hooks below answer.
  on('ui.render', ($, e, next) => {
    if (session.facts.renderLog && e.surface === 'terminal') {
      const line = describeRender(e)
      if (session.renderMemo.changed(`${e.component}:${e.requestId}`, line)) $.ui.log(line, { to: 'debug' })
    }
    return next(e)
  })

  // Tool narration: by default in screen reader mode the tool rows draw
  // nothing, so the transcript carries the answers alone; `brief` draws one
  // line per call from the model's own description and a count per result;
  // `full` leaves the engine's rows. The result text is kept for /earshot-last
  // in every mode but full. Dialogs and other surfaces are left to the engine.
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
    const mode = toolNarration()
    if (e.surface === 'terminal' && mode !== 'off') markVisible()
    if (e.surface !== 'terminal' || mode === 'full' || e.props.tool === 'AskUserQuestion') return next(e)
    session.lastResults.note(e.props.tool_use_id, describeToolUse(e.props.tool, e.props.input))
    const { Box, Text } = $.ui.resolve(e)
    if (mode === 'off') return h(Box, null) as RenderElement
    return h(Text, null, summaryLine(e.props, e.props.tool, e.props.input)) as RenderElement
  })

  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    const mode = toolNarration()
    if (e.surface !== 'terminal' || mode === 'full' || e.props.tool === 'AskUserQuestion') return next(e)
    const text = textOfResult(e.props.tool, e.props.output)
    session.lastResults.put({ id: e.props.tool_use_id, text, fallbackSummary: e.props.tool })
    const { Box, Text } = $.ui.resolve(e)
    if (mode === 'off') return h(Box, null) as RenderElement
    return h(Text, null, resultLine(e.props.isErrored, countLines(text))) as RenderElement
  })

  // A folded run of reads and searches draws one count line and, while a call
  // runs, that call's command under it. The same modes apply as to ToolUse;
  // an expanded group draws as ToolUse rows, which the hook above handles.
  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => {
    const mode = toolNarration()
    if (e.surface !== 'terminal' || mode === 'full' || e.props.isExpanded) return next(e)
    for (const call of e.props.calls) {
      if (call.tool_use_id === undefined) continue
      session.lastResults.note(call.tool_use_id, describeToolUse(call.tool, call.input))
      if (call.output !== undefined) session.lastResults.put({ id: call.tool_use_id, text: textOfResult(call.tool, call.output), fallbackSummary: call.tool })
    }
    const { Box, Text } = $.ui.resolve(e)
    if (mode === 'off') return h(Box, null) as RenderElement
    return h(Box, { flexDirection: 'column' }, ...e.props.calls.map((call) => h(Text, null, summaryLine(call, call.tool, call.input)))) as RenderElement
  })

  // The run-in-background pill under a running call, `(ctrl+b to run in
  // background)`, is read aloud each time a command runs a few seconds. It
  // belongs to the tool row, so it is drawn only when the rows are (`full`).
  on('ui.render', { component: 'ToolProgress' }, ($, e, next) => {
    if (e.surface !== 'terminal' || toolNarration() === 'full') return next(e)
    return next({ ...e, props: { ...e.props, hint: '' } })
  })

  // The spinner line's word changes every turn (`Sauteing...`) and the screen
  // reader reads each one. Under buffered delivery it draws nothing; the
  // heartbeat says that work goes on.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (e.surface !== 'terminal' || session.facts.delivery.mode !== 'buffered') return next(e)
    const { Box } = $.ui.resolve(e)
    return h(Box, null) as RenderElement
  })

  // Whole answer delivery: in buffered mode the step's chunks are held until
  // the stream beneath ends, then yielded at once, so the screen reader reads
  // the answer as one block. Thinking is dropped from the display; the engine
  // keeps its own signed thinking block. Subagent steps stream live.
  on('turn.step', async function* ($, e, next) {
    // Iterated by hand: the stream's return value is the step's result, which
    // a for-await loop would discard.
    const iterator = next(e)[Symbol.asyncIterator]()
    if (session.facts.delivery.mode !== 'buffered' || e.agentId !== undefined) {
      // Live: every chunk passes as it comes; the main loop's text counts as
      // visible output for the heartbeat.
      for (;;) {
        const item = await iterator.next()
        if (item.done) return item.value
        if (e.agentId === undefined && item.value.kind === 'text') markVisible()
        yield item.value
      }
    }
    const hold = createHold<TurnStepChunk>()
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
    // One chunk per text block: the terminal paints the answer in one frame,
    // so the screen reader is not interrupted after the first piece.
    for (const chunk of coalesceText(held.chunks)) yield chunk
    if (held.hasText) markVisible()
    if (failed) throw failure
    if (held.hasText && !next.signal.aborted) ring($, messages.answerReady())
    return result
  }).catch(async function* ($, e, next) {
    return yield* next(e)
  })
}
