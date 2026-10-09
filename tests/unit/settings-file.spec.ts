import { describe, expect, it } from 'vitest'
import { applyAxSetting, detectIndent, settingsPath } from '../../hooks/lib/settings-file'

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

describe('applyAxSetting (AC-006, AC-010, AC-013)', () => {
  it('adds the key and preserves other keys and indentation', () => {
    const before = '{\n    "model": "opus",\n    "permissions": { "allow": ["Bash(ls *)"] }\n}\n'
    const result = applyAxSetting(before, true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(true)
    expect(result.hadKey).toBe(false)
    expect(JSON.parse(result.text)).toEqual({ model: 'opus', permissions: { allow: ['Bash(ls *)'] }, axScreenReader: true })
    expect(result.text).toContain('\n    "model"')
    expect(result.text.endsWith('\n')).toBe(true)
  })

  it('creates the file content when there is no file', () => {
    const result = applyAxSetting(undefined, true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.text)).toEqual({ axScreenReader: true })
  })

  it('turns an explicit false into true', () => {
    const result = applyAxSetting('{"axScreenReader": false}', true)
    expect(result.ok && result.changed && result.hadKey).toBe(true)
  })

  it('reports no change when already true', () => {
    const result = applyAxSetting('{"axScreenReader": true}', true)
    expect(result.ok && !result.changed && result.hadKey).toBe(true)
  })

  it('refuses invalid JSON without touching it', () => {
    expect(applyAxSetting('{"a": 1,}', true)).toEqual({ ok: false, reason: 'invalid-json' })
    expect(applyAxSetting('// comment\n{}', true)).toEqual({ ok: false, reason: 'invalid-json' })
  })

  it('refuses a root that is not an object', () => {
    expect(applyAxSetting('[1, 2]', true)).toEqual({ ok: false, reason: 'not-an-object' })
    expect(applyAxSetting('null', true)).toEqual({ ok: false, reason: 'not-an-object' })
  })

  it('removes the key and keeps the rest', () => {
    const result = applyAxSetting('{"axScreenReader": true, "model": "opus"}', 'remove')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.hadKey).toBe(true)
    expect(result.changed).toBe(true)
    expect(JSON.parse(result.text)).toEqual({ model: 'opus' })
  })

  it('reports nothing to remove', () => {
    const result = applyAxSetting('{"model": "opus"}', 'remove')
    expect(result.ok && !result.hadKey && !result.changed).toBe(true)
  })

  it('does not add a trailing newline the file did not have', () => {
    const result = applyAxSetting('{"model": "opus"}', true)
    expect(result.ok && !result.text.endsWith('\n')).toBe(true)
  })
})
