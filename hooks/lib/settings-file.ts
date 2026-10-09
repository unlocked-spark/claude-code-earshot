import type { Platform } from './types'

export type ApplyResult =
  | { ok: true; text: string; changed: boolean; hadKey: boolean }
  | { ok: false; reason: 'invalid-json' | 'not-an-object' }

export function settingsPath(_platform: Platform, _env: { HOME?: string; USERPROFILE?: string }): string | undefined {
  throw new Error('not implemented')
}

export function detectIndent(_text: string): string {
  throw new Error('not implemented')
}

export function applyAxSetting(_text: string | undefined, _value: true | 'remove'): ApplyResult {
  throw new Error('not implemented')
}
