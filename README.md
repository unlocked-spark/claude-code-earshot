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

Everything below is typed in a shell, not inside a Claude Code session: the in-session plugin picker is the dialog that does not work with NVDA.

Requirements: Claude Code 2.1.287 or later as a native build (mods do not run under WSL, `claude -p`, the SDK, the VS Code panel or the cloud), Git, and the GitHub CLI logged in to an account that can read the repository while it is private.

### Windows (PowerShell)

```
gh auth login
gh repo clone unlocked-spark/claude-code-a11y $HOME\claude-code-a11y
claude plugin marketplace add $HOME\claude-code-a11y
claude plugin install a11y-companion@unlocked-spark --scope user
claude
```

The marketplace points at the cloned folder, so an update is `git pull` in that folder followed by `/reload-plugins` in a session. To try the mod without installing it: `claude --plugin-dir $HOME\claude-code-a11y`.

On first start with NVDA or JAWS running and screen reader mode off, the mod asks by voice whether to enable the mode; answer `y`, then restart `claude`. To skip the question, set the variable once in your profile: `$env:CLAUDE_AX_SCREEN_READER = "1"`.

Known gaps on Windows: `$.audio.play` has no player there, so the ready earcon is silent, and whether `$.audio.speak` reaches NVDA is still untested.

### macOS

```
gh auth login
gh repo clone unlocked-spark/claude-code-a11y ~/claude-code-a11y
claude plugin marketplace add ~/claude-code-a11y
claude plugin install a11y-companion@unlocked-spark --scope user
claude
```

Once the repository is public, one line inside a session does the same: `/plugin install a11y-companion --marketplace unlocked-spark/claude-code-a11y`.

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
