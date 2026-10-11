import { describe, expect, it } from 'vitest'
import { formatReset, usageNotes } from '../../hooks/lib/usage-notes'
import { TABLES } from '../../hooks/lib/messages'

const reading = (percent: number | undefined, limits: { kind: string; percentUsed: number; resetsAt?: string }[] = []) => ({ context: { percent }, rateLimits: limits })

describe('usageNotes (AC-023)', () => {
  it('reads the context from 70% on, at every heartbeat', () => {
    expect(usageNotes(reading(69), {}).notes).toEqual([])
    expect(usageNotes(reading(70), {}).notes).toEqual([{ kind: 'context', percent: 70 }])
    const first = usageNotes(reading(72), {})
    expect(usageNotes(reading(72), first.memory).notes).toEqual([{ kind: 'context', percent: 72 }])
    expect(usageNotes(reading(undefined), {}).notes).toEqual([])
  })

  it('reads a limit from 80% on, and again only when its whole percentage moved', () => {
    const at = '2026-10-11T18:00:00Z'
    expect(usageNotes(reading(10, [{ kind: 'five_hour', percentUsed: 79.9 }]), {}).notes).toEqual([])
    const first = usageNotes(reading(10, [{ kind: 'five_hour', percentUsed: 84.2, resetsAt: at }]), {})
    expect(first.notes).toEqual([{ kind: 'limit', window: 'five_hour', percent: 84, resetsAt: at }])
    const same = usageNotes(reading(10, [{ kind: 'five_hour', percentUsed: 84.7, resetsAt: at }]), first.memory)
    expect(same.notes).toEqual([])
    const moved = usageNotes(reading(10, [{ kind: 'five_hour', percentUsed: 85, resetsAt: at }]), same.memory)
    expect(moved.notes).toEqual([{ kind: 'limit', window: 'five_hour', percent: 85, resetsAt: at }])
  })

  it('forgets a window that dropped below 80%, so crossing it again is read', () => {
    const first = usageNotes(reading(10, [{ kind: 'seven_day', percentUsed: 81 }]), {})
    const reset = usageNotes(reading(10, [{ kind: 'seven_day', percentUsed: 2 }]), first.memory)
    expect(reset.memory).toEqual({})
    expect(usageNotes(reading(10, [{ kind: 'seven_day', percentUsed: 81 }]), reset.memory).notes).toHaveLength(1)
  })

  it('skips windows it cannot name', () => {
    expect(usageNotes(reading(10, [{ kind: 'other', percentUsed: 95 }]), {}).notes).toEqual([])
  })
})

describe('formatReset (AC-023)', () => {
  const now = Date.parse('2026-10-11T12:00:00Z')
  it('gives the time alone on the same day and the weekday otherwise', () => {
    expect(formatReset('2026-10-11T18:00:00Z', now, 'en', 'UTC')).toBe('18:00')
    expect(formatReset('2026-10-16T18:00:00Z', now, 'pl', 'UTC')).toMatch(/^piątek.*18:00$/)
    expect(formatReset(undefined, now, 'en', 'UTC')).toBeUndefined()
    expect(formatReset('not a date', now, 'en', 'UTC')).toBeUndefined()
  })
})

describe('usage lines', () => {
  it('reads in each language', () => {
    expect(TABLES.en.usageContext(72)).toBe('Context 72%.')
    expect(TABLES.en.usageLimit('five_hour', 84, '18:00')).toBe('5-hour limit 84%, resets 18:00.')
    expect(TABLES.pl.usageContext(72)).toBe('Kontekst 72%.')
    expect(TABLES.pl.usageLimit('seven_day', 91, undefined)).toBe('Limit tygodniowy 91%.')
  })
})
