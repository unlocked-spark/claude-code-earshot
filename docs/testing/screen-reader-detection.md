# Manual test protocol: screen reader detection and mod activation

Spec: `specs/screen-reader-detection.md`. Primary platform: Windows 11 with NVDA in Windows Terminal. Second platform: macOS with VoiceOver in Terminal or iTerm2. Record each case as pass or fail per platform, with a note of what was heard: the screen reader, a separate system voice, the bell.

## Setup

1. `claude --version` prints 2.1.292 or later.
2. Install from a shell: `claude plugin install earshot --marketplace unlocked-spark/claude-code-earshot`, or update with `claude plugin update earshot@unlocked-spark`.
3. Settings file: Windows `%USERPROFILE%\.claude\settings.json`, macOS `~/.claude/settings.json`.
4. Clean state for a case that needs the start question: run `/earshot-on` (clears a stored refusal or a stored off), quit, remove `axScreenReader` from the settings file by hand, make sure `CLAUDE_AX_SCREEN_READER` is not set, start `claude`.

## Cases

| Case | Steps | Expected |
|------|-------|----------|
| TC-001 | Clean state, reader running; start `claude`, answer `y` (`t` on a Polish system), quit, start again | Bell, question spoken and printed naming the reader; `earshot: Answered.` replaces the prompt; restart line; settings hold `"axScreenReader": true` and `"spinnerTipsEnabled": false`, other keys and indentation unchanged; `settings.json.earshot-backup` holds the previous content; second start opens in screen reader mode and the mod asks nothing |
| TC-002 | Settings already have `axScreenReader: true`; start | Right after Claude Code's header: `earshot: Welcome to Earshot for Claude Code. To turn it off, type /earshot-off.` (`Witaj w Earshot dla Claude Code. Aby go wyłączyć, wpisz /earshot-off.` on a Polish system); no bell, no question; file unchanged |
| TC-003 | `CLAUDE_AX_SCREEN_READER=0` (PowerShell: `$env:CLAUDE_AX_SCREEN_READER = "0"`); start; `/earshot-status` | Silent start; status says the variable keeps the mode off and the mod will not change settings while it is set |
| TC-004 | Clean state; answer `n`; quit and start; `/earshot-status` | Declined line with the `/earshot-on` hint; silent second start; status reports the refusal with date and mod version |
| TC-005 | Note `axScreenReader` and `spinnerTipsEnabled` in the settings file; `/earshot-on`; restart; `/earshot-off`; restart | On: restart line, both keys set. After restart: screen reader mode on, no tips under the spinner. Off: `Earshot off. ...`; both keys back exactly as noted (absent keys absent). Next start: no welcome line, tool rows, spinner and streaming drawn by Claude Code; no question |
| TC-006 | Mod off; `/earshot-off` again | `Earshot is already off; nothing changed.` |
| TC-007 | Add a trailing comma to the settings file; clean state; answer `y` | Error line with the manual fallback; file byte-identical; session continues |
| TC-008 | Clean state; wait 30 s without answering; send a prompt; restart | Withdrawal line after 30 s; prompt answered normally; question asked again at the next start |
| TC-009 | Clean state; type an ordinary prompt instead of an answer | Question withdrawn with one line; the prompt goes to Claude |
| TC-010 | `/earshot-status` with the reader running and the mode on | Mod on, reader named, mode on with its source, no refusal stored |

## Extra checks

- Is each mod line read once, or twice (screen reader plus a separate system voice)?
- Is the bell heard on the start question and after `y`?
