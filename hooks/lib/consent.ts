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

export function parseAnswer(_text: string): Answer {
  throw new Error('not implemented')
}

export function consentReducer(_state: ConsentState, _event: ConsentEvent): { state: ConsentState; effect: ConsentEffect } {
  throw new Error('not implemented')
}
