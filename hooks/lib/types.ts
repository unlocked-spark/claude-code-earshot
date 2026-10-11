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

// A user setting as it was before the mod changed it: absent, or its value.
export type SavedValue = { present: false } | { present: true; value: unknown }

export type SavedSettings = Readonly<Record<string, SavedValue>>

// Whether the mod is on, stored by /earshot-on and /earshot-off; `saved`
// holds the user settings as they were before /earshot-on changed them.
export type Activation = { on: boolean; setAt: string; saved?: SavedSettings }

// Whole answer delivery

export type DeliveryMode = 'buffered' | 'live'

export type DeliverySource = 'override' | 'mode'

export type StreamOverride = { mode: DeliveryMode; setAt: string }

// The part of a turn.step chunk the hold looks at. The real chunks carry more
// fields; the hold passes them through untouched.
export type StepChunk = { readonly kind: string; readonly text?: string; readonly [key: string]: unknown }

// Tool narration

export type ToolFlags = { isRunning: boolean; isErrored: boolean; isInterrupted: boolean }

export type ToolLabel = 'tool' | 'tool error' | 'tool running' | 'tool interrupted'

export type LastResultEntry = { id: string; summary: string; text: string }

export type ToolNarrationMode = 'off' | 'brief' | 'full'

export type ToolsOverride = { mode: ToolNarrationMode; setAt: string }

// Render log

export type RenderLogSetting = { on: boolean; setAt: string }

// Heartbeat

export type HeartbeatSetting = { seconds: number; setAt: string }
