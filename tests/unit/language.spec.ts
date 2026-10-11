import { afterEach, describe, expect, it } from 'vitest'
import { parseAnswer } from '../../hooks/lib/consent'
import {
  DARWIN_LANGUAGES_ARGV,
  parseAppleLanguages,
  pickLanguage,
  primaryLanguage,
  resolveLanguage,
  SUPPORTED,
  WINDOWS_UI_LANGUAGE_ARGV,
} from '../../hooks/lib/language'
import { currentLanguage, messages, polishPlural, readerName, setLanguage, TABLES } from '../../hooks/lib/messages'
import { resultLine, summaryLine } from '../../hooks/lib/tool-narration'
import type { RunResult } from '../../hooks/lib/types'

const ok = (stdout: string): RunResult => ({ exitCode: 0, stdout, stderr: '' })

afterEach(() => setLanguage('en'))

describe('primaryLanguage', () => {
  it('reads BCP 47, POSIX and Windows locale names', () => {
    expect(primaryLanguage('pl-PL')).toBe('pl')
    expect(primaryLanguage('pl_PL.UTF-8')).toBe('pl')
    expect(primaryLanguage('Polish_Poland.1250')).toBe('pl')
    expect(primaryLanguage('en')).toBe('en')
    expect(primaryLanguage(' de-DE\r\n')).toBe('de')
  })
  it('names no language for empty, C and POSIX', () => {
    expect(primaryLanguage(undefined)).toBeUndefined()
    expect(primaryLanguage('')).toBeUndefined()
    expect(primaryLanguage('C.UTF-8')).toBeUndefined()
    expect(primaryLanguage('POSIX')).toBeUndefined()
  })
})

describe('pickLanguage', () => {
  it('takes the first candidate that names a language', () => {
    expect(pickLanguage([undefined, 'C', 'pl_PL.UTF-8'])).toBe('pl')
  })
  it('gives English for an unsupported first language, even with Polish later', () => {
    expect(pickLanguage(['ja-JP', 'pl_PL.UTF-8'])).toBe('en')
  })
  it('gives English when nothing names a language', () => {
    expect(pickLanguage([undefined, undefined])).toBe('en')
  })
})

describe('parseAppleLanguages', () => {
  it('takes the first entry of the property list', () => {
    expect(parseAppleLanguages('(\n    "pl-PL",\n    "en-PL"\n)\n')).toBe('pl-PL')
    expect(parseAppleLanguages('(\n    en,\n    pl\n)\n')).toBe('en')
  })
  it('gives undefined for empty output', () => {
    expect(parseAppleLanguages('')).toBeUndefined()
  })
})

describe('resolveLanguage', () => {
  it('asks Windows for its display language before the variables', async () => {
    const seen: (readonly string[])[] = []
    const language = await resolveLanguage({
      platform: 'win32',
      env: { LANG: 'en_US.UTF-8' },
      run: (argv) => {
        seen.push(argv)
        return Promise.resolve(ok('pl-PL\r\n'))
      },
    })
    expect(language).toBe('pl')
    expect(seen).toEqual([WINDOWS_UI_LANGUAGE_ARGV])
  })
  it('asks macOS for AppleLanguages', async () => {
    const seen: (readonly string[])[] = []
    const language = await resolveLanguage({
      platform: 'darwin',
      env: {},
      run: (argv) => {
        seen.push(argv)
        return Promise.resolve(ok('(\n    "pl-PL"\n)\n'))
      },
    })
    expect(language).toBe('pl')
    expect(seen).toEqual([DARWIN_LANGUAGES_ARGV])
  })
  it('falls back to the variables when the probe fails or exits non-zero', async () => {
    const thrown = await resolveLanguage({ platform: 'win32', env: { LANG: 'pl_PL.UTF-8' }, run: () => Promise.reject(new Error('no powershell')) })
    expect(thrown).toBe('pl')
    const failed = await resolveLanguage({
      platform: 'darwin',
      env: { LC_MESSAGES: 'pl_PL' },
      run: () => Promise.resolve({ exitCode: 1, stdout: '', stderr: '' }),
    })
    expect(failed).toBe('pl')
  })
  it('reads LC_ALL, then LC_MESSAGES, then LANG on other systems, without running anything', async () => {
    const run = () => Promise.reject(new Error('should not run'))
    expect(await resolveLanguage({ platform: 'other', env: { LC_ALL: 'pl_PL.UTF-8', LANG: 'en_US.UTF-8' }, run })).toBe('pl')
    expect(await resolveLanguage({ platform: 'other', env: { LC_MESSAGES: 'en_GB', LANG: 'pl_PL' }, run })).toBe('en')
    expect(await resolveLanguage({ platform: 'other', env: {}, run })).toBe('en')
  })
})

