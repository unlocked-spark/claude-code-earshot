import { describe, expect, it } from 'vitest'
import { createHold, isStreamOverride, parseStreamArg, resolveDelivery } from '../../hooks/lib/stream-delivery'
import { messages } from '../../hooks/lib/messages'

const override = (mode: 'buffered' | 'live') => ({ mode, setAt: '2026-10-09T20:00:00.000Z' })

describe('resolveDelivery (AC-006, AC-007)', () => {
  it('buffers in screen reader mode without an override', () => {
    expect(resolveDelivery({ modeOn: true, override: undefined })).toEqual({ mode: 'buffered', source: 'mode' })
  })
  it('streams live outside screen reader mode', () => {
    expect(resolveDelivery({ modeOn: false, override: undefined })).toEqual({ mode: 'live', source: 'mode' })
  })
  it('lets a buffered override win over the mode', () => {
    expect(resolveDelivery({ modeOn: false, override: override('buffered') })).toEqual({ mode: 'buffered', source: 'override' })
  })
  it('lets a live override win over the mode', () => {
    expect(resolveDelivery({ modeOn: true, override: override('live') })).toEqual({ mode: 'live', source: 'override' })
  })
  it('ignores a malformed override', () => {
    expect(resolveDelivery({ modeOn: true, override: { mode: 'sometimes' } })).toEqual({ mode: 'buffered', source: 'mode' })
    expect(resolveDelivery({ modeOn: false, override: 'buffered' })).toEqual({ mode: 'live', source: 'mode' })
  })
})

describe('isStreamOverride', () => {
  it('accepts the stored shape only', () => {
    expect(isStreamOverride(override('live'))).toBe(true)
    expect(isStreamOverride({ mode: 'buffered' })).toBe(false)
    expect(isStreamOverride(null)).toBe(false)
  })
})

describe('parseStreamArg (AC-007)', () => {
  it('reads on, off and auto in any case with spaces', () => {
    expect(parseStreamArg('on')).toBe('on')
    expect(parseStreamArg(' OFF ')).toBe('off')
    expect(parseStreamArg('Auto')).toBe('auto')
  })
  it('reports with no argument', () => {
    expect(parseStreamArg('')).toBe('report')
    expect(parseStreamArg('   ')).toBe('report')
  })
  it('rejects anything else', () => {
    expect(parseStreamArg('maybe')).toBe('invalid')
    expect(parseStreamArg('on please')).toBe('invalid')
  })
})

describe('createHold (AC-002, AC-003, AC-004, AC-005)', () => {
  it('keeps text, tool, input, stop and engine chunks in order', () => {
    const hold = createHold()
    const script = [
      { kind: 'engine', ref: 1 },
      { kind: 'text', text: 'Hello' },
      { kind: 'tool', name: 'Read' },
      { kind: 'input', json: '{"a":1}' },
      { kind: 'text', text: ' world' },
      { kind: 'stop' },
      { kind: 'engine', ref: 2 },
    ]
    for (const c of script) hold.take(c)
    const out = hold.release()
    expect(out.chunks).toEqual(script)
    expect(out.hasText).toBe(true)
  })
  it('drops thinking chunks', () => {
    const hold = createHold()
    hold.take({ kind: 'thinking', text: 'hmm' })
    hold.take({ kind: 'text', text: 'ok' })
    expect(hold.release().chunks).toEqual([{ kind: 'text', text: 'ok' }])
  })
  it('counts only non-empty text for the bell', () => {
    const hold = createHold()
    hold.take({ kind: 'text', text: '' })
    hold.take({ kind: 'tool', name: 'Bash' })
    hold.take({ kind: 'stop' })
    const out = hold.release()
    expect(out.hasText).toBe(false)
    expect(out.chunks).toHaveLength(3)
  })
  it('releases an empty hold', () => {
    expect(createHold().release()).toEqual({ chunks: [], hasText: false })
  })
  it('starts over after a release', () => {
    const hold = createHold()
    hold.take({ kind: 'text', text: 'a' })
    hold.release()
    expect(hold.release()).toEqual({ chunks: [], hasText: false })
  })
})

describe('stream messages (AC-007)', () => {
  it('reports each state in one sentence', () => {
    expect(messages.streamReport({ mode: 'buffered', source: 'override' })).toBe('Whole answer delivery on (forced).')
    expect(messages.streamReport({ mode: 'buffered', source: 'mode' })).toBe('Whole answer delivery on (screen reader mode).')
    expect(messages.streamReport({ mode: 'live', source: 'override' })).toBe('Whole answer delivery off (forced).')
    expect(messages.streamReport({ mode: 'live', source: 'mode' })).toBe('Whole answer delivery off (screen reader mode is off).')
  })
  it('confirms a change', () => {
    expect(messages.streamSet('buffered')).toBe('Whole answer delivery on (forced). Answers appear whole; thinking is hidden.')
    expect(messages.streamSet('live')).toBe('Whole answer delivery off (forced). Answers stream live.')
    expect(messages.streamAuto()).toBe('Override removed.')
    expect(messages.streamInvalid()).toBe('Usage: /a11y-stream, /a11y-stream on, /a11y-stream off, or /a11y-stream auto.')
  })
})
