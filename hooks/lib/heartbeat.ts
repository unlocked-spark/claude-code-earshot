import type { HeartbeatSetting } from './types'

// A long turn with the tool rows hidden is silence: nothing new reaches the
// screen reader until the answer lands. The heartbeat says every N seconds of
// silence that work goes on. Time comes from the engine's clock; visible
// output is counted by the hooks that produce it.

export const HEARTBEAT_DEFAULT_SECONDS = 20
export const HEARTBEAT_MIN_SECONDS = 5
export const HEARTBEAT_MAX_SECONDS = 600
export const HEARTBEAT_TICK_MS = 1000

export type HeartbeatArg = 'report' | 'off' | 'invalid' | number

export type Silence = {
  // Visible rows produced since the turn began, counted by the hooks.
  visibleCount: number
  // The count the last tick saw.
  seenCount: number
  // When the current silence began.
  silentSince: number
  // The silence length already announced, in seconds (0: none yet).
  announcedSeconds: number
}

export function isHeartbeatSetting(value: unknown): value is HeartbeatSetting {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const seconds = record['seconds']
  return typeof seconds === 'number' && Number.isInteger(seconds) && seconds >= 0 && typeof record['setAt'] === 'string'
}

// Seconds between announcements; 0 is off.
export function resolveHeartbeat(stored: unknown): number {
  return isHeartbeatSetting(stored) ? stored.seconds : HEARTBEAT_DEFAULT_SECONDS
}

export function parseHeartbeatArg(args: string): HeartbeatArg {
  const word = args.trim().toLowerCase()
  if (word === '') return 'report'
  if (word === 'off') return 'off'
  if (!/^\d+$/.test(word)) return 'invalid'
  const seconds = Number(word)
  return seconds >= HEARTBEAT_MIN_SECONDS && seconds <= HEARTBEAT_MAX_SECONDS ? seconds : 'invalid'
}

export function createSilence(now: number): Silence {
  return { visibleCount: 0, seenCount: 0, silentSince: now, announcedSeconds: 0 }
}

export function noteVisible(state: Silence): Silence {
  return { ...state, visibleCount: state.visibleCount + 1 }
}

// One tick: new output restarts the silence; otherwise the silence is
// announced each time it grows by the interval (20, 40, 60 seconds).
export function tick(state: Silence, now: number, intervalSeconds: number): { state: Silence; announce: number | undefined } {
  if (state.visibleCount !== state.seenCount) {
    return { state: { ...state, seenCount: state.visibleCount, silentSince: now, announcedSeconds: 0 }, announce: undefined }
  }
  const silent = Math.floor((now - state.silentSince) / 1000)
  if (intervalSeconds > 0 && silent >= state.announcedSeconds + intervalSeconds) {
    return { state: { ...state, announcedSeconds: silent }, announce: silent }
  }
  return { state, announce: undefined }
}
