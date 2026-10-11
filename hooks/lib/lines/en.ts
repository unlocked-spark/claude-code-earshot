import type { ModeSource } from '../types'
import { nameOf, SETTINGS_FILE } from './types'
import type { Messages } from './types'

const FALLBACK = 'a screen reader'

function detected(reader: Parameters<Messages['question']>[0]): string {
  return reader === 'unknown' ? 'A screen reader was detected.' : `${nameOf(reader, FALLBACK)} detected.`
}

const SOURCE: Record<ModeSource, string> = {
  env: 'the CLAUDE_AX_SCREEN_READER variable',
  'settings-user': 'your settings file',
  'settings-other': 'project or managed settings',
  off: 'nothing',
}

export const en: Messages = {
  readerFallback: FALLBACK,
  question: (reader) => `${detected(reader)} Enable Claude Code screen reader mode from the next start? Press y or n.`,
  enabled: () => 'Earshot on. Your previous settings are saved; from the next start screen reader mode is on and tips are off. Restart Claude Code now.',
  declined: () => 'Understood. Screen reader mode stays off. Run /earshot-on at any time to enable it.',
  withdrawn: () => 'No answer, leaving screen reader mode off for this session.',
  answered: () => 'Answered.',
  answerReady: () => 'Answer ready.',
  offDone: () => 'Earshot off. The settings it changed are restored from the next start.',
  offAlready: () => 'Earshot is already off; nothing changed.',
  offElsewhere: () => 'Screen reader mode stays on: it is set in project or managed settings, or by the CLAUDE_AX_SCREEN_READER variable.',
  status({ active, detection, mode, consent }) {
    const parts: string[] = [active ? 'Earshot on.' : 'Earshot off.']
    if (detection === undefined) parts.push('Detection has not run.')
    else if (detection.reader !== null) parts.push(detected(detection.reader))
    else if (detection.error !== undefined) parts.push(`Detection failed: ${detection.error}.`)
    else parts.push('No screen reader detected.')
    if (mode === undefined) parts.push('Screen reader mode state unknown.')
    else if (mode.on) parts.push(`Screen reader mode on, set by ${SOURCE[mode.source]}.`)
    else if (mode.source === 'env') {
      parts.push('Screen reader mode off, set by the CLAUDE_AX_SCREEN_READER variable. The mod will not change settings while the variable is set.')
    } else if (mode.userSetting === false) parts.push('Screen reader mode off, set to false in your settings file.')
    else parts.push('Screen reader mode off.')
    if (consent === undefined) parts.push('No refusal stored.')
    else parts.push(`Refusal stored on ${consent.declinedAt.slice(0, 10)}, mod version ${consent.modVersion}.`)
    return parts.join(' ')
  },
  streamReport({ mode, source }) {
    const state = mode === 'buffered' ? 'on' : 'off'
    const why = source === 'override' ? 'forced' : mode === 'buffered' ? 'screen reader mode' : 'screen reader mode is off'
    return `Whole answer delivery ${state} (${why}).`
  },
  streamSet: (mode) =>
    mode === 'buffered'
      ? 'Whole answer delivery on (forced). Answers appear whole; thinking is hidden.'
      : 'Whole answer delivery off (forced). Answers stream live.',
  streamAuto: () => 'Override removed.',
  streamInvalid: () => 'Usage: /earshot-stream, /earshot-stream on, /earshot-stream off, or /earshot-stream auto.',
  toolsReport({ mode, source }) {
    const why = source === 'override' ? 'forced' : mode === 'off' ? 'whole answer delivery' : 'whole answer delivery is off'
    return `Tool narration ${mode} (${why}).`
  },
  toolsSet(mode) {
    switch (mode) {
      case 'off':
        return 'Tool narration off (forced). Tool calls and results are not shown; /earshot-last still prints a recent result.'
      case 'brief':
        return 'Tool narration brief (forced). One line per tool call and a count per result.'
      case 'full':
        return 'Tool narration full (forced). Tool rows are drawn by Claude Code itself.'
    }
  },
  toolsAuto: () => 'Override removed.',
  toolsInvalid: () => 'Usage: /earshot-tools, /earshot-tools off, /earshot-tools brief, /earshot-tools full, or /earshot-tools auto.',
  toolLabel: (label) => label,
  resultLine: (isErrored, lines) => `${isErrored ? 'error' : 'result'}: ${lines} ${lines === 1 ? 'line' : 'lines'}`,
  heartbeat: (seconds) => `Still working, ${seconds} seconds.`,
  heartbeatReport: (seconds) =>
    seconds === 0 ? 'Heartbeat off.' : `Heartbeat every ${seconds} seconds of silence while an answer is being prepared, in screen reader mode.`,
  heartbeatSet: (seconds) => (seconds === 0 ? 'Heartbeat off.' : `Heartbeat set to every ${seconds} seconds of silence.`),
  heartbeatInvalid: () => 'Usage: /earshot-heartbeat, /earshot-heartbeat <seconds> (5 to 600), or /earshot-heartbeat off.',
  logReport: (on) =>
    on ? 'Render log on. Every drawn component is written to the debug log of a session started with claude --debug.' : 'Render log off.',
  logInvalid: () => 'Usage: /earshot-log, /earshot-log on, or /earshot-log off.',
  lastHeader: (summary) => `Result of: ${summary}`,
  lastNone: () => 'No tool result stored yet.',
  lastOutOfRange: (kept) => (kept === 1 ? 'Only 1 result is kept; ask for 1.' : `Only ${kept} results are kept; ask for 1 to ${kept}.`),
  lastInvalid: () => 'Usage: /earshot-last or /earshot-last <n>.',
  error(kind, path) {
    const fallback = `Add "axScreenReader": true to ${path ?? SETTINGS_FILE} by hand, or set CLAUDE_AX_SCREEN_READER=1 in your shell profile.`
    switch (kind) {
      case 'no-home':
        return `Could not find your home directory, so the settings file could not be updated. ${fallback}`
      case 'invalid-json':
        return `Could not update the settings file: it is not valid JSON. The file was left unchanged. ${fallback}`
      case 'not-an-object':
        return `Could not update the settings file: its top level is not an object. The file was left unchanged. ${fallback}`
      case 'write-failed':
        return `Could not write the settings file. ${fallback}`
      case 'verify-mismatch':
        return `The settings file did not read back as written. Check it by hand. ${fallback}`
    }
  },
  commandDescriptions: {
    'earshot-on': 'Turn Earshot on: save your settings, then screen reader mode on and tips off from the next start',
    'earshot-off': 'Turn Earshot off and restore the settings it changed',
    'earshot-status': 'Report the detected screen reader and the screen reader mode state',
    'earshot-stream': 'Whole answer delivery: show each answer at once instead of streaming it',
    'earshot-tools': 'Tool narration: hide tool rows, show one line per call, or leave them to Claude Code',
    'earshot-last': 'Print the full text of a recent tool result',
    'earshot-log': 'Render log: write every drawn component to the debug log',
    'earshot-heartbeat': 'Say every N seconds of silence that work goes on',
  },
}
