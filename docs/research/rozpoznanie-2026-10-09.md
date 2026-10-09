# Dostępność Claude Code dla niewidomych programistów. Rozpoznanie

Stan na 2026-10-09. Sprawdzone: dokumentacja code.claude.com, zgłoszenia w repozytorium anthropics/claude-code, plik typów API modów dla wersji 2.1.295, oficjalny marketplace wtyczek, katalogi modów (slopshopper.com, FindMods.dev, k-mods), GitHub.

## 1. Co Claude Code ma już dziś

### Tryb czytnika ekranu (opcjonalny)

Włączanie, w kolejności pierwszeństwa: flaga `--ax-screen-reader`, zmienna `CLAUDE_AX_SCREEN_READER=1`, ustawienie `"axScreenReader": true` w settings.json. Wymaga wersji 2.1.181 lub nowszej. Pierwsza linia sesji to `[Screen Reader Mode: on via flag|env|settings]`.

Co zmienia: płaski tekst bez ramek, statyczne spinnery, tabele jako zdania `Nagłówek: wartość`, diffy jako linie z plusem i minusem, etykiety na początku linii (`you:`, `claude:`, `thinking:`, `tool:`, `tool error:`, `error:`, `warning:`, `Permission Required:`, `Cost:`), menu jako listy numerowane, pytania tak/nie przez wpisanie `y` lub `n`, dzwonek terminala po zakończeniu tury, przy oczekiwaniu na wejście i gdy narzędzie trwa ponad 5 s, znaczniki OSC 133 do skakania między promptami.

Ograniczenia wymienione w dokumentacji: brak auto-włączania, zmiany trybu `/plan` nie są ogłaszane, `claude attach` używa alternatywnego ekranu, koszty widać tylko przy wyjściu.

Dokumentacja: https://code.claude.com/docs/en/accessibility.md

### Ustawienia i zmienne pomocnicze

