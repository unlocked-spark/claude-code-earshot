import type { CommandSpec, Timer } from 'claude-code'
import { consentReducer, IDLE } from './lib/consent'
import type { ConsentEffect, ConsentEvent, ConsentState } from './lib/consent'
import { createSilence, noteVisible } from './lib/heartbeat'
import type { Silence } from './lib/heartbeat'
import { createRenderMemo } from './lib/render-log'
import type { RenderMemo } from './lib/render-log'
import { createLastResults } from './lib/tool-narration'
import type { LastResults, ToolNarration } from './lib/tool-narration'
import type { Delivery } from './lib/stream-delivery'
import type { DetectionResult, ModeState, Platform, ToolNarrationMode } from './lib/types'

// Everything the hooks share that never touches `$`: the command list, the
// session's facts and consent state, and the small state transitions. The
// loader only lets `$` reach top-level functions of the hooks module itself,
// so the functions that take `$` stay in register.ts.

export const COMMANDS: readonly CommandSpec[] = [
  { name: 'a11y-on', description: 'Enable Claude Code screen reader mode from the next start' },
  { name: 'a11y-off', description: 'Disable Claude Code screen reader mode from the next start' },
  { name: 'a11y-status', description: 'Report the detected screen reader and the screen reader mode state' },
  { name: 'a11y-stream', description: 'Whole answer delivery: show each answer at once instead of streaming it', argumentHint: '[on|off|auto]' },
  { name: 'a11y-tools', description: 'Tool narration: hide tool rows, show one line per call, or leave them to Claude Code', argumentHint: '[off|brief|full|auto]' },
  { name: 'a11y-last', description: 'Print the full text of a recent tool result', argumentHint: '[n]' },
  { name: 'a11y-log', description: 'Render log: write every drawn component to the debug log', argumentHint: '[on|off]' },
  { name: 'a11y-heartbeat', description: 'Say every N seconds of silence that work goes on', argumentHint: '[seconds|off]' },
]

export const LAST_RESULTS_KEPT = 5

export const RENDER_MEMO_KEPT = 200

export type Facts = {
  platform?: Platform
  detection?: DetectionResult
  mode?: ModeState
  modVersion: string
  settingsPath?: string
  backedUp: boolean
  delivery: Delivery
  tools: ToolNarration
  renderLog: boolean
  heartbeatSeconds: number
}

export type Turn = { active: boolean; silence: Silence; timer: Timer | undefined }

export const session: { consent: ConsentState; timer: Timer | undefined; facts: Facts; lastResults: LastResults; renderMemo: RenderMemo; turn: Turn } = {
  consent: IDLE,
  timer: undefined,
  lastResults: createLastResults(LAST_RESULTS_KEPT),
  renderMemo: createRenderMemo(RENDER_MEMO_KEPT),
  turn: { active: false, silence: createSilence(0), timer: undefined },
  facts: {
    modVersion: '0.0.0',
    backedUp: false,
    delivery: { mode: 'live', source: 'mode' },
    tools: { mode: 'full', source: 'mode' },
    renderLog: true,
    heartbeatSeconds: 0,
  },
}

export function cancelTimer(): void {
  session.timer?.cancel()
  session.timer = undefined
}

export function step(event: ConsentEvent): ConsentEffect {
  const next = consentReducer(session.consent, event)
  session.consent = next.state
  return next.effect
}

export function toolNarration(): ToolNarrationMode {
  return session.facts.tools.mode
}

// A row the screen reader can read appeared on the main transcript.
export function markVisible(): void {
  if (session.turn.active) session.turn.silence = noteVisible(session.turn.silence)
}

export function endTurn(): void {
  session.turn.timer?.cancel()
  session.turn = { active: false, silence: session.turn.silence, timer: undefined }
}
