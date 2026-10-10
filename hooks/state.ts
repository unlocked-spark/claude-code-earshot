import type { CommandSpec, Timer } from 'claude-code'
import { consentReducer, IDLE } from './lib/consent'
import type { ConsentEffect, ConsentEvent, ConsentState } from './lib/consent'
import { createLastResults } from './lib/tool-narration'
import type { LastResults } from './lib/tool-narration'
import type { Delivery } from './lib/stream-delivery'
import type { DetectionResult, ModeState, Platform } from './lib/types'

// Everything the hooks share that never touches `$`: the command list, the
// session's facts and consent state, and the small state transitions. The
// loader only lets `$` reach top-level functions of the hooks module itself,
// so the functions that take `$` stay in register.ts.

export const COMMANDS: readonly CommandSpec[] = [
  { name: 'a11y-on', description: 'Enable Claude Code screen reader mode from the next start' },
  { name: 'a11y-off', description: 'Disable Claude Code screen reader mode from the next start' },
  { name: 'a11y-status', description: 'Report the detected screen reader and the screen reader mode state' },
  { name: 'a11y-stream', description: 'Whole answer delivery: show each answer at once instead of streaming it', argumentHint: '[on|off|auto]' },
  { name: 'a11y-last', description: 'Print the full text of a recent tool result', argumentHint: '[n]' },
]

export const LAST_RESULTS_KEPT = 5

export type Facts = {
  platform?: Platform
  detection?: DetectionResult
  mode?: ModeState
  modVersion: string
  settingsPath?: string
  backedUp: boolean
  delivery: Delivery
}

export const session: { consent: ConsentState; timer: Timer | undefined; facts: Facts; lastResults: LastResults } = {
  consent: IDLE,
  timer: undefined,
  lastResults: createLastResults(LAST_RESULTS_KEPT),
  facts: { modVersion: '0.0.0', backedUp: false, delivery: { mode: 'live', source: 'mode' } },
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

export function narrates(): boolean {
  return session.facts.delivery.mode === 'buffered'
}
