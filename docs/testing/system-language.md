# Manual test protocol: system language

Spec: `specs/system-language.md`. Primary platform: Windows 11 with a Polish display language and NVDA. Second platform: macOS with VoiceOver and a German or French system language. Record pass or fail per platform.

## Cases

| Case | Steps | Expected |
|------|-------|----------|
| TC-001 | Clean state (see `docs/testing/screen-reader-detection.md`), reader running; start `claude` | The question is in Polish and ends with `Naciśnij t albo n.`; `t` turns the mod on with a Polish confirmation |
| TC-002 | Type `/earshot` and move through the commands | The descriptions are Polish; command names stay English |
| TC-003 | In screen reader mode, a prompt that takes longer than 20 s | `Rozpoczynam pracę.`, then `Nadal pracuję, 20 sekund.` |
| TC-004 | `/earshot-tools brief`, a shell command | `narzędzie: <description>` and `wynik: <N> wierszy` with the right plural form |
| TC-005 | macOS in German: start with VoiceOver, mode off | German question ending with `j` and `n` as the answer letters; `j` turns the mod on |
| TC-006 | `/earshot-log` with a Polish system, then the debug log | The reply is Polish; the log lines stay English |
