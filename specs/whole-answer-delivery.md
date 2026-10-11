# Spec: Whole Answer Delivery

**Applies to:** earshot 0.1.7
**PRD Reference:** docs/prd.md
**Research:** docs/research/spikes-2026-10.md
**Status:** Implemented (automated tests pass; manual test cases in docs/testing/)

## 1. Overview

In screen reader mode Claude Code prints the model's answer as it streams, line by line. NVDA and VoiceOver read each new line as it appears and interrupt whatever they were reading, so a long answer is heard as a stutter of half-sentences.

The answer reaches the terminal through the streaming event `turn.step`, whose hooks are async generators: what the person sees is the concatenation of the chunks a hook yields. The mod holds every chunk of a model step until the step's stream has ended, then yields them at once, each block's text as one chunk. The terminal paints the whole answer in one frame and the screen reader reads it as one block. Thinking is not shown. A bell marks the moment the answer appears.

Whole answer delivery is on when the session runs in screen reader mode and the mod is on, and can be forced on or off with `/earshot-stream`. Tool narration (specs/tool-narration.md) follows the same switch.

### User Story

As a blind developer using Claude Code in screen reader mode, I want each answer to appear whole instead of line by line, so that my screen reader reads it in one go without interrupting itself.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | A `turn.step` hook consumes the stream beneath it to the end before yielding anything, then yields the held chunks in the order received, with each run of text chunks of one block merged into a single chunk, and returns the step's result unchanged. | Must |
| AC-002 | Chunks of kind `tool`, `input`, `stop` and `engine` are held and always yielded, never dropped, so the engine records and runs every tool call exactly as without the mod. | Must |
| AC-003 | Chunks of kind `thinking` are dropped in buffered mode: nothing of the model's thinking is shown or read. The transcript's recorded thinking is the engine's signed block and is unaffected. | Must |
| AC-004 | Chunks of kind `text` are held and yielded in order, so the printed and recorded answer is identical to the unbuffered one. | Must |
| AC-005 | After the held chunks are yielded for a step whose answer has non-empty text, and the step was not aborted, the mod raises the native notification `Answer ready.` (the bell on the user's channel); when the notification is not delivered, it plays the bundled earcon `assets/earcons/answer-ready.wav` through `$.audio.play`. A step with no visible text raises nothing. | Must |
| AC-006 | Buffered mode is active when the mod is on, the resolved mode state is on (`CLAUDE_AX_SCREEN_READER` truthy, or `axScreenReader` true in settings) and no override is stored. Outside buffered mode the hook forwards chunks as they arrive, adding no delay. | Must |
| AC-007 | `/earshot-stream on` forces buffered mode for this and later sessions, `/earshot-stream off` forces live streaming, `/earshot-stream auto` removes the override; each answers with one sentence naming the resulting mode and whether it is forced or follows the screen reader mode. `/earshot-stream` alone reports the current state. The override lives in `$.store` under `streamDelivery`. A change also recomputes tool narration when it is not forced. | Must |
| AC-008 | Steps that belong to a subagent (`e.agentId` set) are never buffered; the hook forwards them unchanged. | Must |
| AC-009 | When the stream beneath fails or the step is interrupted (Escape or Ctrl+C), the hook yields whatever it has held so far before ending, so the transcript keeps the partial answer, and rings no bell. | Must |
| AC-010 | The hook does no work of its own per chunk beyond keeping it, so its own time stays far below the hook budget however long the model takes. | Should |
| AC-011 | If the hook fails, its `.catch` handler forwards the stream beneath unchanged, so a fault in buffering degrades to live streaming rather than a lost answer. | Must |
| AC-012 | `claude plugin validate .` passes and lists `turn.step` among the hooks. | Must |
| AC-013 | README documents the behaviour, the bell, the hidden thinking and the forms of `/earshot-stream`. | Should |

## 3. User Test Cases

Full steps for NVDA on Windows 11 and VoiceOver on macOS are in `docs/testing/whole-answer-delivery.md`.

| ID | Scenario | Expected | Automated coverage |
|----|----------|----------|--------------------|
| TC-001 | Long answer in screen reader mode | Silence while the model writes, one bell, the whole answer read from first line to last without restarts; no thinking | hooks/stream.test.ts → "holds the whole step, drops thinking, keeps order and rings once (AC-001 to AC-005)" |
| TC-002 | A turn with tool calls | Tool calls run as usual; the step with text arrives whole with a bell; tool-only steps ring nothing | hooks/stream.test.ts → "rings no bell for a step without text (AC-005)" |
| TC-003 | Outside screen reader mode | The answer streams live, thinking shown, no extra bell | hooks/stream.test.ts → "streams live outside screen reader mode, thinking included, no bell (AC-006)" |
| TC-004 | `/earshot-stream on`, `off`, `auto`, report | Replies as in section 5; buffered, then live, then the report | hooks/stream.test.ts → "/earshot-stream on, off and auto change the mode and the store (AC-007)" |
| TC-005 | Escape during a long answer | The partial answer appears, the turn ends as interrupted, no bell | manual only |
| TC-006 | Override after a restart | `/earshot-stream` reports `Whole answer delivery on (forced).` | hooks/stream.test.ts → "a stored override forces buffering outside the mode and survives sessions (AC-007, TC-006)" |
| TC-007 | No notification channel | The earcon plays instead of the bell | hooks/stream.test.ts → "plays the ready earcon when no notification channel delivers (AC-005)" |

## 4. Data Model

### StreamOverride (`$.store`, key `streamDelivery`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mode | `"buffered" \| "live"` | Yes | What the user forced |
| setAt | ISO date string | Yes | |

An absent key means `auto`: follow the screen reader mode.

### Held step (in memory, one per step in flight)

| Field | Type | Description |
|-------|------|-------------|
| chunks | TurnStepChunk[] | Every chunk received except `thinking` |
| hasText | boolean | Whether any non-empty `text` chunk was held; decides the bell |

## 5. API Contract

### Commands

| Command | Effect | Reply |
|---------|--------|-------|
| `/earshot-stream` | Report | "Whole answer delivery on (forced)." / "... on (screen reader mode)." / "... off (forced)." / "... off (screen reader mode is off)." |
| `/earshot-stream on` | Store `{ mode: "buffered" }` | "Whole answer delivery on (forced). Answers appear whole; thinking is hidden." |
| `/earshot-stream off` | Store `{ mode: "live" }` | "Whole answer delivery off (forced). Answers stream live." |
| `/earshot-stream auto` | Delete the key | "Override removed." followed by the report line |

### Mod API usage

| Call or event | Purpose |
|---------------|---------|
| `on('turn.step', async function* ...)` with `.catch` | Hold and replay chunks |
| `next.signal` | No bell after an interrupted step |
| `$.ui.notify`, `$.audio.play` | Bell, earcon fallback |
| `$.store.get/set/delete('streamDelivery')` | Override |
| `$.audio.speak` | Speak the command reply |

## 6. UI Behavior

The visible change is timing: in buffered mode the answer appears at once instead of growing, and thinking lines are absent. Command replies print as transcript lines and are spoken.

### States

- **Live:** the engine's own streaming.
- **Holding:** nothing drawn for this step.
- **Released:** the whole step's text appears, then the bell.
- **Interrupted:** the partial text appears, no bell.

## 7. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Text and tool calls in one step | Replayed in their original order; bell because there is text |
| Empty text chunks | Held and replayed; not counted as text for the bell |
| Very long answer | Held in memory as an array of small objects |
| Two steps of one turn | Each held and released separately; two bells |
| Mode turned on by `/earshot-on` in this session | Delivery follows the state read at session start plus the override; the mode itself needs a restart |
| `--ax-screen-reader` flag alone | Invisible to the mod: delivery is live until `/earshot-stream on` |
| Mod turned off with `/earshot-off` | Live delivery at once |
| Subagent step | Forwarded live (AC-008) |

## 8. Dependencies

- Claude Code mod API: streaming hooks on `turn.step`; `TurnStepChunk` kinds `text`, `thinking`, `tool`, `input`, `stop`, `engine`.
- The mode state from specs/screen-reader-detection.md.
