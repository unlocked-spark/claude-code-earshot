import type { ModeSource, ToolLabel, ToolNarrationMode } from '../types'
import { nameOf, polishPlural, SETTINGS_FILE } from './types'
import type { Messages } from './types'

const FALLBACK = 'czytnik ekranu'

// "Nadal pracuję, 22 sekundy." and "co 22 sekundy ciszy" differ for a count
// of one: sekunda after a comma, sekundę after "co".
const sekundy = (n: number) => `${n} ${polishPlural(n, 'sekunda', 'sekundy', 'sekund')}`
const coSekund = (n: number) => `${n} ${polishPlural(n, 'sekundę', 'sekundy', 'sekund')}`

const SOURCE: Record<ModeSource, string> = {
  env: 'zmienną CLAUDE_AX_SCREEN_READER',
  'settings-user': 'Twój plik ustawień',
  'settings-other': 'ustawienia projektu lub organizacji',
  off: 'nic',
}

const TOOLS: Record<ToolNarrationMode, string> = { off: 'wyłączona', brief: 'skrócona', full: 'pełna' }

const LABELS: Record<ToolLabel, string> = {
  tool: 'narzędzie',
  'tool error': 'błąd narzędzia',
  'tool running': 'narzędzie działa',
  'tool interrupted': 'narzędzie przerwane',
}