- `prefersReducedMotion`: mniej animacji spinnera i migotania.
- `spinnerTipsEnabled`, `spinnerTipsOverride`, `spinnerVerbs`: podpowiedzi i czasowniki spinnera. Samego spinnera wyłączyć się nie da.
- `preferredNotifChannel: "terminal_bell"`: dzwonek poza trybem czytnika.
- Motywy `dark-daltonized`, `light-daltonized`.
- `CLAUDE_CODE_ACCESSIBILITY=1`: widoczny kursor natywny dla lup ekranowych.
- `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`, `CLAUDE_CODE_NO_FLICKER=1`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1`, `CLAUDE_AX_STARTUP_QUIET_MS`, `CLAUDE_AX_PREPARK_MS`.
- `claude -p` z `--output-format text|json|stream-json`: czysty tekst, bez interfejsu.

Panel czatu w VS Code od 2.1.236 ogłasza aktywność czytnikowi i nie wymaga trybu specjalnego.

## 2. Co nie działa (otwarte zgłoszenia użytkowników niewidomych)

1. **Koniec tury jest niesłyszalny.** Użytkownik VoiceOver nie wie, kiedy Claude skończył ani kiedy czeka na odpowiedź; strumieniowany tekst czytany na bieżąco męczy i nie da się go zatrzymać (#87978, #37569, #35579).
2. **Menu i pickery są nieme.** Strzałki w menu komend slash nie generują żadnego wyjścia dla JAWS i NVDA (#100253), picker AskUserQuestion nieużywalny z NVDA (#88839), opcje w trybie ręcznym ucinane (#99660), NVDA nie zaznacza tekstu w polu promptu (#92287).
3. **Tryb nie włącza się sam** (#89002); bywa, że zmienna środowiskowa jest ignorowana (#88221).
4. **Resztki grafiki w trybie czytnika**: ciągi znaków rysowania ramek (#91058); przy edycji plików w trybie ręcznym diff się nie pokazuje (#98706).
5. **Spinner i animacje**: redukcja ruchu zatrzymuje licznik sekund do następnego klawisza (#85972), migający spinner zgłoszony jako problem przy epilepsji (#91286), prośby o wyłączenie spinnera (#88265, #92205, #90386, #100280).
6. **Aplikacja desktopowa**: zwirtualizowany transkrypt odmontowuje czytany fragment (#99332), nowe odpowiedzi nie ogłaszane w NVDA (#95937), menu komend nieme (#94353), przycisk Send/Stop bez nazwy dostępnej (#93769), fokus ginie po akcjach na sesjach (#94031, #96368, #99818, #97992), VoiceOver nie echuje pisania w rozszerzeniu VS Code (#97889).
7. **Rozróżnienia tylko kolorem**: prompty uprawnień subagentów (#91368), ramka pola w VS Code (#94213).
8. **Brak testów z czytnikiem w CI**: regresje w każdym wydaniu, widoczne po liczbie zgłoszeń z IX i X 2026.

Zgłoszenie historyczne: #11002 (zamknięte, 66 komentarzy) wymusiło powstanie trybu czytnika. Brak zgłoszeń o monitorach brajlowskich i Orce.

## 3. Co daje API modów (sprawdzone w pliku typów 2.1.295)

Mod to wtyczka, której `hooks/hooks.json` wskazuje moduł TypeScript z `register(on, options)`, uruchamiany w procesie Claude Code. Mody działają domyślnie od 2.1.287 w terminalu i w aplikacji desktopowej, nie działają w `claude -p`, SDK, chmurze, panelu VS Code i WSL.

Przydatne do dostępności:

- `$.audio.speak(text, { voice })`: mowa syntezatorem systemowym, na macOS `say`; wypowiedzi kolejkowane. Na Windows i Linuksie do sprawdzenia.
- `$.audio.play({ asset })`: odtwarzanie pliku dźwiękowego, na macOS `afplay`, na Linuksie i Windows w terminalu nic nie gra.
- `$.ui.notify(text, { title })`: powiadomienie natywne kanałem użytkownika.
- `$.ui.status(text)`: wpis w linii statusu pod promptem, jeden na wtyczkę.
- `$.ui.toast(text)`: komunikat na 4 s.
- Miejsca renderowania do podmiany: `Spinner` (props `word`, `message`, `suffix`, `mode`), `ToolProgress`, `TurnDuration`, `AskUserQuestion`, `ToolUse`, `ToolResult`, `ToolGroup`, `InfoNotice`, `PromptHint`, `SessionMode`, `AbovePrompt`, `Pane`.
- Zdarzenia: `turn.complete`, `tool.call`, `tool.check`, `prompt.submit`, `command.run`, `classic.Notification`, `classic.Stop`.
- Element `Image` ma obowiązkowy `alt` czytany przez czytnik.

Czego mod nie zmieni: promptu uprawnień, pola wprowadzania, menu komend slash, aplikacji desktopowej i panelu VS Code w zakresie ogłaszania.

Limity: 10 s na hook, 100 000 znaków na drzewo, przerysowania do 10/s (30/s dla widocznych miejsc w terminalu), `$.store` do 4 MiB.

Walidacja: `claude plugin validate <katalog>` wypisuje zdarzenia i wywołania API moda.

Dokumentacja: https://code.claude.com/docs/en/plugins/mods/overview.md (podstrony interface, api, events, reference, create).

## 4. Istniejące projekty

Żaden nie adresuje kompleksowo pracy niewidomego programisty.

- **claude-sonar** (github.com/vylasaven/claude-sonar, MIT, 12 gwiazdek, ostatni commit 2026-03-03, npm 0.1.0). Klasyczna wtyczka na hookach, nie mod. Klasyfikuje wywołania narzędzi jako szum, rutynę, istotne lub ważne; czyta tylko istotne (`say` na macOS, `spd-say` na Linuksie, brak Windows), earcony, "Done" na koniec tury, tryb digest. 545 testów, przewodnik testów z VoiceOver, NVDA i Orcą. Autor nie utrzymuje, zachęca do forka. Powstało przed trybem czytnika i przed API modów.
- **Claude Code Reader** (github.com/doubletaponair/claude-code-reader, 4 gwiazdki, ostatni commit VI 2026, bez licencji). Aplikacja desktopowa w wxPython opakowująca CLI natywnymi widżetami, testowana z VoiceOver i NVDA/JAWS, earcony. Obejście, nie rozwiązanie.
- **Mody "koniec tury"** (dziesiątki, od X 2026): done-chime, done-alarm, turn-notify, voice-notify, tts-lite, claude-voice, voice-summary. Najdojrzalszy: **read-aloud** od See Stack (github.com/see-stack/claude-code-mods): `/read-aloud` z pauzą, wznowieniem, cofaniem i tempem, mowa przez `$.audio.speak`. Pisane dla widzących, którzy odeszli od biurka, ale technicznie zamykają lukę nr 1.
- **claude-readout** (github.com/lucenity0/claude-readout): przerysowuje zwinięte wiersze narzędzi, wzór dla czytelnych opisów działań.
- Katalogi modów: slopshopper.com (codzienny skan GitHuba, własny marketplace), FindMods.dev, github.com/SeongGwangJu/k-mods.
- Oficjalny marketplace: 315 wtyczek, zero o dostępności samego Claude Code. Wtyczki accessibility-agents, AccessLint, zivtech służą do audytu cudzych stron pod WCAG.

Nikt nie łączy modów z trybem `--ax-screen-reader`, nikt nie naprawia menu i pickerów, nikt nie ma mowy na Windows, gdzie siedzi większość użytkowników NVDA i JAWS.

## 5. Czy mod może sam włączyć tryb czytnika ekranu

Nie w sesji, w której został zainstalowany. Może sprawić, że każda następna sesja wystartuje już w tym trybie. Jeden restart jest nieunikniony.

Dlaczego (sprawdzone w binarce 2.1.295): decyzja o trybie zapada raz przy starcie, w kolejności flaga `--ax-screen-reader`, zmienna `CLAUDE_AX_SCREEN_READER`, ustawienie `axScreenReader`, i wynik jest zapamiętany na całą sesję. Nie ma wiersza w menu `/config`, więc `$.config.set` tego nie zmieni. Mody ładują się po tej decyzji. Cały tryb siedzi za zdalną flagą Anthropic (`tengu_ax_screen_reader`), domyślnie włączoną.

Co mod może zrobić w pierwszym `session.start`:

1. Wykryć działający czytnik przez `$.process.run`. macOS: `pgrep -x VoiceOver` (sprawdzone; klucz `defaults` `voiceOverOnOffKey` nie istnieje na czystym systemie). Windows: procesy `nvda.exe`, `jfw.exe` albo `SystemParametersInfo(SPI_GETSCREENREADER)` przez PowerShell. Linux: `gsettings get org.gnome.desktop.a11y.applications screen-reader-enabled`.
2. Dopisać `"axScreenReader": true` do `~/.claude/settings.json`. `$.fs.write` przyjmuje ścieżki bezwzględne, `HOME` daje `$.env.get`. Klasyczny hook `SessionStart` w skrypcie shell też to potrafi.
3. Powiedzieć o tym głosem (`$.audio.speak`) i dzwonkiem: tryb czytnika włączony od następnego uruchomienia, zrestartuj Claude Code. Bieżąca sesja jest jeszcze graficzna, więc toast i pasek mogą nie zostać odczytane.
4. Alternatywa bez zapisu ustawień: zaproponować `export CLAUDE_AX_SCREEN_READER=1` w pliku startowym powłoki. Zmienna ma pierwszeństwo przed ustawieniem i działa też przy `claude attach`.

Na co uważać:

- Zapis do cudzych ustawień jest inwazyjny jak na wtyczkę. Dać komendę `/a11y:off`, która to cofa, i nie nadpisywać, gdy użytkownik ma `CLAUDE_AX_SCREEN_READER=0`.
- W manifeście można dodać `userConfig` z polem logicznym "włącz tryb czytnika", pytanym przy włączaniu wtyczki, i działać tylko przy zgodzie.
- Instalacja z poziomu sesji przez `/plugin install` to picker, który z NVDA nie działa. W instrukcji podać instalację z powłoki: `claude plugin install nazwa@marketplace --scope user`, potem zwykłe `claude`.
- `claude config set` już nie istnieje jako podkomenda CLI, więc nie ma oficjalnego polecenia do ustawienia tego z powłoki poza edycją pliku.

Zgłoszenie #89002 prosi o auto-włączanie w rdzeniu. Do tego czasu punkty 1 do 3 to najbliższe możliwe przybliżenie.

## 6. Rekomendacja

Zbudować publiczny mod fundacji dla niewidomych użytkowników Claude Code. Daje natychmiastową wartość, dokumentuje działalność na rzecz osób z niepełnosprawnościami (istotne dla strategii grantowej) i dostarcza odtwarzalne zgłoszenia do Anthropic.

Zakres pierwszej wersji:

1. Sygnał końca tury i oczekiwania na użytkownika: earcon plus jedno zdanie mowy ("gotowe, trzy wywołania narzędzi, jedno pytanie do ciebie"). Zamyka #87978.
2. Podmiana `Spinner` na statyczny tekst bez czasowników.
3. Własny dialog `AskUserQuestion` jako lista numerowana z tekstem przy każdej zmianie zaznaczenia i wyborem cyfrą.
4. Earcony dla zdarzeń: start narzędzia, błąd narzędzia, prośba o uprawnienie, koniec tury. Ten sam język dźwiękowy, co w grach fundacji.
5. Klasyfikacja istotności wywołań narzędzi i formattery przejęte z claude-sonar (MIT).
6. Mowa na Windows (SAPI lub bezpośrednio do NVDA/JAWS przez `$.process.run`), czego nie ma nigdzie.
7. Wykrycie czytnika i włączenie `axScreenReader` od następnej sesji, z komunikatem głosowym o restarcie (część 5).

Równolegle: dopisać własne reprodukcje na NVDA i VoiceOver do #87978 i #100253, bo to dwa najdotkliwsze braki, i sprawdzić, czy #91058 i #88221 nadal występują w bieżącej wersji.

Do weryfikacji przed startem: działanie `$.audio.speak` na Windows i Linuksie, czy toast i status są czytane przez czytnik w trybie `--ax-screen-reader`, czy mod renderujący `Spinner` nie jest nadpisywany, gdy wiersz nazwie krok (#99483).
