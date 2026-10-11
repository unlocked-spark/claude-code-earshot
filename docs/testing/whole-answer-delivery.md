# Manual test protocol: whole answer delivery

Spec: `specs/whole-answer-delivery.md`. Run in screen reader mode (`axScreenReader` set by the first feature) with VoiceOver on. Save transcript captures as plain text under `tests/screenshots/whole-answer-delivery/`. In the Audio column note whether the block was read as one unit, whether the reader interrupted itself, and whether the bell was heard.

## Setup

1. `claude --plugin-dir <repository>` from a shell; the first line confirms `[Screen Reader Mode: on via settings]`.
2. `/earshot-stream` reports `Whole answer delivery on (screen reader mode).` before TC-001.

## Cases

| Case | Steps | Expected | Capture | Audio |
|------|-------|----------|---------|-------|
| TC-001 | Ask for a five-paragraph explanation | Silence while the model writes, one bell, then the whole answer read from start to end without restarts; no `thinking:` lines | tc-001-whole.txt | |
| TC-002 | Ask Claude to read a file and summarise it | Tool line and permission prompt as usual; the summary step arrives whole with a bell; tool-only steps ring nothing | tc-002-tools.txt | |
| TC-003 | Start a session without the mode (`CLAUDE_AX_SCREEN_READER=0`), ask a question | Streams live, thinking shown, no extra bell | tc-003-live.txt | |
| TC-004 | `/earshot-stream on`, ask; `/earshot-stream off`, ask; `/earshot-stream auto`, `/earshot-stream` | Replies as in the spec; buffered, then live, then the report | tc-004-override.txt | |
| TC-005 | Ask for a long answer, press Escape after a few seconds | The partial answer appears, the turn ends as interrupted, no bell | tc-005-interrupt.txt | |
| TC-006 | After `/earshot-stream on`, restart and run `/earshot-stream` | `Whole answer delivery on (forced).` | tc-006-persist.txt | |

## Extra checks

- Does VoiceOver read a long block written at once as one unit, or line by line without interruption?
- Is the `Answer ready.` notification heard as a bell, and does it collide with the mode's own end-of-turn bell?
- Does hiding thinking remove anything you wanted to hear?
