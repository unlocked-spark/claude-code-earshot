// Shared types of the pure modules. None of them imports the mod API: every
// side effect is injected, so Vitest covers the decisions without Claude Code.

export type Platform = 'darwin' | 'win32' | 'other'

export type Reader = 'voiceover' | 'nvda' | 'jaws' | 'unknown'

export type DetectionMethod = 'pgrep' | 'process-list' | 'spi-flag' | 'none'

export type DetectionResult = {
  platform: Platform
  reader: Reader | null
  method: DetectionMethod
  durationMs: number
  error?: string
}

export type RunResult = { exitCode: number; stdout: string; stderr: string }

export type Runner = (argv: readonly string[], init?: { timeoutMs?: number }) => Promise<RunResult>

export type ModeSource = 'env' | 'settings-user' | 'settings-other' | 'off'

export type ModeState = {
  on: boolean
  source: ModeSource
  envValue: string | undefined
  userSetting: boolean | undefined
}

export type StoredConsent = { declined: true; declinedAt: string; modVersion: string }

export type SettingsLike = Readonly<Record<string, unknown>>
