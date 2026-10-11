import type { ModeSource, ToolLabel, ToolNarrationMode } from '../types'
import { nameOf, SETTINGS_FILE } from './types'
import type { Messages } from './types'

const FALLBACK = 'un lettore di schermo'

const secondi = (n: number) => `${n} ${n === 1 ? 'secondo' : 'secondi'}`

const SOURCE: Record<ModeSource, string> = {
  env: 'la variabile CLAUDE_AX_SCREEN_READER',
  'settings-user': 'il tuo file di impostazioni',
  'settings-other': 'le impostazioni del progetto o gestite',
  off: 'niente',
}

const TOOLS: Record<ToolNarrationMode, string> = { off: 'disattivata', brief: 'breve', full: 'completa' }

const LABELS: Record<ToolLabel, string> = {
  tool: 'strumento',
  'tool error': 'errore dello strumento',
  'tool running': 'strumento in esecuzione',
  'tool interrupted': 'strumento interrotto',
}

function detected(reader: Parameters<Messages['question']>[0]): string {
  return reader === 'unknown' ? 'È stato rilevato un lettore di schermo.' : `${nameOf(reader, FALLBACK)} rilevato.`
}

export const it: Messages = {
  readerFallback: FALLBACK,
  question: (reader) => `${detected(reader)} Attivare la modalità lettore di schermo di Claude Code dal prossimo avvio? Premi s o n.`,
  enabled: () => 'Earshot attivo. Le impostazioni precedenti sono salvate. Dal prossimo avvio la modalità lettore di schermo è attiva e i suggerimenti sono nascosti. Riavvia Claude Code ora.',
  declined: () => 'Capito. La modalità lettore di schermo resta disattivata. Esegui /earshot-on in qualsiasi momento per attivarla.',
  withdrawn: () => 'Nessuna risposta. La modalità lettore di schermo resta disattivata in questa sessione.',
  answered: () => 'Risposto.',
  answerReady: () => 'Risposta pronta.',
  offDone: () => 'Earshot disattivato. Le impostazioni modificate vengono ripristinate dal prossimo avvio.',
  offAlready: () => 'Earshot è già disattivato. Nulla è cambiato.',
  offElsewhere: () => 'La modalità lettore di schermo resta attiva: è impostata nelle impostazioni del progetto o gestite, o dalla variabile CLAUDE_AX_SCREEN_READER.',
  status({ active, detection, mode, consent }) {
    const parts: string[] = [active ? 'Earshot attivo.' : 'Earshot disattivato.']
    if (detection === undefined) parts.push('Il rilevamento non è ancora stato eseguito.')
    else if (detection.reader !== null) parts.push(detected(detection.reader))
    else if (detection.error !== undefined) parts.push(`Rilevamento non riuscito: ${detection.error}.`)
    else parts.push('Nessun lettore di schermo rilevato.')
    if (mode === undefined) parts.push('Stato della modalità lettore di schermo sconosciuto.')
    else if (mode.on) parts.push(`Modalità lettore di schermo attiva, impostata da ${SOURCE[mode.source]}.`)
    else if (mode.source === 'env') {
      parts.push(
        'Modalità lettore di schermo disattivata dalla variabile CLAUDE_AX_SCREEN_READER. Finché è impostata, il mod non cambia le impostazioni.',
      )
    } else if (mode.userSetting === false) parts.push('Modalità lettore di schermo disattivata, impostata su false nel tuo file di impostazioni.')
    else parts.push('Modalità lettore di schermo disattivata.')
    if (consent === undefined) parts.push('Nessun rifiuto salvato.')
    else parts.push(`Rifiuto salvato il ${consent.declinedAt.slice(0, 10)}, versione del mod ${consent.modVersion}.`)
    return parts.join(' ')
  },
  streamReport({ mode, source }) {
    const state = mode === 'buffered' ? 'attive' : 'disattivate'
    const why = source === 'override' ? 'forzato' : mode === 'buffered' ? 'modalità lettore di schermo' : 'la modalità lettore di schermo è disattivata'
    return `Risposte intere ${state} (${why}).`
  },
  streamSet: (mode) =>
    mode === 'buffered'
      ? 'Risposte intere attive (forzato). Ogni risposta appare tutta insieme e il ragionamento è nascosto.'
      : 'Risposte intere disattivate (forzato). Le risposte appaiono man mano.',
  streamAuto: () => 'Forzatura rimossa.',
  streamInvalid: () => 'Uso: /earshot-stream, /earshot-stream on, /earshot-stream off o /earshot-stream auto.',
  toolsReport({ mode, source }) {
    const why = source === 'override' ? 'forzato' : mode === 'off' ? 'risposte intere' : 'le risposte intere sono disattivate'
    return `Narrazione degli strumenti ${TOOLS[mode]} (${why}).`
  },
  toolsSet(mode) {
    switch (mode) {
      case 'off':
        return 'Narrazione degli strumenti disattivata (forzato). Chiamate e risultati non vengono mostrati. /earshot-last stampa comunque un risultato recente.'
      case 'brief':
        return 'Narrazione degli strumenti breve (forzato). Una riga per chiamata e un conteggio per risultato.'
      case 'full':
        return 'Narrazione degli strumenti completa (forzato). Claude Code disegna da sé le righe degli strumenti.'
    }
  },
  toolsAuto: () => 'Forzatura rimossa.',
  toolsInvalid: () => 'Uso: /earshot-tools, /earshot-tools off, /earshot-tools brief, /earshot-tools full o /earshot-tools auto.',
  toolLabel: (label) => LABELS[label],
  resultLine: (isErrored, lines) => `${isErrored ? 'errore' : 'risultato'}: ${lines} ${lines === 1 ? 'riga' : 'righe'}`,
  welcome: () => 'Ti diamo il benvenuto in Earshot per Claude Code. Per disattivarlo, digita /earshot-off.',
  working: () => 'Inizio a lavorare.',
  heartbeat: (n) => `Sto ancora lavorando, ${secondi(n)}.`,
  heartbeatReport: (n) =>
    n === 0
      ? 'Segnale di lavoro disattivato.'
      : `Segnale di lavoro ogni ${secondi(n)} di silenzio mentre si prepara una risposta, in modalità lettore di schermo.`,
  heartbeatSet: (n) => (n === 0 ? 'Segnale di lavoro disattivato.' : `Segnale di lavoro impostato ogni ${secondi(n)} di silenzio.`),
  heartbeatInvalid: () => 'Uso: /earshot-heartbeat, /earshot-heartbeat <secondi> (da 5 a 600) o /earshot-heartbeat off.',
  logReport: (on) =>
    on
      ? 'Registro di disegno attivo. Ogni elemento disegnato viene scritto nel registro di debug di una sessione avviata con claude --debug.'
      : 'Registro di disegno disattivato.',
  logInvalid: () => 'Uso: /earshot-log, /earshot-log on o /earshot-log off.',
  lastHeader: (summary) => `Risultato di: ${summary}`,
  lastNone: () => 'Nessun risultato di strumento ancora salvato.',
  lastOutOfRange: (kept) =>
    kept === 1 ? 'Viene conservato solo 1 risultato. Chiedi l’1.' : `Vengono conservati solo ${kept} risultati. Chiedi da 1 a ${kept}.`,
  lastInvalid: () => 'Uso: /earshot-last o /earshot-last <n>.',
  error(kind, path) {
    const fallback = `Aggiungi a mano "axScreenReader": true in ${path ?? SETTINGS_FILE}, oppure imposta CLAUDE_AX_SCREEN_READER=1 nel profilo della shell.`
    switch (kind) {
      case 'no-home':
        return `Cartella home non trovata, quindi il file di impostazioni non è stato modificato. ${fallback}`
      case 'invalid-json':
        return `Impossibile modificare il file di impostazioni: non è JSON valido. Il file non è stato modificato. ${fallback}`
      case 'not-an-object':
        return `Impossibile modificare il file di impostazioni: il livello superiore non è un oggetto. Il file non è stato modificato. ${fallback}`
      case 'write-failed':
        return `Impossibile scrivere il file di impostazioni. ${fallback}`
      case 'verify-mismatch':
        return `Il file di impostazioni non si rilegge come è stato scritto. Controllalo a mano. ${fallback}`
    }
  },
  commandDescriptions: {
    'earshot-on': 'Attivare Earshot: salvare le impostazioni, attivare la modalità lettore di schermo e nascondere i suggerimenti dal prossimo avvio',
    'earshot-off': 'Disattivare Earshot e ripristinare le impostazioni modificate',
    'earshot-status': 'Indicare il lettore di schermo rilevato e lo stato della modalità lettore di schermo',
    'earshot-stream': 'Risposte intere: mostrare ogni risposta tutta insieme invece che man mano',
    'earshot-tools': 'Narrazione degli strumenti: nascondere le righe, una riga per chiamata o lasciarle a Claude Code',
    'earshot-last': 'Stampare il testo completo di un risultato di strumento recente',
    'earshot-log': 'Registro di disegno: scrivere ogni elemento disegnato nel registro di debug',
    'earshot-heartbeat': 'Dire ogni N secondi di silenzio che il lavoro continua',
  },
}
