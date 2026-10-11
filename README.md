# claude-code-earshot

Screen reader companion for Claude Code, built for blind developers. The mod sits on top of the built-in screen reader mode and adds what the mode lacks: it switches the mode on when it finds a screen reader, shows each answer whole instead of streaming it line by line, keeps tool noise out of the transcript, and says when work starts and that it goes on.

The plugin is named `earshot`. It works with NVDA and JAWS on Windows and with VoiceOver on macOS.

## What it does

**Turns screen reader mode on.** At session start the mod looks for VoiceOver on macOS and NVDA or JAWS on Windows. If one is running and screen reader mode is off, it rings, speaks and prints one question: enable screen reader mode from the next start? Answer `y` or `n`.

- `y` does the same as `/earshot-on`: the mod saves the settings it is about to change, writes `"axScreenReader": true` and `"spinnerTipsEnabled": false` (no tips under the spinner) to your user settings, keeps a copy of the previous file beside it as `settings.json.earshot-backup`, and asks you to restart.
- `n` is remembered and not asked again until you run `/earshot-on` or update the mod.
- No answer within 30 seconds leaves the mode off for this session only.
- The mod never asks while `CLAUDE_AX_SCREEN_READER` is set, and never when your settings already say `false`.

**Turns itself off.** `/earshot-off` turns the whole mod off and puts back the settings `/earshot-on` changed, as they were. It stays off in later sessions and asks nothing until `/earshot-on`.

**Delivers whole answers.** In screen reader mode each answer appears at once, so the screen reader reads it in one go. The model's thinking is not shown, and a bell marks the moment the answer appears. `/earshot-stream on`, `/earshot-stream off` and `/earshot-stream auto` force or release this; the choice is remembered.

**Says when work starts.** As soon as a prompt starts a turn, the mod prints and speaks `Starting work.`, so you know the prompt was taken. The animated spinner word is hidden, because the screen reader would read every change of it.

**Says that work goes on.** While an answer is being prepared and nothing new has reached the transcript for 20 seconds, the mod prints and speaks `Still working, 20 seconds.`, then again at 40, 60 and so on. `/earshot-heartbeat 45` changes the interval (5 to 600 seconds), `/earshot-heartbeat off` stops it; the choice is remembered.

**Keeps tools quiet.** With whole answer delivery active, tool rows are hidden: the transcript carries Claude's own words, without the commands, file dumps, line counts or the `(ctrl+b to run in background)` hint in between.

- `/earshot-tools brief` narrates instead: one line per call from Claude's own description of it (`tool: List files and search for x`) and a count per result (`result: 292 lines`, `error: 3 lines`).
- `/earshot-tools full` leaves the rows to Claude Code, `/earshot-tools auto` returns to the default. The choice is remembered.
- In every mode but `full`, `/earshot-last` prints the full text of the last result, `/earshot-last 2` the one before, up to five back.
- Dialogs, including `AskUserQuestion`, are left as Claude Code draws them.

**Speaks your language.** Lines and command descriptions follow the system's display language: English, Polish, German, French, Spanish or Italian, English for any other. Command names and arguments stay in English.

**Helps find noise.** In a session started with `claude --debug`, every component the terminal draws is written as one line to the debug log (`~/.claude/debug/<session>.txt`, lines led by `earshot:` and `ui.render`). Nothing of it reaches the screen. `/earshot-log off` and `/earshot-log on` switch it; the choice is remembered.

## Commands

- `/earshot-on`, `/earshot-off`: turn the mod on or off.
- `/earshot-status`: whether the mod is on, which screen reader was detected, whether screen reader mode is on and what set it, and any stored refusal.
- `/earshot-stream [on|off|auto]`: whole answer delivery.
- `/earshot-tools [off|brief|full|auto]`: tool narration.
- `/earshot-last [n]`: the full text of a recent tool result.
- `/earshot-heartbeat [seconds|off]`: the interval of the progress line.
- `/earshot-log [on|off]`: the render log.

Each command without an argument reports the current state.

## Install

Requirements: Claude Code 2.1.292 or later as a native build, and Git (Claude Code clones the repository itself). Mods do not run under WSL, `claude -p`, the SDK, the VS Code panel or the cloud.

Install from a shell, because the in-session plugin picker is hard to use with a screen reader:

```
claude plugin install earshot --marketplace unlocked-spark/claude-code-earshot
claude
```

Inside a session the same works as `/plugin install earshot --marketplace unlocked-spark/claude-code-earshot`. Update with `claude plugin update earshot@unlocked-spark`.

On the first start with a screen reader running, answer `y` to the question and restart `claude`. To skip the question, set `CLAUDE_AX_SCREEN_READER=1` in your shell profile (PowerShell: `$env:CLAUDE_AX_SCREEN_READER = "1"`).

To try the mod from a clone without installing it: `claude --plugin-dir ./claude-code-earshot`.

On Windows `$.audio.play` has no player, so the bell's fallback sound is silent there; the bell itself and every line of the mod still reach the screen reader through the transcript.

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

- `docs/prd.md`: product requirements, scope and roadmap.
- `specs/`: one file per feature with acceptance criteria.
- `docs/testing/`: manual test protocols for NVDA and VoiceOver.
- `docs/research/rozpoznanie-2026-10-09.md` (Polish): what Claude Code offers screen reader users, open issues, the mod API, existing projects.
- `docs/research/spikes-2026-10.md`: answers to the mod API questions and loader constraints.
- `CHANGELOG.md`: what each release changed.

## License

Apache License 2.0.
