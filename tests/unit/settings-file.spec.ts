import { describe, expect, it } from 'vitest'
import { applySettings, detectIndent, MOD_SETTINGS, settingsPath, snapshot } from '../../hooks/lib/settings-file'

describe('settingsPath (AC-006, edge cases)', () => {
  it('uses HOME on macOS', () => {
    expect(settingsPath('darwin', { HOME: '/Users/t' })).toBe('/Users/t/.claude/settings.json')
  })
  it('uses USERPROFILE on Windows', () => {
    expect(settingsPath('win32', { USERPROFILE: 'C:\\Users\\t' })).toBe('C:\\Users\\t\\.claude\\settings.json')
  })
  it('falls back to HOME on Windows', () => {
    expect(settingsPath('win32', { HOME: 'C:\\Users\\t' })).toBe('C:\\Users\\t\\.claude\\settings.json')
  })
  it('is undefined without a home directory', () => {
    expect(settingsPath('darwin', {})).toBeUndefined()
    expect(settingsPath('win32', {})).toBeUndefined()
  })
})

describe('detectIndent', () => {
  it('defaults to two spaces', () => {
    expect(detectIndent('{}')).toBe('  ')
    expect(detectIndent('')).toBe('  ')
  })
  it('keeps four spaces and tabs', () => {
    expect(detectIndent('{\n    "a": 1\n}')).toBe('    ')
    expect(detectIndent('{\n\t"a": 1\n}')).toBe('\t')
  })
})

const AX_ON = { axScreenReader: { present: true, value: true } } as const
const AX_GONE = { axScreenReader: { present: false } } as const

describe('applySettings (AC-006, AC-010, AC-013)', () => {
  it('adds the key and preserves other keys and indentation', () => {
    const before = '{\n    "model": "opus",\n    "permissions": { "allow": ["Bash(ls *)"] }\n}\n'
    const result = applySettings(before, AX_ON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(true)
    expect(JSON.parse(result.text)).toEqual({ model: 'opus', permissions: { allow: ['Bash(ls *)'] }, axScreenReader: true })
    expect(result.text).toContain('\n    "model"')
    expect(result.text.endsWith('\n')).toBe(true)
  })

  it('creates the file content when there is no file', () => {
    const result = applySettings(undefined, MOD_SETTINGS)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.text)).toEqual({ axScreenReader: true, spinnerTipsEnabled: false })
  })

  it('turns an explicit false into true', () => {
    const result = applySettings('{"axScreenReader": false}', AX_ON)
    expect(result.ok && result.changed).toBe(true)
  })

  it('reports no change when already set', () => {
    const result = applySettings('{"axScreenReader": true, "spinnerTipsEnabled": false}', MOD_SETTINGS)
    expect(result.ok && !result.changed).toBe(true)
  })

  it('refuses invalid JSON without touching it', () => {
    expect(applySettings('{"a": 1,}', AX_ON)).toEqual({ ok: false, reason: 'invalid-json' })
    expect(applySettings('// comment\n{}', AX_ON)).toEqual({ ok: false, reason: 'invalid-json' })
  })

  it('refuses a root that is not an object', () => {
    expect(applySettings('[1, 2]', AX_ON)).toEqual({ ok: false, reason: 'not-an-object' })
    expect(applySettings('null', AX_ON)).toEqual({ ok: false, reason: 'not-an-object' })
  })

  it('removes an absent key and keeps the rest', () => {
    const result = applySettings('{"axScreenReader": true, "model": "opus"}', AX_GONE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(true)
    expect(JSON.parse(result.text)).toEqual({ model: 'opus' })
  })

  it('reports nothing to remove', () => {
    const result = applySettings('{"model": "opus"}', AX_GONE)
    expect(result.ok && !result.changed).toBe(true)
  })

  it('does not add a trailing newline the file did not have', () => {
    const result = applySettings('{"model": "opus"}', AX_ON)
    expect(result.ok && !result.text.endsWith('\n')).toBe(true)
  })
})

describe('snapshot (earshot on and off)', () => {
  it('records each key as present with its value or absent', () => {
    expect(snapshot('{"spinnerTipsEnabled": true, "model": "opus"}', ['axScreenReader', 'spinnerTipsEnabled'])).toEqual({
      ok: true,
      saved: { axScreenReader: { present: false }, spinnerTipsEnabled: { present: true, value: true } },
    })
  })

  it('round-trips: applying the snapshot after the mod settings gives the file back', () => {
    const before = '{\n  "model": "opus",\n  "spinnerTipsEnabled": true\n}\n'
    const taken = snapshot(before, Object.keys(MOD_SETTINGS))
    const on = applySettings(before, MOD_SETTINGS)
    if (!taken.ok || !on.ok) throw new Error('unexpected failure')
    const off = applySettings(on.text, taken.saved)
    expect(off.ok && JSON.parse(off.text)).toEqual(JSON.parse(before))
  })

  it('refuses invalid JSON', () => {
    expect(snapshot('{', ['axScreenReader'])).toEqual({ ok: false, reason: 'invalid-json' })
  })
})
