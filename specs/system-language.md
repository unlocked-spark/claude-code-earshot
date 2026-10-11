# Spec: System Language

**Version:** 0.1.0
**Created:** 2026-10-11
**PRD Reference:** docs/prd.md (design rule: speech is short and understood on first hearing)
**Research:** NVDA session of 2026-10-11: a Polish-speaking user hears the mod's English lines read by a Polish voice
**Status:** Implementing (code and automated tests done; manual test cases pending)

## 1. Overview

Every line the mod speaks or prints, and the descriptions of its slash commands, follow the operating system's display language. The mod ships full tables for English, Polish, German, French, Spanish and Italian. Any other language, or a system the mod cannot ask, gets English.

The language is settled once per session, before the commands are registered. Command names and their arguments (`/a11y-tools brief`) stay in English in every language, so documentation and muscle memory carry over.

The consent question names the answer letters of its language (`y`/`n`, `t`/`n`, `j`/`n`, `o`/`n`, `s`/`n`). The answer parser takes the yes and no words of every supported language, whatever language asked.

### User Story

As a blind developer whose system speaks Polish, I want the mod's lines in Polish, so that my screen reader's Polish voice reads them naturally and I understand them on first hearing.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | On Windows the mod reads the display language with `powershell (Get-UICulture).Name`; on macOS with `defaults read -g AppleLanguages` (first entry); each probe has a 2 s budget. | Must |
| AC-002 | When the probe fails, exits non-zero or names no language, `LC_ALL`, then `LC_MESSAGES`, then `LANG` decide; on other systems only these variables are read. `C` and `POSIX` name no language. | Must |
| AC-003 | The first source that names a language decides. A supported language selects its table; any other selects English, even when a later source names a supported one. | Must |
| AC-004 | Every table has every line of the English one; the compiler enforces it through one shared type. | Must |
| AC-005 | Command descriptions registered with `$.command.register` come from the selected table. | Must |
| AC-006 | `parseAnswer` takes `y yes t tak j ja o oui s si sí sì` as yes and `n no nie nein non` as no, case and surrounding spaces ignored. | Must |
| AC-007 | Counts use the grammar of the language: Polish takes three forms (1 sekunda, 2 to 4 and 22 to 24 sekundy, otherwise sekund), French takes the singular for 0 and 1, the others for 1 alone. | Must |
| AC-008 | The render log written to the debug sink stays in English. | Should |

## 3. Manual Test Cases

| ID | Steps | Expected |
|----|-------|----------|
| TC-001 | Windows with a Polish display language, NVDA running, screen reader mode off; start `claude`. | The question is spoken and printed in Polish and ends with `Naciśnij t albo n.`; answering `t` enables the mode with a Polish confirmation. |
| TC-002 | Same machine; type `/` and move through the `a11y` commands. | The descriptions are Polish. |
| TC-003 | Screen reader mode on, a turn longer than 20 s. | The heartbeat says `Nadal pracuję, 20 sekund.` |
