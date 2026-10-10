# Spec: Whole Answer Delivery

**Version:** 0.1.0
**Created:** 2026-10-09
**PRD Reference:** docs/prd.md (Feature 2 area: end-of-turn and streamed text, milestone M1; issues #37569 and #35579)
**Research:** docs/research/spikes-2026-10.md; VoiceOver session of 2026-10-09 (plugin works; line-by-line streaming is the most tiring part)
**Status:** Implementing (code and automated tests done; manual test cases pending)

## 1. Overview

In screen reader mode Claude Code prints the model's answer as it streams, line by line. VoiceOver and NVDA read each new line as it appears and interrupt whatever they were reading, so a long answer is heard as a stutter of half-sentences. No built-in setting changes this.

The answer reaches the terminal through the streaming event `turn.step`, whose hooks are async generators: what the person sees stream is the concatenation of the chunks a hook yields. This feature holds every chunk of a model step until the step's stream has ended, then yields them all at once. The terminal receives the whole answer in one write and the screen reader reads it as one block. Thinking is not shown at all in this mode. A bell marks the moment the block appears.

The mode is active when the session runs in screen reader mode, and can be forced on or off with `/a11y-stream`.

### User Story

As a blind developer using Claude Code in screen reader mode, I want each answer to appear whole instead of line by line, so that my screen reader reads it in one go without interrupting itself.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | A `turn.step` hook consumes the stream beneath it to the end before yielding anything, then yields the held chunks in the order received, with each run of text chunks of one block merged into a single chunk, and returns the step's result unchanged. One chunk per block makes the terminal paint the answer in one frame; chunks yielded one by one were painted in two frames and VoiceOver skipped the first sentence (session of 2026-10-10). | Must |
| AC-002 | Chunks of kind `tool`, `input`, `stop` and `engine` are always yielded (held, never dropped), so the engine records and runs every tool call exactly as without the mod. | Must |
| AC-003 | Chunks of kind `thinking` are dropped in buffered mode: nothing of the model's thinking is shown or read. The transcript's recorded thinking is the engine's signed block and is unaffected. | Must |
| AC-004 | Chunks of kind `text` are held and yielded in order, so the printed and recorded answer is byte-identical to the unbuffered one. | Must |
| AC-005 | After the held chunks are yielded for a step whose answer is non-empty, the mod raises a native notification (the terminal bell on the user's channel); when the notification is not delivered (`isSent: false`, as on Terminal.app with no `preferredNotifChannel`), it plays the bundled earcon `assets/earcons/answer-ready.wav` through `$.audio.play`. A step with no visible text (tool calls only) raises nothing. | Must |
| AC-006 | Buffered mode is active when the resolved mode state is on (`CLAUDE_AX_SCREEN_READER` truthy, or `axScreenReader` true in settings) and no override is stored; it is inactive otherwise. Outside buffered mode the hook forwards chunks as they arrive (`yield* next(e)`), adding no delay. | Must |
| AC-007 | `/a11y-stream on` forces buffered mode for this and later sessions, `/a11y-stream off` forces live streaming, `/a11y-stream auto` removes the override; each answers with one sentence naming the resulting mode and whether it comes from the override or the screen reader mode. `/a11y-stream` alone reports the current state. The override lives in `$.store` under `streamDelivery`. | Must |
| AC-008 | Steps that belong to a subagent (`e.agentId` set) are never buffered; the hook forwards them unchanged. | Must |
| AC-009 | When the step is interrupted (`next.signal` aborts, the user pressed Escape or Ctrl+C) the hook yields whatever it has held so far before returning, so the transcript keeps the partial answer. | Must |
| AC-010 | The hook does no work of its own per chunk beyond pushing it to an array, so its own time stays far below the hook budget regardless of how long the model takes. | Should |
| AC-011 | If the hook fails, its `.catch` handler forwards the stream beneath unchanged, so a bug in buffering degrades to today's behaviour rather than a lost answer. | Must |
| AC-012 | `claude plugin validate .` lists `turn.step` among the hooks and no new `$` calls beyond `$.ui.notify`, `$.audio.play`, `$.store.get`, `$.store.set`, `$.store.delete` and `$.audio.speak` for the command's reply. | Must |
| AC-013 | README documents the behaviour, the bell, the hidden thinking and the three forms of `/a11y-stream`. | Should |

## 3. User Test Cases

Manual, with a screen reader running. Captures are transcript text under `tests/screenshots/whole-answer-delivery/`.

### TC-001: An answer arrives whole

**Precondition:** macOS, VoiceOver on, session started in screen reader mode, no override stored.
**Steps:**
1. Ask for a five-paragraph explanation of something.
2. Listen.
**Expected Result:** Silence while the model writes, then one bell, then VoiceOver reads the whole answer from the first line to the last without restarting mid-sentence. No `thinking:` lines. The transcript shows the full answer under `claude:`.
**Screenshot Checkpoint:** tests/screenshots/whole-answer-delivery/tc-001-whole.txt
**Maps to:** hooks/stream.test.ts → "holds the whole step, drops thinking, keeps order and rings once (AC-001 to AC-005)"; manual for what is heard

### TC-002: A turn with tool calls

**Precondition:** as TC-001.
**Steps:**
1. Ask Claude to read a file and summarise it.
**Expected Result:** The tool call runs as usual (`tool:` line, permission prompt if any). The summary step arrives whole with a bell. Steps that only call tools raise no bell.
**Screenshot Checkpoint:** tests/screenshots/whole-answer-delivery/tc-002-tools.txt
**Maps to:** hooks/stream.test.ts → "rings no bell for a step without text (AC-005)"; manual for the tool run

### TC-003: Live streaming outside screen reader mode

**Precondition:** session started without the mode, no override.
**Steps:**
1. Ask a question.
**Expected Result:** The answer streams as it does without the mod; thinking is shown; no extra bell.
**Screenshot Checkpoint:** tests/screenshots/whole-answer-delivery/tc-003-live.txt
**Maps to:** hooks/stream.test.ts → "streams live outside screen reader mode, thinking included, no bell (AC-006)"

### TC-004: Override on, off, auto

**Precondition:** session without the mode.
**Steps:**
1. Run `/a11y-stream on`, ask a question.
2. Run `/a11y-stream off`, ask a question.
3. Run `/a11y-stream auto`, run `/a11y-stream`.
**Expected Result:** Step 1: "Whole answer delivery on (forced). Answers appear whole; thinking is hidden." and the next answer arrives whole. Step 2: "Whole answer delivery off (forced). Answers stream live." and the next answer streams. Step 3: "Override removed." then "Whole answer delivery off (screen reader mode is off)."
**Screenshot Checkpoint:** tests/screenshots/whole-answer-delivery/tc-004-override.txt
**Maps to:** hooks/stream.test.ts → "/a11y-stream on, off and auto change the mode and the store (AC-007)"; tests/unit/stream-delivery.spec.ts → "stream messages"

### TC-005: Interrupting a buffered answer

**Precondition:** as TC-001.
**Steps:**
1. Ask for a long answer; press Escape after a few seconds.
**Expected Result:** The partial answer generated so far appears in the transcript (possibly a few words), the turn ends as an interrupted turn, no bell.
**Screenshot Checkpoint:** tests/screenshots/whole-answer-delivery/tc-005-interrupt.txt
**Maps to:** manual only (next.signal abort is not driven by the kit); code path: try/catch around the iterator in hooks/register.ts

### TC-006: Override survives a restart

**Precondition:** `/a11y-stream on` was run in a previous session.
**Steps:**
1. Start a new session without the mode, run `/a11y-stream`.
**Expected Result:** "Whole answer delivery on (forced)."
**Screenshot Checkpoint:** tests/screenshots/whole-answer-delivery/tc-006-persist.txt
**Maps to:** hooks/stream.test.ts → "a stored override forces buffering outside the mode and survives sessions (AC-007, TC-006)"

## 4. Data Model

### StreamOverride (`$.store`, key `streamDelivery`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mode | `"buffered" \| "live"` | Yes | What the user forced |
| setAt | ISO date string | Yes | |

Absent key means `auto`: follow the screen reader mode.

### HeldStep (in memory, one per step in flight)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| chunks | TurnStepChunk[] | Yes | Every chunk received except `thinking` |
| hasText | boolean | Yes | Whether any `text` chunk with non-empty text was held; decides the bell |

### Relationships

`ModeState` from the detection feature (`hooks/lib/mode-state.ts`) decides the default; `StreamOverride` wins over it. `HeldStep` lives only for the duration of one `turn.step` dispatch.

## 5. API Contract

No HTTP endpoints.

### Commands

| Command | Effect | Reply |
|---------|--------|-------|
| `/a11y-stream` | Report | "Whole answer delivery on (forced)." / "... on (screen reader mode)." / "... off (forced)." / "... off (screen reader mode is off)." |
| `/a11y-stream on` | Store `{ mode: "buffered" }` | "Whole answer delivery on (forced). Answers appear whole; thinking is hidden." |
| `/a11y-stream off` | Store `{ mode: "live" }` | "Whole answer delivery off (forced). Answers stream live." |
| `/a11y-stream auto` | Delete the key | "Override removed." followed by the report line |

### Mod API usage

| Call or event | Purpose |
|---------------|---------|
| `on('turn.step', async function* ($, e, next) {...}).catch(...)` | Hold and replay chunks; the handler forwards `next(e)` unchanged |
| `next.signal` | Detect interruption (AC-009) |
| `$.ui.notify(text)` | Bell after a step with text (AC-005); text: "Answer ready." |
| `$.store.get/set/delete('streamDelivery')` | Override |
| `$.audio.speak` | Speak the command reply, as the other commands do |
| `$.command.register` | `a11y-stream` with argument hint `[on|off|auto]` |

## 6. UI Behavior

The only visible change is timing: in buffered mode the `claude:` block appears at once instead of growing. Thinking lines are absent in buffered mode. Command replies print as transcript lines and are spoken.

### States

- **Live:** today's behaviour.
- **Holding:** nothing drawn for this step; the tool and permission lines of earlier steps stay as they are.
- **Released:** the whole step's text appears, then the bell.
- **Interrupted:** partial text appears, no bell.

### Screenshot Checkpoints

Per test case in section 3.

## 7. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Step with text and tool calls in one response | Text and tool chunks replayed in their original order; bell rings because there is text |
| Empty text chunks | Held and replayed; do not count as text for the bell |
| Very long answer (thousands of lines) | Held in memory as an array of small objects; no size cap needed below the engine's own limits |
| Two steps of the same turn back to back | Each held and released separately; two bells |
| Mode turned on by `/a11y-on` in this session | Buffering follows the resolved state at session start plus the override; it does not switch mid-session without `/a11y-stream on` (the mode itself needs a restart anyway) |
| `--ax-screen-reader` flag alone, no variable, no setting | Invisible to the mod: mode reads as off, so buffering is off until `/a11y-stream on`. Documented in README |
| Hook fails before yielding | `.catch` forwards the stream beneath; the answer streams live |
| Hook fails after yielding some chunks | What was yielded stays; the rest comes from beneath (engine behaviour) |
| `claude -p`, SDK, VS Code panel | Mods do not run there; nothing changes |
| Subagent step | Forwarded live (AC-008) |

## 8. Dependencies

- Claude Code mod API: streaming hooks on `turn.step` (types checked for 2.1.295); `TurnStepChunk` kinds `text`, `thinking`, `tool`, `input`, `stop`, `engine`.
- `hooks/lib/mode-state.ts` from the detection feature for the default.
- `claude plugin test` kit: a test answers `turn.step` at the bottom with its own generator yielding chunks, so the hook's holding and replay can be asserted without a model.
- To verify by ear (TC-001): that VoiceOver in Terminal.app reads a block written in one go as one unit. If it still splits long blocks into lines, it does so without interrupting itself, which is the main gain.

## 9. Infrastructure Prerequisites

| Category | Requirement |
|----------|-------------|
| Environment variables | None beyond those the detection feature reads |
| Registry images | N/A |
| Cloud quotas | N/A |
| Network reachability | A model to talk to for the manual cases |
| CI status | N/A |
| External secrets | N/A |
| Database migrations | N/A |
| Test machines | macOS with VoiceOver for TC-001 to TC-006; Windows with NVDA later |

**Verification before implementation:** write a throwaway `turn.step` hook that logs chunk kinds and counts per step under `claude --plugin-dir .` to confirm the chunk sequence (text, tool, input, stop, engine) and that holding them delays nothing but the display.

## 10. Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-10-09 | 0.1.0 | Łukasz Majewski | Initial spec from /add:spec interview: hold a whole step, hide thinking, bell on release, active in screen reader mode with /a11y-stream override |
| 2026-10-10 | 0.1.3 | Łukasz Majewski | AC-005: earcon fallback when the notification channel does not deliver (no bell was heard on Terminal.app) |
| 2026-10-10 | 0.1.2 | Łukasz Majewski | AC-001: text chunks of a block merged into one before yielding, after VoiceOver skipped the first sentence of an answer painted in two frames |
| 2026-10-09 | 0.1.1 | Łukasz Majewski | After the TDD cycle: "Maps to" filled; the bell text is "Answer ready."; AC-011 verified by the validator listing and review, not by a kit test (a hook cannot be made to throw from the bottom) |
