# Spec: Tool Narration

**Version:** 0.1.0
**Created:** 2026-10-09
**PRD Reference:** docs/prd.md (Feature 5: tool call significance; milestone M2)
**Research:** VoiceOver session of 2026-10-09: tool rows with full shell commands and dumped file contents are read with the same weight as the answer
**Status:** Draft

## 1. Overview

In screen reader mode Claude Code prints every tool call as `tool: Bash (cat a && sed -n 1,200p b)` and, under it, the tool's result or error text, which for a file read is the whole file. A screen reader reads all of it. The user asked for the opposite: only text that means something.

The mod draws the two transcript rows itself when whole answer delivery is active (the same switch: screen reader mode, or `/a11y-stream on`). The call row becomes one sentence built from what the model already wrote (`description` on a Bash call, the file name on a read or edit, the pattern on a search). The result row becomes a count: `result: 292 lines`, or `error: 3 lines` for a failed call, and nothing else. The full text of the last results stays available through `/a11y-last`.

Rows the engine folds into a group (`Read 3 files, ran 2 shell commands`) are left as they are. Dialogs are never touched.

### User Story

As a blind developer in screen reader mode, I want tool activity read as short sentences about what Claude did, so that I hear the work and the answer, not shell syntax and file dumps.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | A `ui.render` hook on `ToolUse` for the terminal surface, when delivery is buffered, returns a tree of one `Text` line: `<label>: <summary>`, where the label is `tool`, `tool error` for `isErrored`, `tool running` for `isRunning`, `tool interrupted` for `isInterrupted`. Outside buffered delivery, and on every other surface, the hook returns `next(e)`. | Must |
| AC-002 | The summary for a `Bash` call is the call's `description` when present and non-empty; otherwise the first 60 characters of `command` with newlines collapsed, followed by an ellipsis when cut. | Must |
| AC-003 | Summaries for built-in tools: `Read <basename>`, `Write <basename>`, `Edit <basename>`, `Grep <pattern>`, `Glob <pattern>`, `Agent: <description>` (or `Agent` without one), `WebFetch <host>`, `WebSearch <query>`; an MCP tool (`mcp__server__name`) reads `server name`; any other tool reads its name. | Must |
| AC-004 | A `ui.render` hook on `ToolResult` for the terminal surface, when delivery is buffered, returns one `Text` line: `result: <N> lines` or, for `isErrored`, `error: <N> lines`, where N counts the lines of the result's text (stdout and stderr for Bash; `content`, `text` or `file.content` fields for other tools; the JSON of the output otherwise). Nothing of the text itself is drawn. | Must |
| AC-005 | `AskUserQuestion` rows and every dialog are never drawn by the mod: the hooks match `ToolUse` and `ToolResult` only, and a `ToolUse` row whose tool is `AskUserQuestion` returns `next(e)`. | Must |
| AC-006 | The mod keeps the last 5 results in memory (tool id, summary, full text). `/a11y-last` returns the most recent result's full text as the command's output; `/a11y-last 2` the second most recent; an argument out of range or no stored result answers one sentence saying so. | Must |
| AC-007 | The delivery decision is the one from whole answer delivery: `resolveDelivery` with the screen reader mode and the `streamDelivery` override. `/a11y-stream off` therefore restores the engine's own rows at the next draw. | Must |
| AC-008 | A hook that throws leaves the engine drawing its own row (the engine's default for a failed render hook); the mod adds no `.catch` that could draw a wrong tree. | Must |
| AC-009 | Every summary and count is a single line without box characters, colour-only meaning or control sequences. | Must |
| AC-010 | `claude plugin validate .` lists `ui.render{component=ToolUse}` and `ui.render{component=ToolResult}` among the hooks and no `$` call beyond those already listed plus `$.ui.resolve`. | Must |
| AC-011 | README documents the narration, the count lines and `/a11y-last`. | Should |

## 3. User Test Cases

Manual, VoiceOver on, screen reader mode on. Captures under `tests/screenshots/tool-narration/`.

### TC-001: A shell command with a description

**Precondition:** buffered delivery active.
**Steps:**
1. Ask Claude to read two Markdown files and summarise them in a way that makes it use one shell command.
**Expected Result:** The transcript shows `tool: <the model's description of the command>` and `result: <N> lines`, no command text, no file content; then the summary step arrives whole.
**Screenshot Checkpoint:** tests/screenshots/tool-narration/tc-001-bash.txt
**Maps to:** TBD

### TC-002: A failed command

**Precondition:** as TC-001.
**Steps:**
1. Ask Claude to run a command that fails (a missing file).
**Expected Result:** `tool error: <description>` and `error: <N> lines`; no stderr text; Claude's next step explains the failure in its own words.
**Screenshot Checkpoint:** tests/screenshots/tool-narration/tc-002-error.txt
**Maps to:** TBD

### TC-003: Reading the full result on demand

**Precondition:** after TC-001.
**Steps:**
1. Run `/a11y-last`.
2. Run `/a11y-last 2`.
3. Run `/a11y-last 9`.
**Expected Result:** Step 1 prints the whole result of the last tool call. Step 2 prints the one before it. Step 3 answers `Only 2 results are kept; ask for 1 to 2.`
**Screenshot Checkpoint:** tests/screenshots/tool-narration/tc-003-last.txt
**Maps to:** TBD

### TC-004: Folded groups and dialogs untouched

**Precondition:** as TC-001.
**Steps:**
1. Ask Claude to read three files (reads fold into a group).
2. Ask Claude something that makes it use AskUserQuestion.
**Expected Result:** The group line `Read 3 files` is the engine's own. The question dialog is the engine's numbered list and works as before.
**Screenshot Checkpoint:** tests/screenshots/tool-narration/tc-004-untouched.txt
**Maps to:** TBD

### TC-005: Off outside buffered delivery

**Precondition:** `/a11y-stream off`.
**Steps:**
1. Ask Claude to run a shell command.
**Expected Result:** The engine's own `tool: Bash (...)` row and full result, as without the mod.
**Screenshot Checkpoint:** tests/screenshots/tool-narration/tc-005-off.txt
**Maps to:** TBD

## 4. Data Model

### ToolSummary (pure, per draw)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | `"tool" \| "tool error" \| "tool running" \| "tool interrupted"` | Yes | From `isErrored`, `isRunning`, `isInterrupted` |
| summary | string | Yes | One line per AC-002 and AC-003 |

### ResultCount (pure, per draw)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | `"result" \| "error"` | Yes | |
| lines | number | Yes | Lines of the result's text |

### LastResults (in memory, session facts)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| entries | `{ id: string; summary: string; text: string }[]` | Yes | Newest first, at most 5 |

### Relationships

Uses `resolveDelivery` and the session facts from whole answer delivery. `LastResults` is filled from `ToolResult` draws (the only place the full text passes through the mod) and read by `/a11y-last`.

## 5. API Contract

No HTTP endpoints.

### Commands

| Command | Effect | Reply |
|---------|--------|-------|
| `/a11y-last` | Print the newest stored result in full | the text, preceded by one line `Result of: <summary>` |
| `/a11y-last <n>` | Print the n-th newest | as above |
| `/a11y-last` with nothing stored | | `No tool result stored yet.` |
| `/a11y-last <n>` out of range | | `Only <k> results are kept; ask for 1 to <k>.` |

The command's text is printed in the transcript and read by the model, as every command's output is; this is accepted because the user asks for it explicitly and rarely.

### Mod API usage

| Call or event | Purpose |
|---------------|---------|
| `on('ui.render', { component: 'ToolUse' }, ...)` | Draw the call row (AC-001 to AC-003, AC-005) |
| `on('ui.render', { component: 'ToolResult' }, ...)` | Draw the count row, store the full text (AC-004, AC-006) |
| `$.ui.resolve(e)` | The surface's `Text` element |
| `$.command.register` | `a11y-last` with argument hint `[n]` |
| `on('command.run', { command: 'a11y-last' }, ...)` | AC-006 |

## 6. UI Behavior

### States

- **Buffered delivery, terminal:** call rows and result rows are the mod's single lines.
- **Running:** `tool running: <summary>`; the row is drawn again by the engine when the call ends.
- **Error:** `tool error: <summary>` and `error: <N> lines`.
- **Interrupted:** `tool interrupted: <summary>`.
- **Live delivery or another surface:** the engine's rows.

### Screenshot Checkpoints

Per test case in section 3.

## 7. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Bash call without `description` | First 60 characters of the command, newlines collapsed, ellipsis when cut |
| Result text empty | `result: 0 lines` |
| Result output is not text and has no known text field | Count the lines of its JSON |
| Output over the engine's size limits | Count what the props carry; the stored text is what the props carry |
| Same tool id drawn twice (running, then done) | The stored result is replaced, not duplicated |
| Six results in a session | The oldest is dropped; `/a11y-last 6` is out of range |
| The hook's tree does not validate on this build | The engine draws its own row and logs the reason; AC-010's validate run and the spike in section 9 catch it before release |
| Screen reader mode started by the flag alone | Delivery reads as live; `/a11y-stream on` enables narration too |
| Desktop or VS Code surface | `next(e)` |

## 8. Dependencies

- Whole answer delivery (`resolveDelivery`, the `streamDelivery` override, session facts).
- Mod API: `ui.render` on `ToolUse` and `ToolResult` (props `tool`, `input`, `output`, `isRunning`, `isErrored`, `isInterrupted`), `$.ui.resolve`, the terminal `Text` element.
- Built-in tool declarations (`.claude-plugin/types/claude-code-tools/index.d.ts`): Bash input `{ command, description?, ... }`, Bash result `{ stdout, stderr, interrupted, ... }` with no exit code.
- **To verify first (spike):** that the terminal in screen reader mode draws a `ui.render` hook's tree for `ToolUse` and `ToolResult` as flat text. The mode prints labelled lines instead of Ink boxes; if it bypasses render hooks for these rows, the feature cannot be built this way and the spec is withdrawn.

## 9. Infrastructure Prerequisites

| Category | Requirement |
|----------|-------------|
| Environment variables | None new |
| Registry images | N/A |
| Cloud quotas | N/A |
| Network reachability | A model for the manual cases |
| CI status | N/A |
| External secrets | N/A |
| Database migrations | N/A |
| Test machines | macOS with VoiceOver |

**Verification before implementation:** a throwaway `ui.render` hook on `ToolUse` returning `<Text>tool: probe</Text>` under `claude --plugin-dir .` in screen reader mode; if `tool: probe` appears in the transcript, the mechanism works.

## 10. Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-10-09 | 0.1.0 | Łukasz Majewski | Initial spec from /add:spec interview: one-line call rows from the model's own description, count-only result rows, errors as a count too, /a11y-last for the full text, active with buffered delivery |
