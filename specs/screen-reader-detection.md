# Spec: Screen Reader Detection and Mode Enabling

**Version:** 0.1.0
**Created:** 2026-10-09
**PRD Reference:** docs/prd.md (Feature 1, milestone M1)
**Research:** docs/research/rozpoznanie-2026-10-09.md, section 5 (Polish)
**Status:** Implementing (code and automated tests done; manual test cases pending)

## 1. Overview

Claude Code's screen reader mode is decided once at startup, in the order `--ax-screen-reader` flag, `CLAUDE_AX_SCREEN_READER` environment variable, `axScreenReader` setting. It never turns itself on (#89002), and mods load after the decision, so no mod can switch the current session. What a mod can do is notice that a screen reader is running, ask the user by voice, and make every following session start in the mode by writing `"axScreenReader": true` to the user settings file. One restart is unavoidable; the feature makes that restart the only sighted-free step the user has to take.

This spec covers macOS (VoiceOver) and Windows (NVDA, JAWS). Linux is a later spec.

### User Story

As a blind developer who has just installed the mod from the shell, I want Claude Code to notice my screen reader and offer to switch itself into screen reader mode, so that I reach a usable session after one restart without editing JSON files or asking a sighted person.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | On `session.start` the mod detects a running screen reader: on macOS `pgrep -x VoiceOver`; on Windows a process named `nvda.exe` or `jfw.exe`, with `SystemParametersInfo(SPI_GETSCREENREADER)` through PowerShell as fallback. Detection finishes within 2 s and never blocks startup. | Must |
| AC-002 | If the mode is already on (the `CLAUDE_AX_SCREEN_READER` variable is `1`, or `axScreenReader` is `true` in user or project settings), the mod does nothing audible and writes nothing. | Must |
| AC-003 | If `CLAUDE_AX_SCREEN_READER` is set to any value, the mod never writes the settings file. If it is `0`, the mod also stays silent. The variable has priority over settings and the user has made a choice. | Must |
| AC-004 | If `axScreenReader` is explicitly `false` in the user settings, the mod treats it as a recorded refusal: no question, no write. | Must |
| AC-005 | When a screen reader is detected, the mode is off and no refusal is stored, the mod rings the terminal bell, speaks one sentence naming the reader and asking whether to enable the mode from the next start, and prints the same sentence with the answer keys as plain text in the transcript. | Must |
| AC-006 | A `y` answer writes `"axScreenReader": true` to `~/.claude/settings.json` (Windows: `%USERPROFILE%\.claude\settings.json`), preserving every other key and 2-space indentation. The file is written atomically (temp file, then rename). The mod then speaks and prints: mode enabled from the next start, restart Claude Code now. | Must |
| AC-007 | An `n` answer stores `{ declined: true, declinedAt, modVersion }` under the `screenReaderConsent` key in `$.store`. Later sessions with the same mod version do not ask again. | Must |
| AC-008 | No answer within 30 s counts as a refusal for this session only. Nothing is stored; the next session asks again. | Should |
| AC-009 | `/a11y-on` writes `axScreenReader: true` without asking, clears the stored refusal, and gives the restart message. | Must |
| AC-010 | `/a11y-off` removes the `axScreenReader` key from the user settings file (restoring the default), speaks and prints confirmation. If the key was not there, it says so. | Must |
| AC-011 | `/a11y-status` speaks and prints: detected reader (or none), mode state and its source (flag, env, settings, off), whether a refusal is stored. | Should |
| AC-012 | Every spoken message has an identical text line in the transcript. Nothing is conveyed by sound or speech alone. | Must |
| AC-013 | When the settings file cannot be written (missing directory, permission error) or cannot be parsed, the mod leaves the file untouched, speaks and prints the error and the manual fallback: add `"axScreenReader": true` to the settings file, or set `CLAUDE_AX_SCREEN_READER=1` in the shell profile. The session continues. | Must |
| AC-014 | A new mod version re-asks once after a stored refusal from an older version (the `modVersion` in the stored refusal differs). | Should |
| AC-015 | `claude plugin validate .` passes and lists only the events and APIs this spec names: `session.start`, `prompt.submit`, `command.run`, `$.process.run`, `$.fs`, `$.env.get`, `$.store`, `$.audio.speak`, `$.ui.notify`. | Must |
| AC-016 | README documents installation from the shell (`claude plugin install ... --scope user`) and the restart step, because the in-session plugin picker does not work with NVDA. | Should |

## 3. User Test Cases

