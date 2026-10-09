import type { DetectionResult, Platform, Reader, RunResult, Runner } from './types'

export const DETECTION_BUDGET_MS = 2000

export const DARWIN_ARGV: readonly string[] = ['pgrep', '-x', 'VoiceOver']
export const WINDOWS_PROCESS_LIST_ARGV: readonly string[] = []
export const WINDOWS_SPI_ARGV: readonly string[] = []

export function platformFromEnv(_osVar: string | undefined, _uname: string | undefined): Platform {
  throw new Error('not implemented')
}

export function parsePgrep(_result: RunResult): boolean {
  throw new Error('not implemented')
}

export function parseProcessList(_stdout: string): Reader | null {
  throw new Error('not implemented')
}

export function parseSpiFlag(_stdout: string): boolean {
  throw new Error('not implemented')
}

export async function detect(_args: { platform: Platform; run: Runner; now: () => number }): Promise<DetectionResult> {
  throw new Error('not implemented')
}
