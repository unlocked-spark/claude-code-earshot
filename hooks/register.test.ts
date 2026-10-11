import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Log = { spoken: string[]; logged: string[]; written: { path: string; text: string }[]; notified: number; commands: string[] }

// Stubs the world beneath the mod: a macOS host with or without VoiceOver, a
// settings file, the mod's own manifest, and silent audio and transcript sinks
// that record what the mod said. Each stub answers its event with { value }.
function host(on: On, world: { voiceover: boolean; env: Record<string, string>; settings: string | undefined; appleLanguages?: string }): Log {
  const log: Log = { spoken: [], logged: [], written: [], notified: 0, commands: [] }
  let settings = world.settings
  mock.env(on, world.env)
  mock.store(on)
  mock.clock(on)
  on('process.run', (_$, e) => {
    const cmd = e.argv[0]
    const reply = (exitCode: number, stdout: string) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (cmd === 'uname') return reply(0, 'Darwin\n')
    if (cmd === 'pgrep') return world.voiceover ? reply(0, '123\n') : reply(1, '')
    if (cmd === 'defaults') return world.appleLanguages === undefined ? reply(1, '') : reply(0, world.appleLanguages)
    throw new Error(`unexpected command ${e.argv.join(' ')}`)
  })
  on('settings.read', () => ({ value: settings === undefined ? {} : (JSON.parse(settings) as Record<string, unknown>) }))
  on('fs.exists', (_$, e) => ({ value: e.path.endsWith('settings.json') ? settings !== undefined : false }))
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('plugin.json')) return { value: '{ "name": "earshot", "version": "0.1.0" }' }
    if (e.path.endsWith('settings.json') && settings !== undefined) return { value: settings }
    throw new Error(`no such file ${e.path}`)
  })
  on('fs.write', (_$, e) => {
    log.written.push({ path: e.path, text: e.text })
    if (e.path.endsWith('settings.json')) settings = e.text
    return { value: undefined }
  })
  on('audio.speak', (_$, e) => {
    log.spoken.push(e.text)
    return { value: { via: 'system' as const } }
  })
  on('ui.log', (_$, e) => {
    if (e.to !== 'debug') log.logged.push(e.text)
    return { value: undefined }
  })
  on('ui.notify', () => {
    log.notified += 1
    return { value: { isSent: true as const, channel: 'terminal_bell' as const } }
  })
  on('command.register', (_$, e) => {
    log.commands.push(e.name)
    return { value: { command: e.name } }
  })
  // The bottom of the chain, standing for the engine's own behaviour.
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  return log
}

const start = { cwd: '/work', surface: 'terminal' as const, isInteractive: true }
const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' as const } })
const command = (name: string) => ({ command: name, args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } })

test('asks by voice and in the transcript when VoiceOver runs and the mode is off (AC-005, AC-012)', async ($, on) => {
  const log = host(on, { voiceover: true, env: { HOME: '/Users/t' }, settings: '{\n  "model": "opus"\n}\n' })
  await $.session.start(start)
  expect(log.spoken).toHaveLength(1)
  expect(log.spoken[0]).toBe('VoiceOver detected. Enable Claude Code screen reader mode from the next start? Press y or n.')
  expect(log.logged).toContain(log.spoken[0])
  expect(log.notified).toBe(1)
})

test('writes axScreenReader on y, keeps other keys, and consumes the answer (AC-006)', async ($, on) => {
  const log = host(on, { voiceover: true, env: { HOME: '/Users/t' }, settings: '{\n  "model": "opus"\n}\n' })
  await $.session.start(start)
  const result = await $.prompt.submit(typed('y'))
  expect(result.drop).toBeDefined()
  const settingsWrite = log.written.find((w) => w.path === '/Users/t/.claude/settings.json')
  expect(settingsWrite).toBeDefined()
  expect(JSON.parse(settingsWrite?.text ?? '{}')).toEqual({ model: 'opus', axScreenReader: true })
  expect(log.spoken.at(-1)).toBe('Screen reader mode enabled from the next start. Restart Claude Code now.')
  expect(log.logged.at(-1)).toBe(log.spoken.at(-1))
})

test('stays silent when CLAUDE_AX_SCREEN_READER is 0 and lets prompts through (AC-003)', async ($, on) => {
  const log = host(on, { voiceover: true, env: { HOME: '/Users/t', CLAUDE_AX_SCREEN_READER: '0' }, settings: undefined })
  await $.session.start(start)
  expect(log.spoken).toHaveLength(0)
  expect(log.logged).toHaveLength(0)
  const result = await $.prompt.submit(typed('y'))
  expect(result.drop).toBeUndefined()
  expect(log.written).toHaveLength(0)
})

test('registers the commands and /a11y-off removes the key (AC-009, AC-010)', async ($, on) => {
  const log = host(on, { voiceover: false, env: { HOME: '/Users/t' }, settings: '{"axScreenReader": true, "model": "opus"}' })
  await $.session.start(start)
  expect(log.commands).toEqual(expect.arrayContaining(['a11y-on', 'a11y-off', 'a11y-status']))
  const result = await $.command.run(command('a11y-off'))
  expect(result.text).toBe('Screen reader mode disabled from the next start.')
  const settingsWrite = log.written.find((w) => w.path === '/Users/t/.claude/settings.json')
  expect(JSON.parse(settingsWrite?.text ?? '{}')).toEqual({ model: 'opus' })
})

const polishMac = '(\n    "pl-PL",\n    "en-PL"\n)\n'

test('speaks Polish when the system displays Polish, and takes t as yes (system language)', async ($, on) => {
  const log = host(on, { voiceover: true, env: { HOME: '/Users/t' }, settings: '{\n  "model": "opus"\n}\n', appleLanguages: polishMac })
  await $.session.start(start)
  expect(log.spoken[0]).toBe('Wykryto VoiceOver. Włączyć tryb czytnika ekranu w Claude Code od następnego uruchomienia? Naciśnij t albo n.')
  expect(log.logged).toContain(log.spoken[0])
  await $.prompt.submit(typed('t'))
  expect(log.spoken.at(-1)).toBe('Tryb czytnika ekranu włączony od następnego uruchomienia. Uruchom teraz Claude Code ponownie.')
})

test('speaks German for a German system and takes j as yes (system language)', async ($, on) => {
  const log = host(on, { voiceover: true, env: { HOME: '/Users/t' }, settings: '{}', appleLanguages: '(\n    "de-DE"\n)\n' })
  await $.session.start(start)
  expect(log.spoken[0]).toBe('VoiceOver erkannt. Den Screenreader-Modus von Claude Code ab dem nächsten Start einschalten? Drücke j oder n.')
  await $.prompt.submit(typed('j'))
  expect(log.spoken.at(-1)).toBe('Screenreader-Modus ab dem nächsten Start eingeschaltet. Starte Claude Code jetzt neu.')
})

test('falls back to English for a system language without lines (system language)', async ($, on) => {
  const log = host(on, { voiceover: true, env: { HOME: '/Users/t', LANG: 'pl_PL.UTF-8' }, settings: undefined, appleLanguages: '(\n    "ja-JP"\n)\n' })
  await $.session.start(start)
  expect(log.spoken[0]).toBe('VoiceOver detected. Enable Claude Code screen reader mode from the next start? Press y or n.')
})
