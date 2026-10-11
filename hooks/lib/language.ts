import type { Platform, Runner } from './types'

// The language of the mod's own lines follows the operating system's display
// language. Only languages with a full set of lines are chosen; any other
// system language, or one that cannot be read, falls back to English.

export type Language = 'en' | 'pl' | 'de' | 'fr' | 'es' | 'it'

export const SUPPORTED: readonly Language[] = ['en', 'pl', 'de', 'fr', 'es', 'it']

export const LANGUAGE_BUDGET_MS = 2000

export const WINDOWS_UI_LANGUAGE_ARGV: readonly string[] = ['powershell', '-NoProfile', '-NonInteractive', '-Command', '(Get-UICulture).Name']

export const DARWIN_LANGUAGES_ARGV: readonly string[] = ['defaults', 'read', '-g', 'AppleLanguages']

// Windows code-page names that `setlocale` style variables may carry.
const WINDOWS_NAMES: Record<string, string> = { english: 'en', polish: 'pl', german: 'de', french: 'fr', spanish: 'es', italian: 'it' }

// The primary language subtag of a locale name (`pl-PL`, `pl_PL.UTF-8`,
// `Polish_Poland.1250`, `en`), lower case; undefined for an empty value or
// the neutral `C` and `POSIX` locales, which name no language.
export function primaryLanguage(tag: string | undefined): string | undefined {
  if (tag === undefined) return undefined
  const head = tag.trim().split(/[-_.@:]/)[0]?.toLowerCase() ?? ''
  if (head === '' || head === 'c' || head === 'posix') return undefined
  const named = WINDOWS_NAMES[head]
  if (named !== undefined) return named
  return /^[a-z]{2,3}$/.test(head) ? head : undefined
}

// The first candidate that names a language decides: a supported one is used,
// any other gives English. Later candidates only fill in for silent ones.
export function pickLanguage(candidates: readonly (string | undefined)[]): Language {
  for (const candidate of candidates) {
    const primary = primaryLanguage(candidate)
    if (primary === undefined) continue
    return (SUPPORTED as readonly string[]).includes(primary) ? (primary as Language) : 'en'
  }
  return 'en'
}

// `defaults read -g AppleLanguages` prints a property list array; its first
// entry is the language the system displays.
export function parseAppleLanguages(stdout: string): string | undefined {
  const quoted = /"([^"]+)"/.exec(stdout)
  if (quoted?.[1] !== undefined) return quoted[1]
  const bare = /^\s*([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)\s*,?\s*$/m.exec(stdout.replace(/[()]/g, ''))
  return bare?.[1]
}

export type LanguageEnv = { LC_ALL?: string | undefined; LC_MESSAGES?: string | undefined; LANG?: string | undefined }

// Windows and macOS are asked for their display language first; the POSIX
// variables come next and are all Linux has. A failing probe counts as silent.
export async function resolveLanguage(args: { platform: Platform; env: LanguageEnv; run: Runner }): Promise<Language> {
  const probe = async (argv: readonly string[]): Promise<string | undefined> => {
    try {
      const result = await args.run(argv, { timeoutMs: LANGUAGE_BUDGET_MS })
      return result.exitCode === 0 ? result.stdout : undefined
    } catch {
      return undefined
    }
  }
  let system: string | undefined
  if (args.platform === 'win32') system = (await probe(WINDOWS_UI_LANGUAGE_ARGV))?.trim()
  else if (args.platform === 'darwin') {
    const out = await probe(DARWIN_LANGUAGES_ARGV)
    system = out === undefined ? undefined : parseAppleLanguages(out)
  }
  return pickLanguage([system, args.env.LC_ALL, args.env.LC_MESSAGES, args.env.LANG])
}
