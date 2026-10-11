# claude-code-earshot: Product Requirements Document

**Version:** 0.1.5
**Author:** Łukasz Majewski
**Status:** Active
**Source research:** `docs/research/rozpoznanie-2026-10-09.md` (Polish)

## 1. Problem Statement

Claude Code ships an optional screen reader mode (`--ax-screen-reader`, since 2.1.181) that flattens the interface into labelled plain text, renders menus as numbered lists and rings the terminal bell at the end of a turn. It is a solid base, but blind developers using NVDA, JAWS and VoiceOver still report the same gaps:

- Streamed text is read as it arrives and cannot be paused; long answers become a stream of fragments (#87978, #37569, #35579).
- Nothing says that a prompt was taken, and a single bell is the only sign that a turn ended.
- Every tool call is narrated with the same weight as the answer: full shell commands, file dumps, hints and spinner words are all read aloud.
- Pickers and menus are silent: arrow keys in the slash command menu produce no speech, and the `AskUserQuestion` picker is hard to use with NVDA (#100253, #88839, #99660).
- The mode does not turn itself on (#89002), and the environment variable is sometimes ignored (#88221).

**Hypothesis:** a single mod that treats the screen reader mode as its base layer and adds only what the mode lacks lets a blind developer run a full Claude Code session without sighted help.

## 2. Target Users

| User | Setup | What they need |
|------|-------|----------------|
| Blind developer on Windows | NVDA or JAWS, Windows Terminal, Claude Code CLI | Whole answers, a quiet transcript, audible turn boundaries, usable dialogs |
| Blind developer on macOS | VoiceOver, Terminal or iTerm2 | The same, without speech that fights VoiceOver |
| Blind developer on Linux | Orca, GNOME Terminal | Lower priority; detection and speech not yet covered |

The mod runs in the Claude Code terminal. It does not run in `claude -p`, the SDK, the cloud, the VS Code panel or WSL, which the mod API does not support. Low-vision and motion-sensitive users are served by the built-in mode and `prefersReducedMotion`, not by this mod.

## 3. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unassisted session | A blind tester with NVDA and one with VoiceOver install from the shell, restart, send prompts, answer an `AskUserQuestion`, approve a permission and hear every turn start and end | Protocols in `docs/testing/` |
| Turn boundaries | The start of work and the arrival of the answer are heard in every turn | Manual test, counted per turn |
| Tool noise | No tool command, file dump, hint or spinner word read aloud by default | Manual test with a 20-call session |
| Mode enabling | With a screen reader running, the second session starts in screen reader mode without editing files by hand | Manual test on Windows and macOS |
| Validity | `claude plugin validate .`, unit and mod tests pass on every commit, on the current Claude Code release | Local gates |

## 4. Scope

### Delivered

1. **Screen reader detection and mode enabling** (`specs/screen-reader-detection.md`). VoiceOver, NVDA and JAWS detected at session start; one spoken y/n question; `/earshot-on` saves the settings it changes and writes `axScreenReader: true` and `spinnerTipsEnabled: false`; `/earshot-off` restores them and turns the whole mod off; a refusal is remembered; `CLAUDE_AX_SCREEN_READER` is never overridden.
2. **Whole answer delivery** (`specs/whole-answer-delivery.md`). In screen reader mode each model step is shown at once, thinking is hidden, and a bell marks the answer; `/earshot-stream` overrides it.
3. **Tool narration and turn signals** (`specs/tool-narration.md`). Tool rows, folded tool groups, the run-in-background hint and the spinner word are hidden by default; `brief` narrates one line per call and a count per result; `/earshot-last` prints recent results. Each turn opens with `Starting work.`, and a heartbeat says `Still working, N seconds.` after each N seconds of silence. A render log in the debug sink shows what the terminal drew.
4. **System language** (`specs/system-language.md`). Lines and command descriptions in English, Polish, German, French, Spanish or Italian, from the system's display language.

### Next

1. **End-of-turn summary.** On `turn.complete`, one short sentence: the number of tool calls, errors, questions waiting.
2. **Earcons.** Distinct short sounds for work started, answer ready, waiting for you, tool error; every sound has a text equivalent.
3. **Screen-reader-usable `AskUserQuestion`.** A numbered list in plain text, answered with a digit, if the built-in dialog stays unusable with NVDA.
4. **Tool call significance.** Classify calls as noise, routine, notable or important (approach of claude-sonar, MIT, credited where used) and narrate errors, writes and permission requests in the default mode.
5. **Limit and engine notices.** Find the notices a screen reader reads that the mod can reach, and file the rest upstream.
6. **Linux.** Orca detection and speech through `spd-say`.

### Out of Scope

- Anything the mod API cannot reach: the permission prompt, the input field, the slash command menu, lines the engine draws without `ui.render` (such as `Loaded CLAUDE.md`), the desktop app and the VS Code panel. These become bug reports to Anthropic.
- `claude -p`, SDK, cloud and WSL sessions.
- Braille display support.
- A GUI wrapper around the CLI.

## 5. Architecture

### Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Mod | TypeScript, ES modules | 5.x, strict | Runs inside the Claude Code process; `hooks/hooks.json` points at `hooks/register.ts` |
| Mod runtime | Claude Code mod API | 2.1.292 or later | Events `session.start`, `prompt.submit`, `command.run`, `turn.start`, `turn.step`, `turn.complete`, `ui.render`; APIs `$.ui`, `$.audio`, `$.process.run`, `$.fs`, `$.store`, `$.clock`, `$.env` |
| Tooling | Node 22, npm | 22.x | Vitest, the `claude-code/testing` kit, ESLint, `tsc` |
| State | `$.store`, `~/.claude/settings.json` | | Settings written only with consent, saved before and restored by `/earshot-off` |

`hooks/register.ts` is the only module that calls the mod API; `hooks/state.ts` and `hooks/lib/` hold `$`-free state, decisions and the language tables.

### Infrastructure

| Component | Choice | Notes |
|-----------|--------|-------|
| Git host | GitHub | `unlocked-spark/claude-code-earshot`, public, Apache 2.0 |
| Distribution | The repository is its own marketplace | `claude plugin install earshot --marketplace unlocked-spark/claude-code-earshot`; a release is a version bump in `.claude-plugin/plugin.json` pushed to `main` |
| CI/CD | Local gates | `npm test`, `claude plugin test .`, `npm run lint`, `npm run typecheck`, `claude plugin validate .` |

Manual testing uses Windows 11 with NVDA and macOS with VoiceOver.

## 6. Roadmap

**Current maturity:** POC, published as a public preview.

| Milestone | Goal | Status |
|-----------|------|--------|
| M1: Readable session | Mode enabled by consent, whole answers, quiet tools, turn start and heartbeat, six languages, on Windows and macOS | Delivered in 0.1.5 |
| M2: Heard turn | End-of-turn summary and earcons | Next |
| M3: Usable dialogs, smarter narration | `AskUserQuestion` by ear, significance classifier | Later |
| M4: Beta | Protocols run with NVDA and VoiceOver on each Claude Code release, two external blind users confirm the scripted session, reproductions posted to #87978 and #100253 | Later |

### Maturity Promotion Path

| From | To | Requirements |
|------|-----|-------------|
| poc → alpha | Manual protocols in `docs/testing/` passed with NVDA and VoiceOver, lint and typecheck in a pre-commit hook |
| alpha → beta | Coverage above 50% of testable code, protocols repeated per Claude Code release, CHANGELOG maintained |
| beta → ga | 30 days without regressions across Claude Code releases, two external blind users confirming the scripted session |

## 7. Non-Functional Requirements

- **Performance:** hooks finish well under the engine's budget; speech is queued and never blocks; buffering keeps per-chunk work to a push.
- **Security:** the only file written outside the plugin is `~/.claude/settings.json` and its backup `settings.json.earshot-backup`, only with consent (the start question or `/earshot-on`) and reversibly; the start question is never asked while `CLAUDE_AX_SCREEN_READER` is set.
- **Accessibility:** nothing is conveyed by sound alone; every spoken line is also printed; lines are short sentences that stand on their own when heard once.
- **Compatibility:** Claude Code 2.1.292 or later; Windows 11 and macOS. Re-tested on Claude Code releases, because screen reader regressions are frequent.
- **Licensing:** Apache 2.0.

## 8. Open Questions

- Does `$.audio.speak` on Windows reach NVDA, add a second system voice, or stay silent? The mod's lines reach the screen reader through the transcript either way.
- Does the built-in numbered `AskUserQuestion` already work with NVDA, making the custom dialog unnecessary?
- Which notices (usage limits, engine lines) can the mod reach through `ui.render`, and which need upstream fixes?
