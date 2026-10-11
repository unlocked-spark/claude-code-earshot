import type { Reader } from './types'

export type ConsentState = { status: 'idle' } | { status: 'pending'; reader: Reader; askedAt: number }

export type Answer = 'yes' | 'no' | 'other'

export type ConsentEvent =
  | { type: 'ask'; reader: Reader; at: number }
  | { type: 'prompt'; text: string }
  | { type: 'timeout' }
  | { type: 'command' }

export type ConsentEffect = 'none' | 'enable' | 'decline' | 'withdraw' | 'passthrough'

export const IDLE: ConsentState = { status: 'idle' }

export const ANSWER_TIMEOUT_MS = 30_000

// y yes (English), t tak (Polish), j ja (German), o oui (French), s si sí
// (Spanish), s si sì (Italian); n no nie nein non.
const YES: ReadonlySet<string> = new Set(['y', 'yes', 't', 'tak', 'j', 'ja', 'o', 'oui', 's', 'si', 'sí', 'sì'])
const NO: ReadonlySet<string> = new Set(['n', 'no', 'nie', 'nein', 'non'])

export function parseAnswer(text: string): Answer {
  const word = text.trim().toLowerCase()
  // Every supported language's answer is taken, whatever language asked:
  // the letter the question names and the whole word.
  if (YES.has(word)) return 'yes'
  if (NO.has(word)) return 'no'
  return 'other'
}

// A pure state machine: the mod feeds it events and runs the effect it names.
export function consentReducer(state: ConsentState, event: ConsentEvent): { state: ConsentState; effect: ConsentEffect } {
  switch (event.type) {
    case 'ask':
      return { state: { status: 'pending', reader: event.reader, askedAt: event.at }, effect: 'none' }
    case 'prompt': {
      if (state.status !== 'pending') return { state, effect: 'passthrough' }
      const answer = parseAnswer(event.text)
      if (answer === 'yes') return { state: IDLE, effect: 'enable' }
      if (answer === 'no') return { state: IDLE, effect: 'decline' }
      return { state: IDLE, effect: 'passthrough' }
    }
    case 'timeout':
      return state.status === 'pending' ? { state: IDLE, effect: 'withdraw' } : { state, effect: 'none' }
    case 'command':
      return { state: IDLE, effect: 'none' }
  }
}
