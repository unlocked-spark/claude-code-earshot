import type { DeliveryMode, DeliverySource, DetectionResult, ModeState, Reader, StoredConsent, ToolLabel, ToolNarrationMode } from '../types'

// The shape every language's table fills. The compiler checks that each
// table has every line, so a new line in English fails the build until every
// language has it.

export type ErrorKind = 'no-home' | 'invalid-json' | 'not-an-object' | 'write-failed' | 'verify-mismatch'

export type StatusArgs = { active: boolean; detection: DetectionResult | undefined; mode: ModeState | undefined; consent: StoredConsent | undefined }

export type Messages = {
  // How a reader the mod cannot name is called inside a sentence.
  readerFallback: string
  question(reader: Reader): string
  enabled(): string
  declined(): string
  withdrawn(): string
  answered(): string
  answerReady(): string
  offDone(): string
  offAlready(): string
  offElsewhere(): string
  status(args: StatusArgs): string
  streamReport(args: { mode: DeliveryMode; source: DeliverySource }): string
  streamSet(mode: DeliveryMode): string
  streamAuto(): string
  streamInvalid(): string
  toolsReport(args: { mode: ToolNarrationMode; source: DeliverySource }): string
  toolsSet(mode: ToolNarrationMode): string
  toolsAuto(): string
  toolsInvalid(): string
  toolLabel(label: ToolLabel): string
  resultLine(isErrored: boolean, lines: number): string
  welcome(): string
  working(): string
  heartbeat(seconds: number): string
  heartbeatReport(seconds: number): string
  heartbeatSet(seconds: number): string
  heartbeatInvalid(): string
  logReport(on: boolean): string
  logInvalid(): string
  lastHeader(summary: string): string
  lastNone(): string
  lastOutOfRange(kept: number): string
  lastInvalid(): string
  error(kind: ErrorKind, path: string | undefined): string
  commandDescriptions: Readonly<Record<string, string>>
}

export const SETTINGS_FILE = '~/.claude/settings.json'

// The product name of a known reader, or the table's own word for one the
// mod could not name.
export function nameOf(reader: Reader, fallback: string): string {
  switch (reader) {
    case 'voiceover':
      return 'VoiceOver'
    case 'nvda':
      return 'NVDA'
    case 'jaws':
      return 'JAWS'
    case 'unknown':
      return fallback
  }
}

// Polish counts take one of three forms: 1 sekunda; 2 to 4 sekundy, and so
// 22 to 24, 32 to 34 and on, but not 12 to 14; every other count sekund.
export function polishPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const tens = n % 100
  const units = n % 10
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many
}
