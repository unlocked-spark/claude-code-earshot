# claude-code-a11y

Screen reader companion for Claude Code, built for blind developers. The mod sits on top of the built-in screen reader mode and adds what the mode lacks. First feature: it notices a running screen reader, asks by voice, and switches the next session into screen reader mode.

The plugin is named `a11y-companion`. Stage: three features implemented and tested (mode enabling confirmed with VoiceOver; whole answer delivery and tool narration awaiting their VoiceOver sessions), NVDA sessions pending.

## What it does today

- At session start it detects VoiceOver on macOS and NVDA or JAWS on Windows.
- If the screen reader mode is off and nothing says otherwise, it rings, speaks and prints one question: enable screen reader mode from the next start? You answer `y` or `n`.
- `y` writes `"axScreenReader": true` to your user settings file (a copy of the previous content is kept beside it as `settings.json.a11y-backup`) and tells you to restart. `n` is remembered and not asked again until you run `/a11y-on` or the mod is updated. No answer within 30 seconds leaves the mode off for this session only.
- It never writes while `CLAUDE_AX_SCREEN_READER` is set, and never when your settings already say `false`.
- In screen reader mode each answer appears whole instead of streaming line by line, so the screen reader reads it in one go. The model's thinking is not shown in this mode, and a bell marks the moment the answer appears. `/a11y-stream on`, `/a11y-stream off` and `/a11y-stream auto` force or release this behaviour; the choice is remembered across sessions.
- With whole answer delivery active, tool activity is narrated instead of printed: each tool call is one line built from Claude's own description of it (`tool: List files and search for x`), and each result is a count (`result: 292 lines`, `error: 3 lines`). `/a11y-last` prints the full text of the last result, `/a11y-last 2` the one before, up to five back. Dialogs and the engine's folded groups are untouched.
- Commands: `/a11y-on`, `/a11y-off`, `/a11y-status`, `/a11y-stream`, `/a11y-last`.

## Install

From a shell, not from inside a session (the in-session plugin picker is the dialog that does not work with NVDA):

```
/plugin install a11y-companion --marketplace unlocked-spark/claude-code-a11y
```

The marketplace listing is not published yet. Until then, run the mod from a clone:

```
git clone https://github.com/unlocked-spark/claude-code-a11y
claude --plugin-dir ./claude-code-a11y
```

Requires Claude Code 2.1.287 or later. Mods do not run in `claude -p`, the SDK, the cloud, the VS Code panel or WSL.

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
