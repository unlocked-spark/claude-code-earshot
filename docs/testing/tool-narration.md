# Manual test protocol: tool narration, turn signals and render log

Spec: `specs/tool-narration.md`. Primary platform: Windows 11 with NVDA in Windows Terminal. Second platform: macOS with VoiceOver. The session runs in screen reader mode with the mod on and no `/earshot-tools` override (`/earshot-tools` reports `Tool narration off (whole answer delivery).`). Record pass or fail per platform and anything read that the case does not expect.

## Cases

| Case | Steps | Expected |
|------|-------|----------|
| TC-001 | Ask Claude to run a shell command that takes a few seconds and to read a file | Only `Starting work.` and Claude's words are read; no tool rows, no counts, no command text, no `(ctrl+b to run in background)`, no spinner words |
| TC-002 | `/earshot-tools brief`; repeat TC-001 | `tool: <Claude's description>` (`narzędzie: ...` in Polish) and `result: <N> lines` per call; still no ctrl+b hint |
| TC-003 | In brief, ask for a command on a missing file | `tool error: <description>` and `error: <N> lines`; no stderr text |
| TC-004 | In brief, ask Claude to read three files (they fold into a group) | One line per call; no `$ cat ...` under a `Reading 1 file…` line. Back in off: nothing |
| TC-005 | `/earshot-last`, `/earshot-last 2`, `/earshot-last 9` | Full text of the last result under `Result of: <summary>`, then the one before, then `Only <k> results are kept; ask for 1 to <k>.` |
| TC-006 | `/earshot-tools full`, run a command; `/earshot-tools auto` | Claude Code's own tool rows and ctrl+b hint; then `Override removed. Tool narration off (whole answer delivery).` and rows hidden again |
| TC-007 | Ask something that makes Claude ask a question (`AskUserQuestion`) | The engine's question dialog, unchanged |
| TC-008 | Send a prompt that needs a long search across a large folder | `Starting work.` right after the prompt; after 20 s with nothing new, `Still working, 20 seconds.`, then 40, until the answer; nothing after the answer |
| TC-009 | `/earshot-heartbeat 45`, repeat TC-008; `/earshot-heartbeat off`, repeat | First at 45 s; with off only `Starting work.` |
| TC-010 | `/earshot-stream off`, send a prompt that runs a command | No `Starting work.`, no heartbeat; Claude Code's own rows and spinner |
| TC-011 | Start `claude --debug`, work for a few turns, open `~/.claude/debug/<session>.txt` | `earshot: ui.render <Component> ...` lines naming what the terminal drew; after `/earshot-log off`, no new ones |
| TC-012 | `/earshot-off`, send a prompt that runs a command | Everything drawn by Claude Code; no line from the mod |

## Extra checks

- Is anything read during a turn that none of the cases names (tips, notices, hints)? Note its text, then find its component in the render log (TC-011).
- Does a one-line result read `result: 1 line`?
