import { describe, expect, it } from 'vitest'
import { ANSWER_TIMEOUT_MS, consentReducer, IDLE, parseAnswer } from '../../hooks/lib/consent'
import type { ConsentState } from '../../hooks/lib/consent'
import { messages, readerName } from '../../hooks/lib/messages'

const pending: ConsentState = { status: 'pending', reader: 'nvda', askedAt: 5 }

describe('parseAnswer (AC-005)', () => {
  it('accepts y, yes, n and no in any case with spaces', () => {
    expect(parseAnswer('y')).toBe('yes')
    expect(parseAnswer(' Yes \n')).toBe('yes')
    expect(parseAnswer('N')).toBe('no')
    expect(parseAnswer('no')).toBe('no')
  })
  it('treats anything else as another prompt', () => {
    expect(parseAnswer('yes please enable it')).toBe('other')
    expect(parseAnswer('')).toBe('other')
    expect(parseAnswer('/a11y-on')).toBe('other')
  })
})

describe('consentReducer (AC-005, AC-007, AC-008, edge cases)', () => {
  it('waits 30 seconds for an answer', () => {
    expect(ANSWER_TIMEOUT_MS).toBe(30_000)
  })
  it('passes an ordinary prompt through while idle', () => {
    expect(consentReducer(IDLE, { type: 'prompt', text: 'y' })).toEqual({ state: IDLE, effect: 'passthrough' })
  })
  it('opens the question', () => {
    expect(consentReducer(IDLE, { type: 'ask', reader: 'nvda', at: 5 })).toEqual({ state: pending, effect: 'none' })
  })
  it('enables on yes', () => {
    expect(consentReducer(pending, { type: 'prompt', text: 'y' })).toEqual({ state: IDLE, effect: 'enable' })
  })
  it('declines on no', () => {
    expect(consentReducer(pending, { type: 'prompt', text: 'no' })).toEqual({ state: IDLE, effect: 'decline' })
  })
  it('withdraws the question and passes another prompt through', () => {
    expect(consentReducer(pending, { type: 'prompt', text: 'fix the build' })).toEqual({ state: IDLE, effect: 'passthrough' })
  })
  it('withdraws on timeout without storing anything', () => {
    expect(consentReducer(pending, { type: 'timeout' })).toEqual({ state: IDLE, effect: 'withdraw' })
  })
  it('ignores a timeout while idle', () => {
    expect(consentReducer(IDLE, { type: 'timeout' })).toEqual({ state: IDLE, effect: 'none' })
  })
  it('cancels the question when a command answers instead', () => {
    expect(consentReducer(pending, { type: 'command' })).toEqual({ state: IDLE, effect: 'none' })
  })
})

describe('messages (AC-005, AC-012, AC-013)', () => {
  it('names readers', () => {
    expect(readerName('voiceover')).toBe('VoiceOver')
    expect(readerName('nvda')).toBe('NVDA')
    expect(readerName('jaws')).toBe('JAWS')
  })
  it('asks with the reader name and the answer keys', () => {
    expect(messages.question('voiceover')).toBe('VoiceOver detected. Enable Claude Code screen reader mode from the next start? Press y or n.')
    expect(messages.question('unknown')).toMatch(/^A screen reader was detected\./)
  })
  it('tells the user to restart after enabling', () => {
    expect(messages.enabled()).toBe('Screen reader mode enabled from the next start. Restart Claude Code now.')
  })
  it('gives the manual fallback on errors', () => {
    const text = messages.error('invalid-json', '/u/.claude/settings.json')
    expect(text).toContain('not valid JSON')
    expect(text).toContain('"axScreenReader": true')
    expect(text).toContain('CLAUDE_AX_SCREEN_READER=1')
    expect(text).toContain('/u/.claude/settings.json')
  })
  it('reports status in one sentence per item', () => {
    const text = messages.status({
      detection: { platform: 'darwin', reader: 'voiceover', method: 'pgrep', durationMs: 3 },
      mode: { on: false, source: 'env', envValue: '0', userSetting: undefined },
      consent: { declined: true, declinedAt: '2026-10-09T10:00:00.000Z', modVersion: '0.1.0' },
    })
    expect(text).toContain('VoiceOver detected.')
    expect(text).toContain('Screen reader mode off, set by the CLAUDE_AX_SCREEN_READER variable.')
    expect(text).toContain('Refusal stored on 2026-10-09, mod version 0.1.0.')
  })
})
