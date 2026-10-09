# Manual test protocol: screen reader detection and mode enabling

Spec: `specs/screen-reader-detection.md`. Run with the screen reader on and a terminal the reader supports. Save each transcript capture as plain text under `tests/screenshots/screen-reader-detection/`. Note in the Audio column what was heard, by whom (screen reader, system voice, bell) and whether speech collided with the reader.

## Setup

1. `claude --version` prints 2.1.287 or later.
2. Clone the repository and run `npm install`, `npm test`, `claude plugin test .`, `claude plugin validate .`.
3. Start sessions with `claude --plugin-dir <repository>` from a shell. Do not use `/plugin install` from inside a session: that picker is the one that does not work with NVDA.
4. For a clean state before each case: remove `axScreenReader` from `~/.claude/settings.json` (Windows: `%USERPROFILE%\.claude\settings.json`), unset `CLAUDE_AX_SCREEN_READER`, and delete the mod's store entry (`/a11y-status` reports "No refusal stored." when it is clear; `/a11y-on` followed by `/a11y-off` clears it).

## Cases

| Case | Platform | Steps | Expected | Capture | Audio |
|------|----------|-------|----------|---------|-------|
| TC-001 | macOS, VoiceOver | Start, wait, type `y`, restart | Question spoken and printed; restart line; settings has `"axScreenReader": true`; second session starts with `[Screen Reader Mode: on via settings]` and the mod is silent | tc-001-question.txt, tc-001-restart.txt | |
| TC-002 | Windows 11, NVDA | As TC-001 | As TC-001 with "NVDA detected" | tc-002-question.txt | Which voice spoke? |
| TC-003 | either | Settings already true, start | No bell, no speech, no line; file unchanged | tc-003-silent.txt | |
| TC-004 | either | `CLAUDE_AX_SCREEN_READER=0`, start, `/a11y-status` | Silent start; status names the variable | tc-004-status.txt | |
| TC-005 | either | Answer `n`, restart, `/a11y-status` | Declined line; silent second start; status reports the stored refusal with date and version | tc-005-declined.txt | |
| TC-006 | either | `/a11y-on`, restart, `/a11y-off`, restart | Restart line; mode on; disabled line and key removed; graphical session asks again | tc-006-on.txt, tc-006-off.txt | |
| TC-007 | either | Trailing comma in settings, answer `y` | Error line with the manual fallback; file byte-identical; session continues | tc-007-error.txt | |
| TC-008 | either | Start, wait 30 s, send a prompt, restart | "No answer" line after 30 s; prompt handled normally; question asked again | tc-008-timeout.txt | |

## Extra checks

- The drop reason shown after `y` or `n`: is it read by the screen reader?
- Does `$.audio.speak` collide with the screen reader reading the transcript line?
- Does the native notification ring the terminal bell with `preferredNotifChannel` unset?
- A prompt typed while the question is pending that is not `y` or `n`: the question is withdrawn with a dim line and the prompt goes through.
