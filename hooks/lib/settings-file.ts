import type { Platform } from './types'

export type ApplyResult =
  | { ok: true; text: string; changed: boolean; hadKey: boolean }
  | { ok: false; reason: 'invalid-json' | 'not-an-object' }

const KEY = 'axScreenReader'

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
export function applyAxSetting(text: string | undefined, value: true | 'remove'): ApplyResult {
  let parsed: unknown = {}
  if (text !== undefined) {
    try {
      parsed = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'invalid-json' }
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, reason: 'not-an-object' }
  const settings = parsed as Record<string, unknown>
  const hadKey = Object.prototype.hasOwnProperty.call(settings, KEY)
  let changed: boolean
  if (value === true) {
    changed = settings[KEY] !== true
    settings[KEY] = true
  } else {
    changed = hadKey
    delete settings[KEY]
  }
  const indent = text === undefined ? '  ' : detectIndent(text)
  const trailingNewline = text === undefined || text.endsWith('\n')
  return { ok: true, text: JSON.stringify(settings, null, indent) + (trailingNewline ? '\n' : ''), changed, hadKey }
}
