import type { ModeSource, ToolLabel, ToolNarrationMode } from '../types'
import { nameOf, SETTINGS_FILE } from './types'
import type { Messages } from './types'

const FALLBACK = 'ein Screenreader'

const sekunden = (n: number) => `${n} ${n === 1 ? 'Sekunde' : 'Sekunden'}`

const SOURCE: Record<ModeSource, string> = {
  env: 'die Variable CLAUDE_AX_SCREEN_READER',
  'settings-user': 'deine Einstellungsdatei',
  'settings-other': 'Projekt- oder verwaltete Einstellungen',
  off: 'nichts',
}

const TOOLS: Record<ToolNarrationMode, string> = { off: 'aus', brief: 'kurz', full: 'vollständig' }

const LABELS: Record<ToolLabel, string> = {
  tool: 'Werkzeug',
  'tool error': 'Werkzeugfehler',
  'tool running': 'Werkzeug läuft',
  'tool interrupted': 'Werkzeug unterbrochen',
}

function detected(reader: Parameters<Messages['question']>[0]): string {
  return reader === 'unknown' ? 'Ein Screenreader wurde erkannt.' : `${nameOf(reader, FALLBACK)} erkannt.`
}

export const de: Messages = {
  readerFallback: FALLBACK,
  question: (reader) => `${detected(reader)} Den Screenreader-Modus von Claude Code ab dem nächsten Start einschalten? Drücke j oder n.`,
  enabled: () => 'Earshot an. Deine bisherigen Einstellungen sind gespeichert. Ab dem nächsten Start ist der Screenreader-Modus an und die Tipps sind aus. Starte Claude Code jetzt neu.',
  declined: () => 'Verstanden. Der Screenreader-Modus bleibt aus. Mit /earshot-on kannst du ihn jederzeit einschalten.',
  withdrawn: () => 'Keine Antwort. Der Screenreader-Modus bleibt in dieser Sitzung aus.',
  answered: () => 'Beantwortet.',
  answerReady: () => 'Antwort fertig.',
  offDone: () => 'Earshot aus. Die geänderten Einstellungen sind ab dem nächsten Start wiederhergestellt.',
  offAlready: () => 'Earshot ist bereits aus. Nichts geändert.',
  offElsewhere: () => 'Der Screenreader-Modus bleibt an: Er ist in Projekt- oder verwalteten Einstellungen oder durch die Variable CLAUDE_AX_SCREEN_READER gesetzt.',
  status({ active, detection, mode, consent }) {
    const parts: string[] = [active ? 'Earshot an.' : 'Earshot aus.']
    if (detection === undefined) parts.push('Die Erkennung ist noch nicht gelaufen.')
    else if (detection.reader !== null) parts.push(detected(detection.reader))
    else if (detection.error !== undefined) parts.push(`Erkennung fehlgeschlagen: ${detection.error}.`)
    else parts.push('Kein Screenreader erkannt.')
    if (mode === undefined) parts.push('Zustand des Screenreader-Modus unbekannt.')
    else if (mode.on) parts.push(`Screenreader-Modus an, gesetzt durch ${SOURCE[mode.source]}.`)
    else if (mode.source === 'env') {
      parts.push('Screenreader-Modus aus, gesetzt durch die Variable CLAUDE_AX_SCREEN_READER. Solange sie gesetzt ist, ändert der Mod keine Einstellungen.')
    } else if (mode.userSetting === false) parts.push('Screenreader-Modus aus, in deiner Einstellungsdatei auf false gesetzt.')
    else parts.push('Screenreader-Modus aus.')
    if (consent === undefined) parts.push('Keine Ablehnung gespeichert.')
    else parts.push(`Ablehnung gespeichert am ${consent.declinedAt.slice(0, 10)}, Mod-Version ${consent.modVersion}.`)
    return parts.join(' ')
  },
  streamReport({ mode, source }) {
    const state = mode === 'buffered' ? 'an' : 'aus'
    const why = source === 'override' ? 'erzwungen' : mode === 'buffered' ? 'Screenreader-Modus' : 'Screenreader-Modus ist aus'
    return `Ganze Antworten ${state} (${why}).`
  },
  streamSet: (mode) =>
    mode === 'buffered'
      ? 'Ganze Antworten an (erzwungen). Jede Antwort erscheint auf einmal, das Nachdenken ist verborgen.'
      : 'Ganze Antworten aus (erzwungen). Antworten erscheinen laufend.',
  streamAuto: () => 'Erzwingung entfernt.',
  streamInvalid: () => 'Verwendung: /earshot-stream, /earshot-stream on, /earshot-stream off oder /earshot-stream auto.',
  toolsReport({ mode, source }) {
    const why = source === 'override' ? 'erzwungen' : mode === 'off' ? 'ganze Antworten' : 'ganze Antworten sind aus'
    return `Werkzeugansage ${TOOLS[mode]} (${why}).`
  },
  toolsSet(mode) {
    switch (mode) {
      case 'off':
        return 'Werkzeugansage aus (erzwungen). Werkzeugaufrufe und Ergebnisse werden nicht gezeigt. /earshot-last gibt weiterhin ein letztes Ergebnis aus.'
      case 'brief':
        return 'Werkzeugansage kurz (erzwungen). Eine Zeile pro Aufruf und eine Zeilenzahl pro Ergebnis.'
      case 'full':
        return 'Werkzeugansage vollständig (erzwungen). Claude Code zeichnet die Werkzeugzeilen selbst.'
    }
  },
  toolsAuto: () => 'Erzwingung entfernt.',
  toolsInvalid: () => 'Verwendung: /earshot-tools, /earshot-tools off, /earshot-tools brief, /earshot-tools full oder /earshot-tools auto.',
  toolLabel: (label) => LABELS[label],
  resultLine: (isErrored, lines) => `${isErrored ? 'Fehler' : 'Ergebnis'}: ${lines} ${lines === 1 ? 'Zeile' : 'Zeilen'}`,
  welcome: () => 'Willkommen bei Earshot für Claude Code. Zum Ausschalten /earshot-off eingeben.',
  working: () => 'Ich beginne mit der Arbeit.',
  heartbeat: (n) => `Arbeite noch, ${sekunden(n)}.`,
  heartbeatReport: (n) =>
    n === 0 ? 'Lebenszeichen aus.' : `Lebenszeichen nach je ${sekunden(n)} Stille, während eine Antwort entsteht, im Screenreader-Modus.`,
  heartbeatSet: (n) => (n === 0 ? 'Lebenszeichen aus.' : `Lebenszeichen auf je ${sekunden(n)} Stille gesetzt.`),
  heartbeatInvalid: () => 'Verwendung: /earshot-heartbeat, /earshot-heartbeat <Sekunden> (5 bis 600) oder /earshot-heartbeat off.',
  logReport: (on) =>
    on
      ? 'Render-Protokoll an. Jedes gezeichnete Element landet im Debug-Protokoll einer mit claude --debug gestarteten Sitzung.'
      : 'Render-Protokoll aus.',
  logInvalid: () => 'Verwendung: /earshot-log, /earshot-log on oder /earshot-log off.',
  lastHeader: (summary) => `Ergebnis von: ${summary}`,
  lastNone: () => 'Noch kein Werkzeugergebnis gespeichert.',
  lastOutOfRange: (kept) =>
    kept === 1 ? 'Nur 1 Ergebnis ist gespeichert. Frage nach 1.' : `Nur ${kept} Ergebnisse sind gespeichert. Frage nach 1 bis ${kept}.`,
  lastInvalid: () => 'Verwendung: /earshot-last oder /earshot-last <n>.',
  error(kind, path) {
    const fallback = `Trage "axScreenReader": true von Hand in ${path ?? SETTINGS_FILE} ein oder setze CLAUDE_AX_SCREEN_READER=1 in deinem Shell-Profil.`
    switch (kind) {
      case 'no-home':
        return `Dein Home-Verzeichnis wurde nicht gefunden, daher konnte die Einstellungsdatei nicht geändert werden. ${fallback}`
      case 'invalid-json':
        return `Die Einstellungsdatei konnte nicht geändert werden, sie ist kein gültiges JSON. Die Datei blieb unverändert. ${fallback}`
      case 'not-an-object':
        return `Die Einstellungsdatei konnte nicht geändert werden, ihre oberste Ebene ist kein Objekt. Die Datei blieb unverändert. ${fallback}`
      case 'write-failed':
        return `Die Einstellungsdatei konnte nicht geschrieben werden. ${fallback}`
      case 'verify-mismatch':
        return `Die Einstellungsdatei liest sich nicht so, wie sie geschrieben wurde. Prüfe sie von Hand. ${fallback}`
    }
  },
  commandDescriptions: {
    'earshot-on': 'Earshot einschalten: Einstellungen sichern, Screenreader-Modus an und Tipps aus ab dem nächsten Start',
    'earshot-off': 'Earshot ausschalten und die geänderten Einstellungen wiederherstellen',
    'earshot-status': 'Erkannten Screenreader und Zustand des Screenreader-Modus melden',
    'earshot-stream': 'Ganze Antworten: jede Antwort auf einmal zeigen statt laufend',
    'earshot-tools': 'Werkzeugansage: Werkzeugzeilen verbergen, eine Zeile pro Aufruf zeigen oder Claude Code überlassen',
    'earshot-last': 'Den vollen Text eines letzten Werkzeugergebnisses ausgeben',
    'earshot-log': 'Render-Protokoll: jedes gezeichnete Element ins Debug-Protokoll schreiben',
    'earshot-heartbeat': 'Nach je N Sekunden Stille sagen, dass die Arbeit weitergeht',
  },
}