export const pl: Messages = {
  readerFallback: FALLBACK,
  question: (reader) =>
    `Wykryto ${nameOf(reader, FALLBACK)}. Włączyć tryb czytnika ekranu w Claude Code od następnego uruchomienia? Naciśnij t albo n.`,
  enabled: () => 'Tryb czytnika ekranu włączony od następnego uruchomienia. Uruchom teraz Claude Code ponownie.',
  declined: () => 'Rozumiem. Tryb czytnika ekranu pozostaje wyłączony. Możesz go włączyć w każdej chwili poleceniem /a11y-on.',
  withdrawn: () => 'Brak odpowiedzi. Tryb czytnika ekranu pozostaje wyłączony w tej sesji.',
  answered: () => 'Odpowiedziano.',
  answerReady: () => 'Odpowiedź gotowa.',
  offDone: () => 'Tryb czytnika ekranu wyłączony od następnego uruchomienia.',
  offNothing: () => 'Tryb czytnika ekranu nie był ustawiony w Twoim pliku ustawień. Nic nie zmieniono.',
  offElsewhere: () => 'Tryb czytnika ekranu jest ustawiony w ustawieniach projektu lub organizacji, nie w Twoim pliku ustawień. Nic nie zmieniono.',
  status({ detection, mode, consent }) {
    const parts: string[] = []
    if (detection === undefined) parts.push('Wykrywanie jeszcze się nie odbyło.')
    else if (detection.reader !== null) parts.push(`Wykryto ${nameOf(detection.reader, FALLBACK)}.`)
    else if (detection.error !== undefined) parts.push(`Wykrywanie nie powiodło się: ${detection.error}.`)
    else parts.push('Nie wykryto czytnika ekranu.')
    if (mode === undefined) parts.push('Stan trybu czytnika ekranu nieznany.')
    else if (mode.on) parts.push(`Tryb czytnika ekranu włączony przez ${SOURCE[mode.source]}.`)
    else if (mode.source === 'env') {
      parts.push('Tryb czytnika ekranu wyłączony przez zmienną CLAUDE_AX_SCREEN_READER. Dopóki jest ustawiona, mod nie zmienia ustawień.')
    } else if (mode.userSetting === false) parts.push('Tryb czytnika ekranu wyłączony, w Twoim pliku ustawień ma wartość false.')
    else parts.push('Tryb czytnika ekranu wyłączony.')
    if (consent === undefined) parts.push('Brak zapisanej odmowy.')
    else parts.push(`Odmowa zapisana ${consent.declinedAt.slice(0, 10)}, wersja moda ${consent.modVersion}.`)
    return parts.join(' ')
  },
  streamReport({ mode, source }) {
    const state = mode === 'buffered' ? 'włączone' : 'wyłączone'
    const why = source === 'override' ? 'wymuszone' : mode === 'buffered' ? 'tryb czytnika ekranu' : 'tryb czytnika ekranu jest wyłączony'
    return `Odpowiedzi w całości ${state} (${why}).`
  },
  streamSet: (mode) =>
    mode === 'buffered'
      ? 'Odpowiedzi w całości włączone (wymuszone). Każda odpowiedź pojawia się naraz, myślenie jest ukryte.'
      : 'Odpowiedzi w całości wyłączone (wymuszone). Odpowiedzi pojawiają się na bieżąco.',
  streamAuto: () => 'Wymuszenie usunięte.',
  streamInvalid: () => 'Użycie: /a11y-stream, /a11y-stream on, /a11y-stream off albo /a11y-stream auto.',
  toolsReport({ mode, source }) {
    const why = source === 'override' ? 'wymuszone' : mode === 'off' ? 'odpowiedzi w całości' : 'odpowiedzi w całości są wyłączone'
    return `Narracja narzędzi ${TOOLS[mode]} (${why}).`
  },
  toolsSet(mode) {
    switch (mode) {
      case 'off':
        return 'Narracja narzędzi wyłączona (wymuszone). Wywołania narzędzi i wyniki nie są pokazywane. /a11y-last nadal wypisuje ostatni wynik.'
      case 'brief':
        return 'Narracja narzędzi skrócona (wymuszone). Jeden wiersz na wywołanie i liczba wierszy wyniku.'
      case 'full':
        return 'Narracja narzędzi pełna (wymuszone). Wiersze narzędzi rysuje sam Claude Code.'
    }
  },
  toolsAuto: () => 'Wymuszenie usunięte.',
  toolsInvalid: () => 'Użycie: /a11y-tools, /a11y-tools off, /a11y-tools brief, /a11y-tools full albo /a11y-tools auto.',
  toolLabel: (label) => LABELS[label],
  resultLine: (isErrored, lines) => `${isErrored ? 'błąd' : 'wynik'}: ${lines} ${polishPlural(lines, 'wiersz', 'wiersze', 'wierszy')}`,
  heartbeat: (n) => `Nadal pracuję, ${sekundy(n)}.`,
  heartbeatReport: (n) =>
    n === 0 ? 'Sygnał pracy wyłączony.' : `Sygnał pracy co ${coSekund(n)} ciszy podczas przygotowywania odpowiedzi, w trybie czytnika ekranu.`,
  heartbeatSet: (n) => (n === 0 ? 'Sygnał pracy wyłączony.' : `Sygnał pracy ustawiony co ${coSekund(n)} ciszy.`),
  heartbeatInvalid: () => 'Użycie: /a11y-heartbeat, /a11y-heartbeat <sekundy> (od 5 do 600) albo /a11y-heartbeat off.',
  logReport: (on) =>
    on
      ? 'Log renderowania włączony. Każdy rysowany element trafia do logu debug sesji uruchomionej przez claude --debug.'
      : 'Log renderowania wyłączony.',
  logInvalid: () => 'Użycie: /a11y-log, /a11y-log on albo /a11y-log off.',
  lastHeader: (summary) => `Wynik: ${summary}`,
  lastNone: () => 'Nie zapisano jeszcze żadnego wyniku narzędzia.',
  lastOutOfRange: (kept) =>
    kept === 1 ? 'Zapisany jest tylko 1 wynik. Poproś o 1.' : `Zapisane są tylko ostatnie wyniki, ${kept}. Poproś o numer od 1 do ${kept}.`,
  lastInvalid: () => 'Użycie: /a11y-last albo /a11y-last <n>.',
  error(kind, path) {
    const fallback = `Dopisz ręcznie "axScreenReader": true do ${path ?? SETTINGS_FILE} albo ustaw CLAUDE_AX_SCREEN_READER=1 w profilu powłoki.`
    switch (kind) {
      case 'no-home':
        return `Nie znaleziono katalogu domowego, więc nie można zmienić pliku ustawień. ${fallback}`
      case 'invalid-json':
        return `Nie można zmienić pliku ustawień, bo nie jest poprawnym JSON. Plik pozostał bez zmian. ${fallback}`
      case 'not-an-object':
        return `Nie można zmienić pliku ustawień, bo jego najwyższy poziom nie jest obiektem. Plik pozostał bez zmian. ${fallback}`
      case 'write-failed':
        return `Nie można zapisać pliku ustawień. ${fallback}`
      case 'verify-mismatch':
        return `Plik ustawień po zapisie ma inną treść niż zapisana. Sprawdź go ręcznie. ${fallback}`
    }
  },
  commandDescriptions: {
    'a11y-on': 'Włącz tryb czytnika ekranu w Claude Code od następnego uruchomienia',
    'a11y-off': 'Wyłącz tryb czytnika ekranu w Claude Code od następnego uruchomienia',
    'a11y-status': 'Podaj wykryty czytnik ekranu i stan trybu czytnika ekranu',
    'a11y-stream': 'Odpowiedzi w całości: pokazuj każdą odpowiedź naraz zamiast na bieżąco',
    'a11y-tools': 'Narracja narzędzi: ukryj wiersze narzędzi, pokaż jeden wiersz na wywołanie albo zostaw je Claude Code',
    'a11y-last': 'Wypisz pełny tekst ostatniego wyniku narzędzia',
    'a11y-log': 'Log renderowania: zapisuj każdy rysowany element do logu debug',
    'a11y-heartbeat': 'Mów co N sekund ciszy, że praca trwa',
  },
}