Manual, with a screen reader running. Captures are transcript text saved under `tests/screenshots/screen-reader-detection/` as `.txt`; audio is verified by ear and noted in the test log.

### TC-001: VoiceOver user enables the mode

**Precondition:** macOS, VoiceOver running, mod installed from the shell, no `CLAUDE_AX_SCREEN_READER` in the environment, no `axScreenReader` key in `~/.claude/settings.json`, empty `$.store`.
**Steps:**
1. Run `claude` in Terminal.
2. Wait for the bell and the spoken question.
3. Type `y` and press Enter.
4. Quit Claude Code and run `claude` again.
**Expected Result:** Step 2: bell, then speech "VoiceOver detected. Enable Claude Code screen reader mode from the next start? Press y or n." and the same line in the transcript. Step 3: speech and text "Screen reader mode enabled from the next start. Restart Claude Code now." `~/.claude/settings.json` contains `"axScreenReader": true` and all previous keys. Step 4: the first line of the session is `[Screen Reader Mode: on via settings]` and the mod is silent.
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-001-question.txt, tc-001-restart.txt
**Maps to:** tests/unit/settings-file.spec.ts → "adds the key and preserves other keys and indentation"; hooks/register.test.ts → "writes axScreenReader on y, keeps other keys, and consumes the answer (AC-006)"; manual for speech and the restart

### TC-002: NVDA user enables the mode

**Precondition:** Windows 11, NVDA running, Windows Terminal, same clean state as TC-001.
**Steps:** as TC-001.
**Expected Result:** as TC-001 with "NVDA detected" and the settings file under `%USERPROFILE%\.claude\settings.json`. The spoken question is heard through NVDA or the system voice (which one is recorded in the test log; see Open Questions).
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-002-question.txt
**Maps to:** tests/unit/detect.spec.ts → "reports NVDA on Windows from the process list"; manual for the rest

### TC-003: Mode already on

**Precondition:** `axScreenReader: true` in user settings, VoiceOver running.
**Steps:**
1. Run `claude`.
**Expected Result:** Session starts with `[Screen Reader Mode: on via settings]`. No bell from the mod, no speech, no transcript line, settings file unchanged (same mtime).
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-003-silent.txt
**Maps to:** tests/unit/mode-state.spec.ts → "stays silent when the mode is already on"

### TC-004: Environment variable set to 0

**Precondition:** `CLAUDE_AX_SCREEN_READER=0` exported, VoiceOver running, no settings key.
**Steps:**
1. Run `claude`.
2. Run `/a11y-status`.
**Expected Result:** Step 1: silent. Step 2: "VoiceOver detected. Screen reader mode off, set by the CLAUDE_AX_SCREEN_READER variable. The mod will not change settings while the variable is set."
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-004-status.txt
**Maps to:** tests/unit/mode-state.spec.ts → "stays silent when the environment variable is set, even to 0"; hooks/register.test.ts → "stays silent when CLAUDE_AX_SCREEN_READER is 0 and lets prompts through (AC-003)"

### TC-005: Refusal is remembered

**Precondition:** as TC-001.
**Steps:**
1. Run `claude`, answer `n` to the question.
2. Quit and run `claude` again.
3. Run `/a11y-status`.
**Expected Result:** Step 1: "Understood. Screen reader mode stays off. Say /a11y-on at any time to enable it." Step 2: silent. Step 3 reports "refusal stored on <date>, mod version <v>".
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-005-declined.txt
**Maps to:** tests/unit/consent.spec.ts → "declines on no"; tests/unit/mode-state.spec.ts → "honours a stored refusal from the same version"

### TC-006: Enabling after refusal, then disabling

**Precondition:** state after TC-005.
**Steps:**
1. Run `/a11y-on`.
2. Quit, run `claude`, confirm mode is on.
3. Run `/a11y-off`.
4. Quit, run `claude`.
**Expected Result:** Step 1: restart message, settings key written, stored refusal cleared. Step 2: `[Screen Reader Mode: on via settings]`. Step 3: "Screen reader mode disabled from the next start." Key removed, other keys intact. Step 4: graphical session; the mod asks the question again (no refusal stored).
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-006-on.txt, tc-006-off.txt
**Maps to:** tests/unit/settings-file.spec.ts → "removes the key and keeps the rest"; hooks/register.test.ts → "registers the three commands and /a11y-off removes the key (AC-009, AC-010)"

### TC-007: Settings file is not valid JSON

