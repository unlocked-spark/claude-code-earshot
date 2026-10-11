import type { Activation, DetectionResult, ModeState, Reader, SettingsLike, StoredConsent } from './types'

export type Decision =
  | { action: 'silent'; reason: 'no-reader' | 'mod-off' | 'mode-on' | 'env-set' | 'explicit-false' | 'declined' }
  | { action: 'ask'; reader: Reader }

const ENV_OFF_VALUES = new Set(['', '0', 'false', 'no', 'off'])

export function isEnvOn(value: string): boolean {
  return !ENV_OFF_VALUES.has(value.trim().toLowerCase())
}

function booleanAt(settings: SettingsLike): boolean | undefined {
  const value = settings['axScreenReader']
  return typeof value === 'boolean' ? value : undefined
}

// The engine decides the mode once at startup: flag, then the variable, then
// the setting. The flag is invisible to a mod, so a session started with
// --ax-screen-reader and nothing else reads as off here.
export function resolveModeState(args: {
  envValue: string | undefined
  userSettings: SettingsLike
  mergedSettings: SettingsLike
}): ModeState {
  const userSetting = booleanAt(args.userSettings)
  const envValue = args.envValue
  if (envValue !== undefined) return { on: isEnvOn(envValue), source: 'env', envValue, userSetting }
  if (booleanAt(args.mergedSettings) === true) {
    return { on: true, source: userSetting === true ? 'settings-user' : 'settings-other', envValue, userSetting }
  }
  return { on: false, source: 'off', envValue, userSetting }
}

export function isStoredConsent(value: unknown): value is StoredConsent {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record['declined'] === true && typeof record['declinedAt'] === 'string' && typeof record['modVersion'] === 'string'
}

export function isActivation(value: unknown): value is Activation {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record['on'] === 'boolean' && typeof record['setAt'] === 'string'
}

// The mod stops once /earshot-off turned it off and runs otherwise; its
// features follow screen reader mode on their own (delivery, narration).
export function resolveActive(activation: unknown): boolean {
  return isActivation(activation) ? activation.on : true
}

export function decide(args: { mode: ModeState; detection: DetectionResult; consent: unknown; activation?: unknown; modVersion: string }): Decision {
  const reader = args.detection.reader
  if (reader === null) return { action: 'silent', reason: 'no-reader' }
  if (isActivation(args.activation) && !args.activation.on) return { action: 'silent', reason: 'mod-off' }
  if (args.mode.on) return { action: 'silent', reason: 'mode-on' }
  if (args.mode.envValue !== undefined) return { action: 'silent', reason: 'env-set' }
  if (args.mode.userSetting === false) return { action: 'silent', reason: 'explicit-false' }
  if (isStoredConsent(args.consent) && args.consent.modVersion === args.modVersion) return { action: 'silent', reason: 'declined' }
  return { action: 'ask', reader }
}
