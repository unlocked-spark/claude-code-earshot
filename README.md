# claude-code-earshot

Screen reader companion for Claude Code, built for blind developers. The mod sits on top of the built-in screen reader mode and adds what the mode lacks. First feature: it notices a running screen reader, asks by voice, and switches the next session into screen reader mode.

The plugin is named `earshot`. Stage: three features implemented and tested (mode enabling confirmed with VoiceOver; whole answer delivery and tool narration awaiting their VoiceOver sessions), NVDA sessions pending.

## What it does today

- At session start it detects VoiceOver on macOS and NVDA or JAWS on Windows.
- If the screen reader mode is off and nothing says otherwise, it rings, speaks and prints one question: enable screen reader mode from the next start? You answer `y` or `n`.
- `y` writes `"axScreenReader": true` to your user settings file (a copy of the previous content is kept beside it as `settings.json.a11y-backup`) and tells you to restart. `n` is remembered and not asked again until you run `/a11y-on` or the mod is updated. No answer within 30 seconds leaves the mode off for this session only.
- It never writes while `CLAUDE_AX_SCREEN_READER` is set, and never when your settings already say `false`.
- In screen reader mode each answer appears whole instead of streaming line by line, so the screen reader reads it in one go. The model's thinking is not shown in this mode, and a bell marks the moment the answer appears. `/a11y-stream on`, `/a11y-stream off` and `/a11y-stream auto` force or release this behaviour; the choice is remembered across sessions.
- With whole answer delivery active, tool rows are hidden by default: the transcript carries Claude's own words and nothing of the commands, file dumps or line counts in between. `/a11y-tools brief` narrates instead: each tool call is one line built from Claude's own description of it (`tool: List files and search for x`), and each result is a count (`result: 292 lines`, `error: 3 lines`). `/a11y-tools full` leaves the rows to Claude Code, `/a11y-tools auto` returns to the default. The choice is remembered across sessions. In every mode but full, `/a11y-last` prints the full text of the last result, `/a11y-last 2` the one before, up to five back. Dialogs and the engine's folded groups are untouched.
- A heartbeat for long silences: in screen reader mode, while an answer is being prepared and nothing new has reached the transcript for 20 seconds, the mod prints and speaks `Still working, 20 seconds.`, then again at 40, 60 and so on until the next visible row. `/a11y-heartbeat 45` changes the interval (5 to 600 seconds), `/a11y-heartbeat off` stops it; the choice is remembered.
- A render log for finding noise: every component the terminal draws (notices, hints, spinner words, mode labels, transcript rows) is written as one line to the debug log of a session started with `claude --debug` (`~/.claude/debug/<session>.txt`, lines led by `earshot:` and `ui.render`). Nothing of it reaches the screen. `/a11y-log off` stops it, `/a11y-log on` resumes it; the choice is remembered.
- Commands: `/a11y-on`, `/a11y-off`, `/a11y-status`, `/a11y-stream`, `/a11y-tools`, `/a11y-last`, `/a11y-heartbeat`, `/a11y-log`.

## Install

From a shell, with Git installed (Claude Code clones the repository itself) and Claude Code 2.1.292 or later as a native build (mods do not run under WSL, `claude -p`, the SDK, the VS Code panel or the cloud):

```
claude plugin install earshot --marketplace unlocked-spark/claude-code-earshot
claude
```

Or inside a session: `/plugin install earshot --marketplace unlocked-spark/claude-code-earshot`. Updates: `claude plugin update earshot@unlocked-spark`.

On first start with a screen reader running and screen reader mode off, the mod asks whether to enable the mode; answer `y`, then restart `claude`. To skip the question, set `CLAUDE_AX_SCREEN_READER=1` in your shell profile (PowerShell: `$env:CLAUDE_AX_SCREEN_READER = "1"`).

To try the mod from a clone without installing it: `claude --plugin-dir ./claude-code-earshot`.

Known gaps on Windows: `$.audio.play` has no player there, so the ready earcon is silent, and whether `$.audio.speak` reaches NVDA is still untested.

## Develop

```
npm install
npm test                  # unit tests of the pure modules (Vitest)
claude plugin test .      # mod-level tests with the claude-code/testing kit
npm run typecheck         # tsc against the engine's type declarations
npm run lint
claude plugin validate .
```

The engine writes its type declarations into `.claude-plugin/types/` the first time it loads the mod from this folder; `tsc` needs them.

## Documents

- `docs/prd.md`: product requirements, scope, milestones.
- `specs/`: one file per feature with acceptance criteria and manual test cases.
- `docs/testing/`: manual test protocols for VoiceOver and NVDA.
- `docs/research/rozpoznanie-2026-10-09.md` (Polish): what Claude Code offers today, open issues, the mod API, existing projects.
- `docs/research/spikes-2026-10.md`: answers to the spec's open questions and loader constraints.

## License

Apache License 2.0. The tool-call significance classification planned for a later version draws on claude-sonar (MIT), which will be credited where it is used.