**Precondition:** `~/.claude/settings.json` contains a trailing comma, VoiceOver running.
**Steps:**
1. Run `claude`, answer `y`.
**Expected Result:** "Could not update the settings file: it is not valid JSON. The file was left unchanged. Add "axScreenReader": true by hand, or set CLAUDE_AX_SCREEN_READER=1 in your shell profile." File byte-identical to before. Session continues.
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-007-error.txt
**Maps to:** tests/unit/settings-file.spec.ts → "refuses invalid JSON without touching it"

### TC-008: No answer

**Precondition:** as TC-001.
**Steps:**
1. Run `claude`, do nothing for 30 s.
2. Send an ordinary prompt.
3. Quit and run `claude` again.
**Expected Result:** Step 1: after 30 s, "No answer, leaving screen reader mode off for this session." Step 2: the prompt is handled normally, not consumed as an answer. Step 3: the question is asked again.
**Screenshot Checkpoint:** tests/screenshots/screen-reader-detection/tc-008-timeout.txt
**Maps to:** tests/unit/consent.spec.ts → "withdraws on timeout without storing anything"

## 4. Data Model

### DetectionResult

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| platform | `"darwin" \| "win32" \| "other"` | Yes | From `$.env` / process platform |
| reader | `"voiceover" \| "nvda" \| "jaws" \| "unknown" \| null` | Yes | `unknown` when only the Windows system flag says a reader is on |
| method | `"pgrep" \| "process-list" \| "spi-flag" \| "none"` | Yes | Which probe produced the result |
| durationMs | number | Yes | For the 2 s budget |

### ModeState

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| on | boolean | Yes | Whether the current session runs in screen reader mode |
| source | `"env" \| "settings-user" \| "settings-project" \| "off"` | Yes | The flag cannot be observed by the mod; a session started with `--ax-screen-reader` and no env or settings shows as `off` with `on` unknown (see Open Questions) |
| envValue | string \| null | Yes | Raw `CLAUDE_AX_SCREEN_READER` |
| settingsValue | boolean \| null | Yes | Raw `axScreenReader` from user settings |

### StoredConsent (`$.store`, key `screenReaderConsent`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| declined | boolean | Yes | |
| declinedAt | ISO date string | Yes | |
| modVersion | string | Yes | From the plugin manifest |

### Settings file

Only the `axScreenReader` key is touched. Read with a strict JSON parser; any parse failure aborts the write (AC-013).

### Relationships

`DetectionResult` and `ModeState` are computed per session and never stored. `StoredConsent` persists across sessions in `$.store`. The settings file is the only state outside the plugin.

## 5. API Contract

No HTTP endpoints. The contract is the set of slash commands and mod API calls.

### Commands

| Command | Effect | Output (spoken and printed) |
|---------|--------|-----------------------------|
| `/a11y-on` | Write `axScreenReader: true`, clear stored refusal | "Screen reader mode enabled from the next start. Restart Claude Code now." |
| `/a11y-off` | Remove `axScreenReader` from user settings | "Screen reader mode disabled from the next start." or "Screen reader mode was not set in settings; nothing changed." |
| `/a11y-status` | Report detection, mode state, stored refusal | One sentence per item |

### Mod API usage

| Call | Purpose | Notes |
|------|---------|-------|
| `on("session.start")` | Run detection and the consent flow once | Must return within the 10 s hook limit; detection budget 2 s |
| `$.process.run` | `pgrep -x VoiceOver`; `powershell -NoProfile -Command "Get-Process nvda,jfw -ErrorAction SilentlyContinue \| Select-Object -ExpandProperty ProcessName"`; fallback PowerShell `SystemParametersInfo(70, 0, ...)` | Fixed commands, no user input in arguments |
| `$.env.get` | `CLAUDE_AX_SCREEN_READER`, `HOME`, `USERPROFILE` | |
| `$.fs.read` / `$.fs.write` | User settings file, absolute path | Temp file plus rename for atomicity; verify `$.fs` supports rename, else write-then-verify |
| `$.store` | `screenReaderConsent` | |
| `$.audio.speak` | All spoken lines | Short, one sentence each |
| `$.ui.notify` | Restart message as a native notification too | Helps when the terminal is not in front |
| `on("prompt.submit")` | Capture `y` / `n` while the question is pending | Depends on the API letting the handler consume the submission; see Dependencies |
| `on("command.run")` | `/a11y-on`, `/a11y-off`, `/a11y-status` | |

## 6. UI Behavior

The only UI is transcript text plus speech. The first session is graphical (mode off), so the mod cannot rely on the screen reader reading toasts or status lines; it speaks and prints plain lines.

### States

