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

export function parseAnswer(text: string): Answer {
  const word = text.trim().toLowerCase()
  if (word === 'y' || word === 'yes') return 'yes'
  if (word === 'n' || word === 'no') return 'no'
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
