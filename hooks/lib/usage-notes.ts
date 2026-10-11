import type { Language } from './language'

// What the heartbeat adds after its own line: the context window once it is
// 70% full, so the user can compact between tasks, and a rate-limit window
// once it is 80% used. A limit is read only when its whole percentage moved
// since it was last read; a window that drops below the threshold (it reset)
// is forgotten, so crossing it again is read again.

export const CONTEXT_THRESHOLD = 70
export const LIMIT_THRESHOLD = 80

export type LimitKind = 'five_hour' | 'seven_day' | 'spend_limit'

const LIMIT_KINDS: readonly string[] = ['five_hour', 'seven_day', 'spend_limit']

export type UsageReading = {
  context: { percent?: number }
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
}

export type UsageNote =
  | { kind: 'context'; percent: number }
  | { kind: 'limit'; window: LimitKind; percent: number; resetsAt: string | undefined }

// The whole percentage last read per limit window.
export type LimitMemory = Readonly<Record<string, number>>

export function usageNotes(reading: UsageReading, memory: LimitMemory): { notes: UsageNote[]; memory: LimitMemory } {
  const notes: UsageNote[] = []
  const percent = reading.context.percent
  if (percent !== undefined && percent >= CONTEXT_THRESHOLD) notes.push({ kind: 'context', percent: Math.floor(percent) })
  const next: Record<string, number> = { ...memory }
  for (const limit of reading.rateLimits) {
    if (!LIMIT_KINDS.includes(limit.kind)) continue
    const used = Math.floor(limit.percentUsed)
    if (used < LIMIT_THRESHOLD) {
      delete next[limit.kind]
      continue
    }
    if (next[limit.kind] === used) continue
    next[limit.kind] = used
    notes.push({ kind: 'limit', window: limit.kind as LimitKind, percent: used, resetsAt: limit.resetsAt })
  }
  return { notes, memory: next }
}

// When a window resets, in the user's language and local time: the time
// alone on the same day, the weekday and time otherwise.
export function formatReset(resetsAt: string | undefined, now: number, language: Language, timeZone?: string): string | undefined {
  if (resetsAt === undefined) return undefined
  const at = Date.parse(resetsAt)
  if (Number.isNaN(at)) return undefined
  const day = new Intl.DateTimeFormat(language, { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
  const sameDay = day.format(at) === day.format(now)
  const options: Intl.DateTimeFormatOptions = { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }
  if (!sameDay) options.weekday = 'long'
  return new Intl.DateTimeFormat(language, options).format(at)
}