- **Detecting:** nothing shown; detection runs in the background inside `session.start`.
- **Question pending:** bell, spoken question, transcript line: `earshot: VoiceOver detected. Enable Claude Code screen reader mode from the next start? Press y or n.` A 30 s timer runs.
- **Enabled, awaiting restart:** spoken and printed restart message, native notification.
- **Declined:** spoken and printed acknowledgement with the `/a11y-on` hint.
- **Timed out:** spoken and printed "leaving off for this session".
- **Error:** spoken and printed error with the manual fallback.
- **Silent:** mode already on, env var set, refusal stored, or no reader detected. No output.

### Screenshot Checkpoints

Transcript captures listed per test case in section 3.

## 7. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| NVDA and JAWS both running | Name the first found in the order NVDA, JAWS; behaviour otherwise identical |
| Only the Windows system flag reports a reader, no known process | Ask with "A screen reader was detected" instead of a name |
| Screen reader started after Claude Code | Not detected this session; detected at the next start. No polling. |
| `CLAUDE_AX_SCREEN_READER=1` but settings `false` | Mode is on (env wins); silent |
| `axScreenReader: true` in project `.claude/settings.json` only | Mode is on; silent; `/a11y-off` says the setting comes from project settings and does not touch it |
| Settings file missing | Treat as `{}`; create the directory and the file on `y` or `/a11y-on` |
| Settings file with comments or trailing commas | Invalid JSON: never written (AC-013) |
| `HOME` / `USERPROFILE` unset | Error path of AC-013 with the env var fallback |
| `pgrep` or PowerShell missing or failing | Detection result `none`; silent; `/a11y-status` reports "detection failed: <reason>" |
| PowerShell execution policy blocks scripts | `-Command` with inline code is used, not a script file; if it still fails, treat as detection failure |
| User types `y` as an ordinary prompt when no question is pending | Passed through untouched; the mod consumes input only while the question is pending |
| User answers with `/a11y-on` instead of `y` | Accepted; the pending question is cancelled |
| Desktop app session | Same flow; the restart message says "restart Claude Code" without naming the terminal |
| Mod upgraded after a refusal | Asks once more (AC-014) |

## 8. Dependencies

- Claude Code >= 2.1.287 with mods enabled; type definitions checked against 2.1.295.
- Mod API: `session.start`, `prompt.submit`, `command.run`; `$.process.run`, `$.fs` with absolute paths, `$.env.get`, `$.store`, `$.audio.speak`, `$.ui.notify`.
- **To verify before planning:** whether a `prompt.submit` handler can consume the submission so that `y` is not sent to the model. If not, the consent answer falls back to `/a11y-on` and `/a11y-off` only, and AC-005 changes its wording to name the commands.
- **To verify:** whether `$.audio.speak` is audible on Windows and whether it reaches NVDA or only the system voice (PRD open question). The detection and settings logic does not depend on it, but TC-002 does.
- **To verify:** how the mod obtains its own version (manifest read through `$.fs` relative to the plugin root, or an API field).
- No third-party libraries. Vitest and ESLint for development only.

## 9. Infrastructure Prerequisites

| Category | Requirement |
|----------|-------------|
| Environment variables | `HOME` (macOS) or `USERPROFILE` (Windows) resolvable; `CLAUDE_AX_SCREEN_READER` absent for the happy-path tests |
| Registry images | N/A |
| Cloud quotas | N/A |
| Network reachability | N/A |
| CI status | N/A (no CI at POC); `npm test` and `claude plugin validate .` run locally |
| External secrets | N/A |
| Database migrations | N/A |
| Test machines | macOS with VoiceOver; Windows 11 (VM acceptable) with NVDA, Windows Terminal, PowerShell 5.1 or 7 |

**Verification before implementation:** run `claude --version` on both machines (>= 2.1.287), confirm `pgrep -x VoiceOver` prints a PID with VoiceOver on, confirm the PowerShell one-liner prints `nvda` with NVDA on, and answer the `prompt.submit` question with a throwaway mod validated by `claude plugin validate`.

## 10. Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-10-09 | 0.1.0 | Łukasz Majewski | Initial spec from /add:spec interview: spoken y/n consent, remembered refusal, macOS and Windows only |
| 2026-10-09 | 0.1.1 | Łukasz Majewski | After the TDD cycle: commands renamed to /a11y-on, /a11y-off, /a11y-status (colons are not allowed in command names); plugin named earshot; the transcript line carries the plugin name as its prefix; the bell goes through the user's notification channel; an ordinary prompt while the question is pending withdraws it and goes through; "Maps to" fields filled |
