import type { DeliveryMode, DeliverySource, DetectionResult, ModeState, Reader, StoredConsent, ToolNarrationMode } from './types'

// Every line here is spoken and printed verbatim (AC-012), so each one is a
// short sentence that stands on its own when heard once.

export function readerName(reader: Reader): string {
  switch (reader) {
    case 'voiceover':
      return 'VoiceOver'
    case 'nvda':
      return 'NVDA'
    case 'jaws':
      return 'JAWS'
    case 'unknown':
      return 'A screen reader'
  }
}

function detected(reader: Reader): string {
  return reader === 'unknown' ? 'A screen reader was detected.' : `${readerName(reader)} detected.`
}

function fallback(path: string | undefined): string {
  return `Add "axScreenReader": true to ${path ?? '~/.claude/settings.json'} by hand, or set CLAUDE_AX_SCREEN_READER=1 in your shell profile.`
}

const SOURCE_WORDS = {
  env: 'the CLAUDE_AX_SCREEN_READER variable',
  'settings-user': 'your settings file',
  'settings-other': 'project or managed settings',
  off: 'nothing',
} as const

export const messages = {
  question(reader: Reader): string {
    return `${detected(reader)} Enable Claude Code screen reader mode from the next start? Press y or n.`
  },
  enabled(): string {
    return 'Screen reader mode enabled from the next start. Restart Claude Code now.'
  },
  declined(): string {
    return 'Understood. Screen reader mode stays off. Run /a11y-on at any time to enable it.'
  },
  withdrawn(): string {
    return 'No answer, leaving screen reader mode off for this session.'
  },
  offDone(): string {
    return 'Screen reader mode disabled from the next start.'
  },
  offNothing(): string {
    return 'Screen reader mode was not set in your settings file; nothing changed.'
  },
  offElsewhere(): string {
    return 'Screen reader mode is set in project or managed settings, not in your settings file; nothing changed.'
  },
  status(args: { detection: DetectionResult | undefined; mode: ModeState | undefined; consent: StoredConsent | undefined }): string {
    const parts: string[] = []
    const { detection, mode, consent } = args
    if (detection === undefined) parts.push('Detection has not run.')
    else if (detection.reader !== null) parts.push(detected(detection.reader))
    else if (detection.error !== undefined) parts.push(`Detection failed: ${detection.error}.`)
    else parts.push('No screen reader detected.')
    if (mode === undefined) parts.push('Screen reader mode state unknown.')
    else if (mode.on) parts.push(`Screen reader mode on, set by ${SOURCE_WORDS[mode.source]}.`)
    else if (mode.source === 'env') {
      parts.push('Screen reader mode off, set by the CLAUDE_AX_SCREEN_READER variable. The mod will not change settings while the variable is set.')
    } else if (mode.userSetting === false) parts.push('Screen reader mode off, set to false in your settings file.')
    else parts.push('Screen reader mode off.')
    if (consent === undefined) parts.push('No refusal stored.')
    else parts.push(`Refusal stored on ${consent.declinedAt.slice(0, 10)}, mod version ${consent.modVersion}.`)
    return parts.join(' ')
  },
  streamReport(args: { mode: DeliveryMode; source: DeliverySource }): string {
    const state = args.mode === 'buffered' ? 'on' : 'off'
    const why = args.source === 'override' ? 'forced' : args.mode === 'buffered' ? 'screen reader mode' : 'screen reader mode is off'
    return `Whole answer delivery ${state} (${why}).`
  },
  streamSet(mode: DeliveryMode): string {
    return mode === 'buffered'
      ? 'Whole answer delivery on (forced). Answers appear whole; thinking is hidden.'
      : 'Whole answer delivery off (forced). Answers stream live.'
  },
  streamAuto(): string {
    return 'Override removed.'
  },
  streamInvalid(): string {
    return 'Usage: /a11y-stream, /a11y-stream on, /a11y-stream off, or /a11y-stream auto.'
  },
  toolsReport(args: { mode: ToolNarrationMode; source: DeliverySource }): string {
    const why = args.source === 'override' ? 'forced' : args.mode === 'off' ? 'whole answer delivery' : 'whole answer delivery is off'
    return `Tool narration ${args.mode} (${why}).`
  },
  toolsSet(mode: ToolNarrationMode): string {
    switch (mode) {
      case 'off':
        return 'Tool narration off (forced). Tool calls and results are not shown; /a11y-last still prints a recent result.'
      case 'brief':
        return 'Tool narration brief (forced). One line per tool call and a count per result.'
      case 'full':
        return 'Tool narration full (forced). Tool rows are drawn by Claude Code itself.'
    }
  },
  toolsAuto(): string {
    return 'Override removed.'
  },
  toolsInvalid(): string {
    return 'Usage: /a11y-tools, /a11y-tools off, /a11y-tools brief, /a11y-tools full, or /a11y-tools auto.'
  },
  heartbeat(seconds: number): string {
    return `Still working, ${seconds} seconds.`
  },
  heartbeatReport(seconds: number): string {
    return seconds === 0 ? 'Heartbeat off.' : `Heartbeat every ${seconds} seconds of silence while an answer is being prepared, in screen reader mode.`
  },
  heartbeatSet(seconds: number): string {
    return seconds === 0 ? 'Heartbeat off.' : `Heartbeat set to every ${seconds} seconds of silence.`
  },
  heartbeatInvalid(): string {
    return 'Usage: /a11y-heartbeat, /a11y-heartbeat <seconds> (5 to 600), or /a11y-heartbeat off.'
  },
  logReport(on: boolean): string {
    return on ? 'Render log on. Every drawn component is written to the debug log of a session started with claude --debug.' : 'Render log off.'
  },
  logInvalid(): string {
    return 'Usage: /a11y-log, /a11y-log on, or /a11y-log off.'
  },
  lastHeader(summary: string): string {
    return `Result of: ${summary}`
  },
  lastNone(): string {
    return 'No tool result stored yet.'
  },
  lastOutOfRange(kept: number): string {
    return kept === 1 ? 'Only 1 result is kept; ask for 1.' : `Only ${kept} results are kept; ask for 1 to ${kept}.`
  },
  lastInvalid(): string {
    return 'Usage: /a11y-last or /a11y-last <n>.'
  },
  error(kind: 'no-home' | 'invalid-json' | 'not-an-object' | 'write-failed' | 'verify-mismatch', path: string | undefined): string {
    switch (kind) {
      case 'no-home':
        return `Could not find your home directory, so the settings file could not be updated. ${fallback(path)}`
      case 'invalid-json':
        return `Could not update the settings file: it is not valid JSON. The file was left unchanged. ${fallback(path)}`
      case 'not-an-object':
        return `Could not update the settings file: its top level is not an object. The file was left unchanged. ${fallback(path)}`
      case 'write-failed':
        return `Could not write the settings file. ${fallback(path)}`
      case 'verify-mismatch':
        return `The settings file did not read back as written. Check it by hand. ${fallback(path)}`
    }
  },
}
