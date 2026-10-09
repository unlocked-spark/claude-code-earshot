import type { DetectionResult, ModeState, Reader, SettingsLike, StoredConsent } from './types'

export type Decision =
  | { action: 'silent'; reason: 'no-reader' | 'mode-on' | 'env-set' | 'explicit-false' | 'declined' }
  | { action: 'ask'; reader: Reader }

export function isEnvOn(_value: string): boolean {
  throw new Error('not implemented')
}

export function resolveModeState(_args: {
  envValue: string | undefined
  userSettings: SettingsLike
  mergedSettings: SettingsLike
}): ModeState {
  throw new Error('not implemented')
}

export function isStoredConsent(_value: unknown): _value is StoredConsent {
  throw new Error('not implemented')
}

export function decide(_args: {
  mode: ModeState
  detection: DetectionResult
  consent: unknown
  modVersion: string
}): Decision {
  throw new Error('not implemented')
}
