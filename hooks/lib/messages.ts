import type { Language } from './language'
import { de } from './lines/de'
import { en } from './lines/en'
import { es } from './lines/es'
import { fr } from './lines/fr'
import { it } from './lines/it'
import { pl } from './lines/pl'
import { nameOf } from './lines/types'
import type { Messages } from './lines/types'
import type { Reader } from './types'

export type { ErrorKind, Messages, StatusArgs } from './lines/types'
export { polishPlural } from './lines/types'

// Every line the mod speaks or prints, in the system's language. Each line is
// a short sentence that stands on its own when heard once (AC-012). The
// tables live in ./lines, one file per language; `messages` holds the chosen
// one (English until `setLanguage` picks another), so callers never pass a
// language.

export const TABLES: Readonly<Record<Language, Messages>> = { en, pl, de, fr, es, it }

// The live table: its members are swapped in place, so every module that
// imported `messages` speaks the chosen language from then on.
export const messages: Messages = { ...en }

let current: Language = 'en'

export function setLanguage(language: Language): void {
  current = language
  Object.assign(messages, TABLES[language])
}

export function currentLanguage(): Language {
  return current
}

export function readerName(reader: Reader): string {
  return nameOf(reader, messages.readerFallback)
}
