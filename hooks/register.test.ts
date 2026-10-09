import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Log = { spoken: string[]; logged: string[]; written: { path: string; text: string }[]; notified: number }

// Stubs the world beneath the mod: a macOS host with VoiceOver running, an
// empty settings file, the mod's own manifest, and silent audio and transcript
// sinks that record what the mod said.
function host(on: On, world: { voiceover: boolean; env: Record<string, string>; settings: string | undefined }): Log {
  const log: Log = { spoken: [], logged: [], written: [], notified: 0 }
  let settings = world.settings
  mock.env(on, world.env)
  mock.store(on)
  mock.clock(on)
  on('process.run', (_$, e) => {
    const cmd = e.argv[0]
    if (cmd === 'uname') return { exitCode: 0, stdout: 'Darwin\n', stderr: '' }
    if (cmd === 'pgrep') return world.voiceover ? { exitCode: 0, stdout: '123\n', stderr: '' } : { exitCode: 1, stdout: '', stderr: '' }
    throw new Error(`unexpected command ${e.argv.join(' ')}`)
  })
  on('settings.read', () => (settings === undefined ? {} : (JSON.parse(settings) as Record<string, unknown>)))
  on('fs.exists', (_$, e) => (e.path.endsWith('settings.json') ? settings !== undefined : false))
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('plugin.json')) return '{ "name": "claude-code-a11y", "version": "0.1.0" }'
    if (e.path.endsWith('settings.json') && settings !== undefined) return settings
    throw new Error(`no such file ${e.path}`)
  })
  on('fs.write', (_$, e) => {
    log.written.push({ path: e.path, text: e.text })
    if (e.path.endsWith('settings.json')) settings = e.text
  })
  on('audio.speak', (_$, e) => {
    log.spoken.push(e.text)
    return { via: 'system' as const }
  })
  on('ui.log', (_$, e) => {
    log.logged.push(e.text)
  })
  on('ui.notify', () => {
    log.notified += 1
    return { isSent: true as const, channel: 'terminal_bell' as const }
  })
  on('command.register', (_$, e) => ({ command: e.name }))
  return log
}

const start = { cwd: '/work', surface: 'terminal' as const, isInteractive: true }

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
  const result = await $.prompt.submit({ text: 'y' })
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
  const result = await $.prompt.submit({ text: 'y' })
  expect(result.drop).toBeUndefined()
  expect(log.written).toHaveLength(0)
})

test('registers the three commands and /a11y-off removes the key (AC-009, AC-010)', async ($, on) => {
  const log = host(on, { voiceover: false, env: { HOME: '/Users/t' }, settings: '{"axScreenReader": true, "model": "opus"}' })
  await $.session.start(start)
  const commands = (await $.command.list()).map((c) => c.name)
  expect(commands).toEqual(expect.arrayContaining(['a11y-on', 'a11y-off', 'a11y-status']))
  const result = await $.command.run({ command: 'a11y-off', args: '' })
  expect(result.text).toBe('Screen reader mode disabled from the next start.')
  const settingsWrite = log.written.find((w) => w.path === '/Users/t/.claude/settings.json')
  expect(JSON.parse(settingsWrite?.text ?? '{}')).toEqual({ model: 'opus' })
})
