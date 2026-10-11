# Spec: System Language

**Applies to:** earshot 0.1.7
**PRD Reference:** docs/prd.md
**Status:** Implemented (automated tests pass; manual test cases in docs/testing/)

## 1. Overview

Every line the mod speaks or prints, and the descriptions of its slash commands, follow the operating system's display language. The mod ships full tables for English, Polish, German, French, Spanish and Italian. Any other language, or a system the mod cannot ask, gets English.

The language is settled once per session, before the commands are registered. Command names and their arguments (`/earshot-tools brief`) stay in English in every language, so documentation and habits carry over.

The start question names the answer letters of its language (`y`/`n`, `t`/`n`, `j`/`n`, `o`/`n`, `s`/`n`). The answer parser takes the yes and no words of every supported language, whatever language asked.

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
| AC-006 | The answer parser takes `y yes t tak j ja o oui s si sí sì` as yes and `n no nie nein non` as no, case and surrounding spaces ignored. | Must |
| AC-007 | Counts use the grammar of the language: Polish takes three forms (1 sekunda, 2 to 4 and 22 to 24 sekundy, otherwise sekund), French takes the singular for 0 and 1, the others for 1 alone. | Must |
| AC-008 | The render log written to the debug sink stays in English. | Should |

## 3. User Test Cases

Full steps are in `docs/testing/system-language.md`.

| ID | Scenario | Expected | Automated coverage |
|----|----------|----------|--------------------|
| TC-001 | Polish display language, reader running, mode off | The question is in Polish and ends with `Naciśnij t albo n.`; `t` turns the mod on with a Polish confirmation | hooks/register.test.ts → "speaks Polish when the system displays Polish, and takes t as yes (system language)" |
| TC-002 | Same machine, the command list | The `earshot` command descriptions are Polish | tests/unit/language.spec.ts → "setLanguage" |
| TC-003 | A prompt and a long turn | `Rozpoczynam pracę.`, then `Nadal pracuję, 10 sekund.` | tests/unit/language.spec.ts → "has a Polish line for every English one" |
| TC-004 | A language without a table | English lines | hooks/register.test.ts → "falls back to English for a system language without lines (system language)" |

## 4. Data Model

`Language`: `"en" | "pl" | "de" | "fr" | "es" | "it"`. One table per language in `hooks/lib/lines/`, all of the shared `Messages` type. Nothing is stored; the language is read again each session.

## 5. Dependencies

- `$.process.run` for the two probes, `$.env.get` for `LC_ALL`, `LC_MESSAGES` and `LANG`.
