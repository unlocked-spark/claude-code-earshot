# Spec: Screen Reader Detection and Mod Activation

**Applies to:** earshot 0.1.6
**PRD Reference:** docs/prd.md
**Research:** docs/research/rozpoznanie-2026-10-09.md, section 5 (Polish)
**Status:** Implemented (automated tests pass; manual test cases in docs/testing/)

## 1. Overview

Claude Code's screen reader mode is decided once at startup, in the order `--ax-screen-reader` flag, `CLAUDE_AX_SCREEN_READER` environment variable, `axScreenReader` setting. It never turns itself on, and mods load after the decision, so no mod can switch the current session. What the mod does is notice that a screen reader is running, ask the user by voice, and make every following session start in the mode by writing `"axScreenReader": true` to the user settings file. One restart is the only step the user takes.

`/earshot-on` and `/earshot-off` turn the whole mod on and off. On saves the user settings it is about to change, then turns screen reader mode on and the spinner tips off from the next start. Off puts those settings back and makes every hook of the mod pass the engine's own behaviour until `/earshot-on`.

Detection covers macOS (VoiceOver) and Windows (NVDA, JAWS). On other systems the mod detects nothing and asks nothing; the commands still work.

### User Story

As a blind developer who has just installed the mod from the shell, I want Claude Code to notice my screen reader and offer to switch itself into screen reader mode, so that I reach a usable session after one restart without editing JSON files or asking a sighted person.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | On `session.start` the mod detects a running screen reader: on macOS `pgrep -x VoiceOver`; on Windows a process named `nvda` or `jfw` through PowerShell `Get-Process`, with `SystemParametersInfo(SPI_GETSCREENREADER)` as fallback (reported as an unnamed screen reader). Each probe has a 2 s budget; a failed probe counts as no reader. The platform comes from the `OS` variable (`Windows_NT`) or `uname -s` (`Darwin`). | Must |
| AC-002 | If the mode is already on (`CLAUDE_AX_SCREEN_READER` set to a value other than empty, `0`, `false`, `no` or `off`, or `axScreenReader` true in user, project or managed settings), the mod asks nothing and writes nothing at start. | Must |
| AC-003 | If `CLAUDE_AX_SCREEN_READER` is set to any value, the start question is never asked. The variable has priority over settings and the user has made a choice. | Must |
| AC-004 | If `axScreenReader` is explicitly `false` in the user settings, the mod treats it as a recorded refusal: no question. | Must |
| AC-005 | When a screen reader is detected, the mod is on, the mode is off and no refusal is stored, the mod raises a notification (the bell on the user's notification channel, the bundled earcon when no channel delivers), speaks one sentence naming the reader and asking whether to enable the mode from the next start, and prints the same sentence in the transcript. The sentence names the answer letters of the system language (`y`/`n` in English, `t`/`n` in Polish). | Must |
| AC-006 | A yes answer while the question is pending is consumed (the prompt is dropped with the line `Answered.` and never reaches the model) and does what `/earshot-on` does (AC-017). The settings file is rewritten through a strict JSON round trip that keeps every other key, the key order, the file's own indentation and its trailing newline. Before the first change in a session the previous content is copied beside it as `settings.json.earshot-backup`. The file is read back after writing and compared. The mod then speaks and prints that it is on, that the previous settings are saved, and that Claude Code needs a restart. | Must |
| AC-007 | A no answer stores `{ declined: true, declinedAt, modVersion }` under `screenReaderConsent` in `$.store`. Later sessions with the same mod version do not ask again. | Must |
| AC-008 | No answer within 30 s withdraws the question for this session only and prints and speaks one line saying so. Nothing is stored; the next session asks again. Any other prompt typed while the question is pending also withdraws it and goes to the model unchanged. | Should |
| AC-009 | `/earshot-on` turns the mod on without asking (AC-017), clears a stored refusal, cancels a pending question and gives the restart message. | Must |
| AC-010 | `/earshot-off` turns the mod off (AC-018) and confirms. When project or managed settings or the variable keep screen reader mode on, the reply adds that the mode stays on. When the mod is already off, it says so and writes nothing. | Must |
| AC-011 | `/earshot-status` speaks and prints, one sentence each: whether the mod is on, the detected reader (or none, or the detection error), the mode state and its source (variable, user settings, project or managed settings, nothing), and whether a refusal is stored with its date and mod version. | Should |
| AC-012 | Every spoken line has an identical text line in the transcript. A command's reply is its printed output and is spoken as well. Nothing is conveyed by sound alone. | Must |
| AC-013 | When the home directory is unknown, or the settings file cannot be parsed as a JSON object, written, or read back as written, the mod leaves the file as it was where it can, speaks and prints the reason and the manual fallback: add `"axScreenReader": true` to the settings file, or set `CLAUDE_AX_SCREEN_READER=1` in the shell profile. The session continues. | Must |
| AC-014 | A stored refusal from another mod version does not prevent the question: a new version asks once more. | Should |
| AC-015 | `claude plugin validate .` passes. This spec's hooks are `session.start`, `prompt.submit` and `command.run` for `earshot-on`, `earshot-off` and `earshot-status`. | Must |
| AC-016 | README documents installation from the shell and the restart step, because the in-session plugin picker is hard to use with a screen reader. | Should |
| AC-017 | Before `/earshot-on` changes the user settings, it stores under `activation` in `$.store` `{ on: true, setAt, saved }`, where `saved` holds each key it changes (`axScreenReader`, `spinnerTipsEnabled`) as the file had it: its value, or absent. Then it writes `axScreenReader: true` and `spinnerTipsEnabled: false`. A second `/earshot-on` keeps the first snapshot. With no stored activation, an `axScreenReader: true` already in the file is saved as absent. | Must |
| AC-018 | `/earshot-off` writes each saved key back (a value is set, an absent key removed) and stores `{ on: false, setAt }`. From then on, in this session and later ones, every hook passes the engine's own behaviour and the start question is not asked, until `/earshot-on` or a yes answer. With no stored activation the mod is on. A failed write leaves the mod on, so the command can be run again. | Must |
| AC-019 | When the mod is on and screen reader mode is on, every interactive session start prints and speaks one line under the engine's header: `Welcome to Earshot for Claude Code. To turn it off, type /earshot-off.`, in the system's language. Nothing while the mod is off or the mode is off (the start question speaks instead). | Must |

## 3. User Test Cases

Full steps for NVDA on Windows 11 and VoiceOver on macOS are in `docs/testing/screen-reader-detection.md`.

| ID | Scenario | Expected | Automated coverage |
|----|----------|----------|--------------------|
| TC-001 | Reader running, mode off, clean state; answer yes, restart | Question spoken and printed; restart line; settings hold `axScreenReader: true` and `spinnerTipsEnabled: false`, every other key intact, backup beside it; the next session starts in screen reader mode and the mod asks nothing | hooks/register.test.ts → "writes axScreenReader on y, keeps other keys, and consumes the answer (AC-006)"; tests/unit/settings-file.spec.ts → applySettings |
| TC-002 | Mode already on | No question, no line, settings unchanged | tests/unit/mode-state.spec.ts → "stays silent when the mode is already on" |
| TC-003 | `CLAUDE_AX_SCREEN_READER=0`, then `/earshot-status` | Silent start; status names the variable | hooks/register.test.ts → "stays silent when CLAUDE_AX_SCREEN_READER is 0 and lets prompts through (AC-003)" |
| TC-004 | Answer no, restart, `/earshot-status` | Declined line; silent second start; status reports the refusal with date and version | tests/unit/consent.spec.ts → "declines on no"; tests/unit/mode-state.spec.ts → "honours a stored refusal from the same version" |
| TC-005 | `/earshot-on`, restart, `/earshot-off`, restart | Both settings set, then put back exactly as before `/earshot-on`; after off the engine draws its own rows and spinner and no question is asked | hooks/register.test.ts → "/earshot-on saves the settings it changes and /earshot-off puts them back (AC-017)", "after /earshot-off the mod stays off in the next session and asks nothing (AC-018)" |
| TC-006 | Settings file with a trailing comma, answer yes | Error line with the manual fallback; file unchanged; session continues | tests/unit/settings-file.spec.ts → "refuses invalid JSON without touching it" |
| TC-007 | No answer for 30 s, then a prompt; restart | Withdrawal line; prompt handled normally; question asked again | tests/unit/consent.spec.ts → "withdraws on timeout without storing anything" |
| TC-008 | Another prompt while the question is pending | Question withdrawn, prompt goes to the model | tests/unit/consent.spec.ts → "withdraws the question and passes another prompt through" |

## 4. Data Model

### DetectionResult

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| platform | `"darwin" \| "win32" \| "other"` | Yes | From the `OS` variable or `uname -s` |
| reader | `"voiceover" \| "nvda" \| "jaws" \| "unknown" \| null` | Yes | `unknown` when only the Windows system flag reports a reader |
| method | `"pgrep" \| "process-list" \| "spi-flag" \| "none"` | Yes | Which probe produced the result |
| durationMs | number | Yes | Time the detection took |
| error | string | No | The message of a failed probe |

### ModeState

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| on | boolean | Yes | Whether the session runs in screen reader mode, as far as the mod can see |
| source | `"env" \| "settings-user" \| "settings-other" \| "off"` | Yes | The flag is invisible to a mod: a session started with `--ax-screen-reader` alone reads as `off` |
| envValue | string \| undefined | Yes | Raw `CLAUDE_AX_SCREEN_READER` |
| userSetting | boolean \| undefined | Yes | Raw `axScreenReader` from the user settings |

### StoredConsent (`$.store`, key `screenReaderConsent`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| declined | `true` | Yes | |
| declinedAt | ISO date string | Yes | |
| modVersion | string | Yes | From `.claude-plugin/plugin.json` |

### Activation (`$.store`, key `activation`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| on | boolean | Yes | Whether the mod runs |
| setAt | ISO date string | Yes | |
| saved | `Record<string, { present: true; value: unknown } \| { present: false }>` | When on | The keys `/earshot-on` changes, as the file held them before |

### Settings file

Only `axScreenReader` and `spinnerTipsEnabled` are touched, in `~/.claude/settings.json` (Windows: `%USERPROFILE%\.claude\settings.json`). The backup `settings.json.earshot-backup` sits beside it.

## 5. API Contract

### Commands

| Command | Effect | Reply (spoken and printed) |
|---------|--------|----------------------------|
| `/earshot-on` | AC-017, clears a stored refusal | "Earshot on. Your previous settings are saved; from the next start screen reader mode is on and tips are off. Restart Claude Code now." |
| `/earshot-off` | AC-018 | "Earshot off. The settings it changed are restored from the next start." or "Earshot is already off; nothing changed." |
| `/earshot-status` | Report | One sentence per item (AC-011) |

### Mod API usage

| Call | Purpose |
|------|---------|
| `on('session.start')` | Language, command registration, detection and the question |
| `on('prompt.submit')` | Take the answer while the question is pending (`{ drop }`); pass everything else |
| `on('command.run')` | The three commands |
| `$.process.run` | Fixed probes: `uname -s`, `pgrep -x VoiceOver`, two PowerShell one-liners |
| `$.env.get` | `OS`, `CLAUDE_AX_SCREEN_READER`, `HOME`, `USERPROFILE` |
| `$.settings.read` | User and merged settings for the mode state |
| `$.fs.read` / `$.fs.write` / `$.fs.exists` | The settings file, its backup, the plugin manifest |
| `$.store` | `screenReaderConsent`, `activation` |
| `$.audio.speak`, `$.ui.log`, `$.ui.notify`, `$.audio.play` | Speech, transcript line, bell, earcon fallback |
| `$.clock.after`, `$.clock.now` | The 30 s timeout, timestamps |

## 6. UI Behavior

The only UI is transcript lines led by `earshot:` plus speech. The first session may run without screen reader mode, so the mod speaks and prints plain lines rather than relying on toasts or the status line.

### States

- **Detecting:** nothing shown.
- **Question pending:** bell, spoken and printed question, 30 s timer.
- **On, awaiting restart:** spoken and printed restart message, bell.
- **Declined:** acknowledgement with the `/earshot-on` hint.
- **Withdrawn:** one line, for timeout or another prompt.
- **Error:** reason and manual fallback.
- **Silent:** mode on, variable set, refusal stored, mod off, or no reader.

## 7. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| NVDA and JAWS both running | NVDA is named |
| Only the Windows system flag reports a reader | "A screen reader was detected." |
| Screen reader started after Claude Code | Detected at the next start; no polling |
| `CLAUDE_AX_SCREEN_READER=1` and settings `false` | Mode on (the variable wins); silent |
| `axScreenReader: true` in project settings only | Mode on; silent; `/earshot-off` says the mode stays on from there |
| Settings file missing | Treated as `{}`; created on yes or `/earshot-on`; no backup, as there is nothing to keep |
| Settings file with comments or trailing commas | Not valid JSON: never written (AC-013) |
| `HOME` and `USERPROFILE` unset | Error of AC-013 with the variable fallback |
| A probe missing or failing | No reader; silent; `/earshot-status` reports the detection error |
| `y` typed when no question is pending | An ordinary prompt |
| `/earshot-on` while the question is pending | Accepted; the question is cancelled |
| Mod updated after a refusal | Asks once more (AC-014) |
| Linux | No detection, no question; commands work |

## 8. Dependencies

- Claude Code 2.1.292 or later as a native build with mods enabled. Mods do not run in `claude -p`, the SDK, the VS Code panel, the cloud or WSL.
- PowerShell 5.1 or 7 on Windows.
- No third-party runtime libraries.
