# Session Handoff
**Written:** 2026-10-11 17:32

## In Progress
- Version 0.1.8 is released on main (public repository, own marketplace). Four specs implemented: screen reader detection, whole answer delivery, tool narration, system language. Used daily with NVDA on Windows; only tool narration TC-003 is recorded as a formal pass.
- Development between 2026-10-10 and 2026-10-11 (0.1.1 to 0.1.8) happened on a second machine without ADD: no cycle snapshots, observations or learnings were written there; the learnings were reconstructed from the commits on 2026-10-11.

## Decisions Made
- Commands are named after the mod: /earshot-on, /earshot-off, /earshot-status, /earshot-stream, /earshot-tools, /earshot-last, /earshot-log, /earshot-heartbeat.
- In screen reader mode tool rows, folded groups, the run-in-background hint and the spinner line are hidden by default; /earshot-tools brief|full brings them back. The turn start line and the heartbeat replace the spinner as signs of life.
- /earshot-on saves the settings it changes and /earshot-off restores them and keeps the mod off.
- Paragraph narration through the screen reader is out of scope for now.
- On macOS, VoiceOver follows the terminal cursor and skips the start of a block written in one frame; whole answer delivery works as intended with NVDA, which reads new terminal text as a diff.

## Blockers
- None. VoiceOver reading of whole answers on macOS remains an open problem (CLAUDE_AX_PREPARK_MS and VoiceOver AppleScript output untested).

## Next Steps
1. Run the manual protocols in docs/testing/ formally on NVDA and record the results; then /add:promote for Alpha.
2. M2 Heard turn: /add:spec "end of turn summary" (spoken summary and earcons; on Windows earcons need a player other than $.audio.play).
3. Decide the VoiceOver path: test CLAUDE_AX_PREPARK_MS and `osascript ... VoiceOver output` timing.
