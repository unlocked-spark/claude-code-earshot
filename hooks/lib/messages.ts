import type { DeliveryMode, DeliverySource, DetectionResult, ModeState, Reader, StoredConsent } from './types'

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
  streamReport(_args: { mode: DeliveryMode; source: DeliverySource }): string {
    throw new Error('not implemented')
  },
  streamSet(_mode: DeliveryMode): string {
    throw new Error('not implemented')
  },
  streamAuto(): string {
    throw new Error('not implemented')
  },
  streamInvalid(): string {
    throw new Error('not implemented')
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
