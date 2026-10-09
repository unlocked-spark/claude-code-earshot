import type { DeliveryMode, DeliverySource, StepChunk, StreamOverride } from './types'

export type Delivery = { mode: DeliveryMode; source: DeliverySource }

export type StreamArg = 'report' | 'on' | 'off' | 'auto' | 'invalid'

export type Hold<C extends StepChunk> = {
  take(chunk: C): void
  release(): { chunks: C[]; hasText: boolean }
}

export function resolveDelivery(_args: { modeOn: boolean; override: unknown }): Delivery {
  throw new Error('not implemented')
}

export function isStreamOverride(_value: unknown): _value is StreamOverride {
  throw new Error('not implemented')
}

export function parseStreamArg(_args: string): StreamArg {
  throw new Error('not implemented')
}

export function createHold<C extends StepChunk>(): Hold<C> {
  throw new Error('not implemented')
}
