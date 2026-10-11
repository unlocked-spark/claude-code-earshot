# Spec: Tool Narration, Turn Signals and Render Log

**Applies to:** earshot 0.1.7
**PRD Reference:** docs/prd.md
**Research:** docs/research/spikes-2026-10.md (spike D: render hooks on tool rows in screen reader mode)
**Status:** Implemented (automated tests pass; manual test cases in docs/testing/)

## 1. Overview

In screen reader mode Claude Code prints every tool call as `tool: Bash (cat a && sed -n 1,200p b)` and, under it, the tool's result, which for a file read is the whole file. A screen reader reads all of it with the same weight as the answer.

Under whole answer delivery (specs/whole-answer-delivery.md) the mod hides tool rows by default, so the transcript carries Claude's own words alone. On request it narrates instead: each call is one line built from what the model already wrote (the `description` of a Bash call, the file name of a read or edit, the pattern of a search), and each result is a count, `result: 292 lines` or `error: 3 lines`. The full text of the last results stays available through `/earshot-last`.

Hiding rows leaves long silences, and the spinner's changing words are read aloud, so the mod also hides the spinner and the run-in-background hint, opens each turn with one line, `Starting work.`, and says every 10 seconds of silence that work goes on. A render log in the debug log names every component the terminal draws, so the source of any other unwanted message can be found.

Dialogs, `AskUserQuestion` included, are never touched.

### User Story

