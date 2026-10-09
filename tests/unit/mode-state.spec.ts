import { describe, expect, it } from 'vitest'
import { decide, isEnvOn, isStoredConsent, resolveModeState } from '../../hooks/lib/mode-state'
import type { DetectionResult, ModeState } from '../../hooks/lib/types'

const voiceover: DetectionResult = { platform: 'darwin', reader: 'voiceover', method: 'pgrep', durationMs: 10 }
const nobody: DetectionResult = { platform: 'darwin', reader: null, method: 'pgrep', durationMs: 10 }
const off: ModeState = { on: false, source: 'off', envValue: undefined, userSetting: undefined }

describe('isEnvOn (AC-002, AC-003)', () => {
  it('treats 1 and other values as on', () => {
    expect(isEnvOn('1')).toBe(true)
    expect(isEnvOn('true')).toBe(true)
    expect(isEnvOn('yes')).toBe(true)
  })
  it('treats 0, false, empty and off as off', () => {
    for (const v of ['0', 'false', '', 'off', 'no', 'FALSE']) expect(isEnvOn(v)).toBe(false)
  })
})

describe('resolveModeState (AC-002, AC-003, AC-004)', () => {
  it('lets the environment variable win over settings', () => {
    const state = resolveModeState({ envValue: '0', userSettings: { axScreenReader: true }, mergedSettings: { axScreenReader: true } })
    expect(state).toMatchObject({ on: false, source: 'env', envValue: '0', userSetting: true })
  })
  it('reports on via user settings', () => {
    const state = resolveModeState({ envValue: undefined, userSettings: { axScreenReader: true }, mergedSettings: { axScreenReader: true } })
    expect(state).toMatchObject({ on: true, source: 'settings-user' })
  })
  it('reports on via another settings source when the user file lacks the key', () => {
    const state = resolveModeState({ envValue: undefined, userSettings: {}, mergedSettings: { axScreenReader: true } })
    expect(state).toMatchObject({ on: true, source: 'settings-other', userSetting: undefined })
  })
  it('reports off and the explicit false', () => {
    const state = resolveModeState({ envValue: undefined, userSettings: { axScreenReader: false }, mergedSettings: { axScreenReader: false } })
    expect(state).toMatchObject({ on: false, source: 'off', userSetting: false })
  })
  it('ignores a non-boolean value', () => {
    const state = resolveModeState({ envValue: undefined, userSettings: { axScreenReader: 'yes' }, mergedSettings: { axScreenReader: 'yes' } })
    expect(state).toMatchObject({ on: false, userSetting: undefined })
  })
})

describe('isStoredConsent', () => {
  it('accepts the stored shape only', () => {
    expect(isStoredConsent({ declined: true, declinedAt: '2026-10-09T10:00:00Z', modVersion: '0.1.0' })).toBe(true)
    expect(isStoredConsent({ declined: false })).toBe(false)
    expect(isStoredConsent(undefined)).toBe(false)
    expect(isStoredConsent('no')).toBe(false)
  })
})

describe('decide (AC-002 to AC-005, AC-007, AC-014)', () => {
  it('asks when a reader runs, the mode is off and nothing is stored', () => {
    expect(decide({ mode: off, detection: voiceover, consent: undefined, modVersion: '0.1.0' })).toEqual({ action: 'ask', reader: 'voiceover' })
  })
  it('stays silent without a reader', () => {
    expect(decide({ mode: off, detection: nobody, consent: undefined, modVersion: '0.1.0' })).toEqual({ action: 'silent', reason: 'no-reader' })
  })
  it('stays silent when the mode is already on', () => {
    const on: ModeState = { ...off, on: true, source: 'settings-user', userSetting: true }
    expect(decide({ mode: on, detection: voiceover, consent: undefined, modVersion: '0.1.0' })).toEqual({ action: 'silent', reason: 'mode-on' })
  })
  it('stays silent when the environment variable is set, even to 0', () => {
    const env: ModeState = { ...off, source: 'env', envValue: '0' }
    expect(decide({ mode: env, detection: voiceover, consent: undefined, modVersion: '0.1.0' })).toEqual({ action: 'silent', reason: 'env-set' })
  })
  it('treats an explicit false in user settings as a refusal', () => {
    const explicit: ModeState = { ...off, userSetting: false }
    expect(decide({ mode: explicit, detection: voiceover, consent: undefined, modVersion: '0.1.0' })).toEqual({ action: 'silent', reason: 'explicit-false' })
  })
  it('honours a stored refusal from the same version', () => {
    const consent = { declined: true, declinedAt: '2026-10-09T10:00:00Z', modVersion: '0.1.0' }
    expect(decide({ mode: off, detection: voiceover, consent, modVersion: '0.1.0' })).toEqual({ action: 'silent', reason: 'declined' })
  })
  it('asks again once after an upgrade', () => {
    const consent = { declined: true, declinedAt: '2026-10-09T10:00:00Z', modVersion: '0.1.0' }
    expect(decide({ mode: off, detection: voiceover, consent, modVersion: '0.2.0' })).toEqual({ action: 'ask', reader: 'voiceover' })
  })
  it('ignores a malformed stored value', () => {
    expect(decide({ mode: off, detection: voiceover, consent: { declined: 'yes' }, modVersion: '0.1.0' })).toEqual({ action: 'ask', reader: 'voiceover' })
  })
})