describe('polishPlural', () => {
  const form = (n: number) => polishPlural(n, 'sekunda', 'sekundy', 'sekund')
  it('chooses one, few and many', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 20, 22, 25, 102, 112].map(form)).toEqual([
      'sekunda',
      'sekundy',
      'sekundy',
      'sekund',
      'sekund',
      'sekund',
      'sekund',
      'sekund',
      'sekundy',
      'sekund',
      'sekundy',
      'sekund',
    ])
  })
})

describe('setLanguage', () => {
  it('swaps every line, the shared messages object included', () => {
    expect(currentLanguage()).toBe('en')
    setLanguage('pl')
    expect(currentLanguage()).toBe('pl')
    expect(messages.question('nvda')).toBe('Wykryto NVDA. Włączyć tryb czytnika ekranu w Claude Code od następnego uruchomienia? Naciśnij t albo n.')
    expect(messages.question('unknown')).toBe(
      'Wykryto czytnik ekranu. Włączyć tryb czytnika ekranu w Claude Code od następnego uruchomienia? Naciśnij t albo n.',
    )
    expect(messages.heartbeat(20)).toBe('Nadal pracuję, 20 sekund.')
    expect(messages.heartbeat(22)).toBe('Nadal pracuję, 22 sekundy.')
    expect(messages.heartbeatSet(1)).toBe('Sygnał pracy ustawiony co 1 sekundę ciszy.')
    expect(messages.commandDescriptions['earshot-on']).toBe('Włącz tryb czytnika ekranu w Claude Code od następnego uruchomienia')
    expect(readerName('unknown')).toBe('czytnik ekranu')
    setLanguage('en')
    expect(messages.heartbeat(20)).toBe('Still working, 20 seconds.')
    expect(readerName('unknown')).toBe('a screen reader')
  })
  it('gives tool narration its Polish labels and counts', () => {
    setLanguage('pl')
    const flags = { isRunning: true, isErrored: false, isInterrupted: false }
    expect(summaryLine(flags, 'Bash', { command: 'ls', description: 'List files' })).toBe('narzędzie działa: List files')
    expect(resultLine(false, 1)).toBe('wynik: 1 wiersz')
    expect(resultLine(false, 3)).toBe('wynik: 3 wiersze')
    expect(resultLine(true, 292)).toBe('błąd: 292 wiersze')
    expect(resultLine(false, 15)).toBe('wynik: 15 wierszy')
  })
  it('has a Polish line for every English one', () => {
    setLanguage('en')
    const keys = Object.keys(messages).sort()
    const commands = Object.keys(messages.commandDescriptions).sort()
    setLanguage('pl')
    expect(Object.keys(messages).sort()).toEqual(keys)
    expect(Object.keys(messages.commandDescriptions).sort()).toEqual(commands)
  })
})

describe('every language table', () => {
  const languages = Object.keys(TABLES) as (keyof typeof TABLES)[]
  it('covers every supported language', () => {
    expect(languages.sort()).toEqual([...SUPPORTED].sort())
  })
  it.each(languages)('%s describes every command and asks with letters parseAnswer takes', (language) => {
    const table = TABLES[language]
    expect(Object.keys(table.commandDescriptions).sort()).toEqual(Object.keys(TABLES.en.commandDescriptions).sort())
    const question = table.question('nvda')
    expect(question).toContain('NVDA')
    const letters = /(\w) \S+ (\w)\.$/u.exec(question)
    expect(letters).not.toBeNull()
    expect(parseAnswer(letters?.[1] ?? '')).toBe('yes')
    expect(parseAnswer(letters?.[2] ?? '')).toBe('no')
    expect(table.heartbeat(20)).toContain('20')
    expect(table.resultLine(false, 3)).toContain('3')
  })
})

describe('parseAnswer in other languages', () => {
  it('takes the yes and no words of German, French, Spanish and Italian', () => {
    expect(['ja', 'J', 'oui', 'o', 'sí', 'si', 'sì', 's'].map(parseAnswer)).toEqual(Array(8).fill('yes'))
    expect(['nein', 'non', 'no'].map(parseAnswer)).toEqual(Array(3).fill('no'))
  })
})

describe('parseAnswer in Polish', () => {
  it('takes t, tak and nie alongside y and n', () => {
    expect(parseAnswer('t')).toBe('yes')
    expect(parseAnswer(' Tak ')).toBe('yes')
    expect(parseAnswer('NIE')).toBe('no')
  })
})