As a blind developer in screen reader mode, I want to hear Claude's answers and know that work goes on, without shell syntax, file dumps or spinner words, so that a long session stays quiet and understandable.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | In `brief` mode a `ui.render` hook on `ToolUse` for the terminal surface returns one `Text` line: `<label>: <summary>`, where the label is `tool`, `tool error` for `isErrored`, `tool running` for `isRunning`, `tool interrupted` for `isInterrupted` (interrupted over errored over running), in the system language. On every other surface the hook returns `next(e)`. | Must |
| AC-002 | The summary of a `Bash` call is its `description` when present and non-empty; otherwise the first 60 characters of `command` with newlines collapsed, followed by an ellipsis when cut. | Must |
| AC-003 | Summaries for built-in tools: `Read <basename>`, `Write <basename>`, `Edit <basename>`, `MultiEdit <basename>`, `NotebookEdit <basename>`, `Grep <pattern>`, `Glob <pattern>`, `Agent: <description>` (or `Agent`), `WebFetch <host>`, `WebSearch <query>`; an MCP tool (`mcp__server__name`) reads `server name`; any other tool reads its name. | Must |
| AC-004 | In `brief` mode a `ui.render` hook on `ToolResult` for the terminal surface returns one `Text` line: `result: <N> lines` or, for `isErrored`, `error: <N> lines` (`1 line` for one), where N counts the lines of the result's text (stdout and stderr for Bash; `file.content`, `content` or `text` for other tools; the JSON of the output otherwise). Nothing of the text itself is drawn. | Must |
| AC-005 | `AskUserQuestion` rows are never drawn by the mod: a `ToolUse` or `ToolResult` row whose tool is `AskUserQuestion` returns `next(e)`. Dialogs have no hook. | Must |
| AC-006 | In every mode but `full`, the mod keeps the last 5 results in memory (call id, summary, full text). `/earshot-last` prints the newest result's full text under one line `Result of: <summary>`; `/earshot-last 2` the second newest; nothing stored or an argument out of range answers one sentence saying so. | Must |
| AC-007 | Without an override the narration mode follows whole answer delivery: `off` under buffered delivery, `full` under live delivery. A change of delivery recomputes it. | Must |
| AC-008 | A hook that throws leaves the engine drawing its own row; the render hooks add no `.catch` that could draw a wrong tree. | Must |
| AC-009 | Every summary and count is a single line without box characters, colour-only meaning or control sequences. | Must |
| AC-010 | `claude plugin validate .` passes and lists `ui.render` with no matcher and on `ToolUse`, `ToolResult`, `ToolGroup`, `ToolProgress` and `Spinner`, plus `turn.start` and `turn.complete`. | Must |
| AC-011 | README documents the modes, the count lines, `/earshot-last`, the start line, the heartbeat and the render log. | Should |
| AC-012 | Tool narration has three modes. `off`: the `ToolUse` and `ToolResult` hooks return an empty `Box` (nothing is drawn) and still record the result for `/earshot-last`. `brief`: AC-001 to AC-004. `full`: the hooks return `next(e)`. | Must |
| AC-013 | `/earshot-tools off|brief|full` stores `toolNarration: { mode, setAt }` and applies at once; `/earshot-tools auto` deletes it and recomputes from delivery; `/earshot-tools` reports the mode and whether it is forced. | Must |
| AC-014 | A `ui.render` hook with no matcher writes one line per drawn terminal component to the debug sink (`$.ui.log(line, { to: 'debug' })`): `ui.render <Component> <requestId> [<marks>]: <text>`, text clipped to 160 characters on one line, and only when the line differs from the last one for that component instance. It always returns `next(e)` and stays in English. | Must |
| AC-015 | `/earshot-log on|off` stores `renderLog: { on, setAt }`; the log is on until stored off; `/earshot-log` reports the state. | Must |
| AC-016 | Heartbeat: under buffered delivery, from `turn.start` to the main loop's `turn.complete`, a tick each second counts the visible rows the mod's hooks produced (text chunks of the main loop's steps, tool call rows drawn in `brief` or `full`); after N seconds without one, the mod prints and speaks `Still working, N seconds.`, and again each further N seconds of the same silence. Outside buffered delivery, or with the interval 0, nothing. | Must |
| AC-017 | `/earshot-heartbeat <seconds>` (5 to 600) and `/earshot-heartbeat off` store `heartbeat: { seconds, setAt }` (off is 0); the default is 10; `/earshot-heartbeat` reports the interval. | Must |
| AC-018 | On the terminal, unless tool narration is `full`, the `ToolProgress` hook rewrites `hint` to `""`, so the run-in-background pill `(ctrl+b to run in background)` draws nothing. | Must |
| AC-019 | On the terminal, under buffered delivery, the `Spinner` hook returns an empty `Box`, so the spinner line and its changing word are not drawn. Under live delivery, `next(e)`. | Must |
| AC-020 | Under buffered delivery, each `turn.start` prints and speaks one line, `Starting work.` in the system language (`Rozpoczynam pracę.` in Polish), because the hidden spinner leaves no sign that the prompt was taken. The line does not count as visible output for the heartbeat and is drawn with the heartbeat off. Outside buffered delivery, nothing. | Must |
| AC-021 | A folded `ToolGroup` row (reads and searches the engine collapses into one count line, with the running call's command under it) follows the same modes: `off` draws an empty `Box`, `brief` one `<label>: <summary>` line per call and, under each finished call, its `result: <N> lines` count line (a single Bash call is folded into a group too), `full` and an expanded group return `next(e)`. Every call's result is kept for `/earshot-last`. | Must |
| AC-022 | With the mod turned off (`/earshot-off`), every hook in this spec returns `next(e)` and the heartbeat and start line stay silent. | Must |

## 3. User Test Cases

Full steps for NVDA on Windows 11 and VoiceOver on macOS are in `docs/testing/tool-narration.md`.

| ID | Scenario | Expected | Automated coverage |
|----|----------|----------|--------------------|
| TC-001 | Default: a turn with a shell command and a file read | Claude's words only; no tool rows, counts, spinner words or ctrl+b hint | hooks/narration.test.ts → "draws nothing for tool rows by default in screen reader mode (AC-012)", "hides the spinner line under buffered delivery only (AC-019)", "empties the run-in-background pill unless tool rows are full (AC-018)" |
| TC-002 | `/earshot-tools brief`, then a shell command | `tool: <description>` and `result: <N> lines` | hooks/narration.test.ts → "draws the call row from the Bash description in brief narration (AC-001, AC-002)", "draws the result as a count and keeps the text for /earshot-last (AC-004, AC-006)" |
| TC-003 | `brief`, a failing command | `tool error: <description>` and `error: <N> lines` | hooks/narration.test.ts → "labels running and errored calls (AC-001)" |
| TC-004 | Reads that fold into a group | Nothing by default; one line per call and a count per finished call in brief | hooks/narration.test.ts → "treats a folded tool group like its calls: nothing by default, a line per call and a count per finished one in brief" |
| TC-005 | `/earshot-last`, `/earshot-last 2`, out of range | Full text, the one before, the range sentence | hooks/narration.test.ts → "draws the result as a count and keeps the text for /earshot-last (AC-004, AC-006)" |
| TC-006 | `/earshot-tools full`, then `auto` | The engine's rows, then hidden again | hooks/narration.test.ts → "/earshot-tools full and auto switch the rows and the store (AC-012, AC-013)" |
| TC-007 | A question from Claude (`AskUserQuestion`) | The engine's dialog, unchanged | hooks/narration.test.ts → "leaves AskUserQuestion rows and live delivery to the engine (AC-005, AC-007)" |
| TC-008 | A prompt, then a long silent turn | `Starting work.` at once, `Still working, 10 seconds.`, then 20, until the answer | hooks/heartbeat.test.ts → "opens the turn with a line and says every 10 seconds of silence in screen reader mode (AC-016, AC-020)" |
| TC-009 | `/earshot-heartbeat 45`, `/earshot-heartbeat off` | New interval; with off, only the start line | hooks/heartbeat.test.ts → "/earshot-heartbeat sets the interval, switches off and reports (AC-017)" |
| TC-010 | Outside buffered delivery | Engine rows and spinner, no start line, no heartbeat | hooks/narration.test.ts → "draws the engine row outside buffered delivery (AC-007)"; hooks/heartbeat.test.ts → "stays silent outside screen reader mode, without the start line (AC-016, AC-020)" |
| TC-011 | Render log in `claude --debug` | `earshot: ui.render <Component> ...` lines in the debug log; none after `/earshot-log off` | hooks/narration.test.ts → "writes every drawn component to the debug log until /earshot-log off (AC-014, AC-015)" |
| TC-012 | Mod off | Every row drawn by the engine | hooks/narration.test.ts → "passes every row to the engine once /earshot-off turned the mod off" |

## 4. Data Model

### Stored choices (`$.store`)

| Key | Value | Default when absent |
|-----|-------|---------------------|
| `toolNarration` | `{ mode: "off" \| "brief" \| "full", setAt }` | Follow delivery (AC-007) |
| `renderLog` | `{ on: boolean, setAt }` | On |
| `heartbeat` | `{ seconds: number, setAt }` (0 is off) | 10 |

### Last results (in memory)

At most 5 entries `{ id, summary, text }`, newest first. The summary is noted when the call row is drawn, the text when its result is drawn. A result drawn again with the same call id replaces its entry.

### Silence (in memory, per turn)

`{ visibleCount, seenCount, silentSince, announcedSeconds }`: the hooks raise `visibleCount`, each tick compares it with `seenCount` and restarts or extends the silence.

## 5. API Contract

### Commands

| Command | Effect | Reply |
|---------|--------|-------|
| `/earshot-tools` | Report | `Tool narration <mode> (<forced \| whole answer delivery \| whole answer delivery is off>).` |
| `/earshot-tools off\|brief\|full` | Force a mode, stored | `Tool narration <mode> (forced). ...` |
| `/earshot-tools auto` | Drop the override | `Override removed. Tool narration <mode> (...).` |
| `/earshot-last [n]` | Print the n-th newest result (default 1) | `Result of: <summary>` and the text; `No tool result stored yet.`; `Only <k> results are kept; ask for 1 to <k>.` |
| `/earshot-heartbeat` | Report | `Heartbeat every <n> seconds of silence while an answer is being prepared, in screen reader mode.` or `Heartbeat off.` |
| `/earshot-heartbeat <seconds>\|off` | Set, stored | `Heartbeat set to every <n> seconds of silence.` or `Heartbeat off.` |
| `/earshot-log [on\|off]` | Report or switch, stored | `Render log on. ...` or `Render log off.` |

A command's text is printed in the transcript, read by the model as every command's output is, and spoken.

### Mod API usage

| Call or event | Purpose |
|---------------|---------|
| `on('ui.render')` without a matcher | Render log (AC-014) |
| `on('ui.render', { component: 'ToolUse' \| 'ToolResult' \| 'ToolGroup' })` | Tool rows (AC-001 to AC-006, AC-012, AC-021) |
| `on('ui.render', { component: 'ToolProgress' })` | The run-in-background pill (AC-018) |
| `on('ui.render', { component: 'Spinner' })` | The spinner line (AC-019) |
| `on('turn.start')`, `on('turn.complete')`, `$.clock.every`, `$.clock.now` | Start line and heartbeat (AC-016, AC-020) |
| `$.ui.resolve(e)` | The surface's `Box` and `Text` |
| `$.ui.log`, `$.audio.speak` | Lines, speech, debug sink |

## 6. UI Behavior

### States

- **Buffered, `off` (default in screen reader mode):** no tool rows, no spinner, no ctrl+b hint; `Starting work.` per turn and the heartbeat during silence.
- **Buffered, `brief`:** one line per call and per result.
- **`full` or live delivery:** the engine's rows.
- **Mod off:** the engine's own behaviour everywhere.

## 7. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Bash call without `description` | First 60 characters of the command, ellipsis when cut |
| Result text empty | `result: 0 lines` |
| Output with no known text field | Lines of its JSON |
| Same call drawn twice (running, then done) | The stored result is replaced, not duplicated |
| Six results in a session | The oldest is dropped |
| Screen reader mode from the flag alone | Delivery reads as live; `/earshot-stream on` turns everything here on |
| Subagent turns | No `turn.start` of their own; the main turn's heartbeat keeps running |
| Desktop or other surface | `next(e)` |
| Messages drawn by the engine without `ui.render` (for example `Loaded CLAUDE.md`) | Out of the mod's reach; the render log shows they are not hooked |

## 8. Dependencies

- Whole answer delivery for the delivery mode.
- Mod API: `ui.render` on the named components with their props (`tool`, `input`, `output`, `isRunning`, `isErrored`, `isInterrupted`, `tool_use_id`, `calls`, `isExpanded`, `hint`), `$.ui.resolve`, `$.clock`.
