import type { Platform, SavedSettings, SavedValue } from './types'

export type ApplyResult = { ok: true; text: string; changed: boolean } | { ok: false; reason: 'invalid-json' | 'not-an-object' }

export type SnapshotResult = { ok: true; saved: SavedSettings } | { ok: false; reason: 'invalid-json' | 'not-an-object' }

// The user settings /earshot-on sets: screen reader mode on, and no tips under
// the spinner, which a screen reader reads aloud.
export const MOD_SETTINGS: SavedSettings = {
  axScreenReader: { present: true, value: true },
  spinnerTipsEnabled: { present: true, value: false },
}

// What /earshot-off restores when the mod was turned on by a version that
// saved nothing: that version only added axScreenReader, and removed it.
export const LEGACY_SAVED: SavedSettings = { axScreenReader: { present: false } }

type Parsed = { ok: true; settings: Record<string, unknown> } | { ok: false; reason: 'invalid-json' | 'not-an-object' }

function parse(text: string | undefined): Parsed {
  let parsed: unknown = {}
  if (text !== undefined) {
    try {
      parsed = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'invalid-json' }
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, reason: 'not-an-object' }
  return { ok: true, settings: parsed as Record<string, unknown> }
}

function has(settings: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(settings, key)
}

// The named keys as the file holds them now, so /earshot-off can put them back.
export function snapshot(text: string | undefined, keys: readonly string[]): SnapshotResult {
  const parsed = parse(text)
  if (!parsed.ok) return parsed
  const saved: Record<string, SavedValue> = {}
  for (const key of keys) saved[key] = has(parsed.settings, key) ? { present: true, value: parsed.settings[key] } : { present: false }
  return { ok: true, saved }
}

export function settingsPath(platform: Platform, env: { HOME?: string; USERPROFILE?: string }): string | undefined {
  if (platform === 'win32') {
    const base = env.USERPROFILE ?? env.HOME
    return base === undefined ? undefined : `${base}\\.claude\\settings.json`
  }
  return env.HOME === undefined ? undefined : `${env.HOME}/.claude/settings.json`
}

export function detectIndent(text: string): string {
  const match = /\n([ \t]+)\S/.exec(text)
  return match?.[1] ?? '  '
}

// Rewrites the whole file through a strict JSON round trip: key order and the
// file's own indentation survive, comments and trailing commas are refused
// (AC-013), so a file Claude Code tolerates but JSON does not is never touched.
// A present value is set, an absent one removes its key.
export function applySettings(text: string | undefined, values: SavedSettings): ApplyResult {
  const parsed = parse(text)
  if (!parsed.ok) return parsed
  const settings = parsed.settings
  let changed = false
  for (const [key, saved] of Object.entries(values)) {
    if (saved.present) {
      changed ||= !has(settings, key) || JSON.stringify(settings[key]) !== JSON.stringify(saved.value)
      settings[key] = saved.value
    } else if (has(settings, key)) {
      changed = true
      delete settings[key]
    }
  }
  const indent = text === undefined ? '  ' : detectIndent(text)
  const trailingNewline = text === undefined || text.endsWith('\n')
  return { ok: true, text: JSON.stringify(settings, null, indent) + (trailingNewline ? '\n' : ''), changed }
}
