# Manual test protocol: whole answer delivery

Spec: `specs/whole-answer-delivery.md`. Primary platform: Windows 11 with NVDA in Windows Terminal. Second platform: macOS with VoiceOver. The session runs in screen reader mode with the mod on; `/earshot-stream` reports `Whole answer delivery on (screen reader mode).` before TC-001. Record pass or fail per platform and whether each answer was read as one unit.

## Cases

| Case | Steps | Expected |
|------|-------|----------|
| TC-001 | Ask for a five-paragraph explanation | `Starting work.`, silence while the model writes, one bell, then the whole answer read from start to end without restarts; no thinking lines |
| TC-002 | Ask Claude to read a file and summarise it | The tool runs (rows hidden by default; permission prompt if any); the summary arrives whole with a bell; steps with tool calls only ring nothing |
| TC-003 | Start without screen reader mode (`CLAUDE_AX_SCREEN_READER=0`), ask a question | The answer streams live, thinking shown, no extra bell |
| TC-004 | `/earshot-stream on`, ask; `/earshot-stream off`, ask; `/earshot-stream auto`; `/earshot-stream` | `... on (forced). Answers appear whole; thinking is hidden.`, buffered answer; `... off (forced). Answers stream live.`, live answer; `Override removed.` and the report |
| TC-005 | Ask for a long answer, press Escape after a few seconds | The partial answer appears, the turn ends as interrupted, no bell |
| TC-006 | `/earshot-stream on`, restart, `/earshot-stream` | `Whole answer delivery on (forced).` |
| TC-007 | Ask for an answer longer than one screen | Read as one block; the screen reader does not skip its first sentence |

## Extra checks

- Is the `Answer ready.` bell heard, and does it collide with the screen reader starting to read?
- Does hiding thinking remove anything you wanted to hear?
