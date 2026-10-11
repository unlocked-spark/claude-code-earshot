import type { DeliveryMode, DeliverySource, StepChunk, StreamOverride } from './types'

export type Delivery = { mode: DeliveryMode; source: DeliverySource }

export type StreamArg = 'report' | 'on' | 'off' | 'auto' | 'invalid'

export type Hold<C extends StepChunk> = {
  take(chunk: C): void
  release(): { chunks: C[]; hasText: boolean }
}

export function isStreamOverride(value: unknown): value is StreamOverride {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (record['mode'] === 'buffered' || record['mode'] === 'live') && typeof record['setAt'] === 'string'
}

// An override from /earshot-stream wins; otherwise the screen reader mode decides.
export function resolveDelivery(args: { modeOn: boolean; override: unknown }): Delivery {
  if (isStreamOverride(args.override)) return { mode: args.override.mode, source: 'override' }
  return { mode: args.modeOn ? 'buffered' : 'live', source: 'mode' }
}

export function parseStreamArg(args: string): StreamArg {
  const word = args.trim().toLowerCase()
  if (word === '') return 'report'
  if (word === 'on' || word === 'off' || word === 'auto') return word
  return 'invalid'
}

// Keeps every chunk of one model step except thinking, in order, and notes
// whether any visible text arrived (the bell rings only then).
export function createHold<C extends StepChunk>(): Hold<C> {
  let chunks: C[] = []
  let hasText = false
  return {
    take(chunk) {
      if (chunk.kind === 'thinking') return
      if (chunk.kind === 'text' && typeof chunk.text === 'string' && chunk.text.length > 0) hasText = true
      chunks.push(chunk)
    },
    release() {
      const out = { chunks, hasText }
      chunks = []
      hasText = false
      return out
    },
  }
}

// Merges runs of text chunks that belong to one block into a single chunk
// without an engine ref (a chunk built afresh is taken at its word), so the
// terminal receives the whole answer in one piece and paints it in one frame.
// Every other chunk keeps its place and its ref; a text run is cut by any
// chunk of another kind or another block index.
export function coalesceText<C extends StepChunk>(chunks: readonly C[]): C[] {
  const out: C[] = []
  let run: { index: unknown; text: string; first: C } | undefined
  const flush = () => {
    if (run === undefined) return
    const merged = { kind: 'text', index: run.index, text: run.text } as unknown as C
    out.push(merged)
    run = undefined
  }
  for (const chunk of chunks) {
    if (chunk.kind === 'text' && typeof chunk.text === 'string') {
      const index = (chunk as { index?: unknown }).index
      if (run !== undefined && run.index === index) {
        run.text += chunk.text
        continue
      }
      flush()
      run = { index, text: chunk.text, first: chunk }
      continue
    }
    flush()
    out.push(chunk)
  }
  flush()
  return out
}
