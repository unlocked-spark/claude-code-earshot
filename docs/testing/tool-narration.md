# Manual test protocol: tool narration

Spec: `specs/tool-narration.md`. Run in screen reader mode with VoiceOver on, whole answer delivery active (`/a11y-stream` reports on). Save transcript captures as plain text under `tests/screenshots/tool-narration/`.

## Cases

| Case | Steps | Expected | Capture | Audio |
|------|-------|----------|---------|-------|
| TC-001 | Ask Claude to read two Markdown files and summarise them | `tool: <Claude's description>` and `result: <N> lines`; no command text, no file content; summary arrives whole | tc-001-bash.txt | |
| TC-002 | Ask Claude to run a command on a missing file | `tool error: <description>` and `error: <N> lines`; no stderr text | tc-002-error.txt | |
| TC-003 | `/a11y-last`, `/a11y-last 2`, `/a11y-last 9` | Full text of the last result, then the one before, then `Only 2 results are kept; ask for 1 to 2.` | tc-003-last.txt | |
| TC-004 | Ask Claude to read three files, then something that makes it ask a question | `Read 3 files` group line is the engine's; the question dialog is the engine's numbered list | tc-004-untouched.txt | |
| TC-005 | `/a11y-stream off`, ask for a shell command | The engine's own `tool: Bash (...)` row and full result | tc-005-off.txt | |

## Extra checks

- Is `tool running: ...` heard while a long command runs, and does the final `tool: ...` replace it cleanly?
- Does `(ctrl+o to expand)` still appear anywhere in narrated rows? It should not.
- Does a result of exactly one line read `result: 1 line`?
