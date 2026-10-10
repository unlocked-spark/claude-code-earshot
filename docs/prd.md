# claude-code-earshot: Product Requirements Document

**Version:** 0.1.0
**Created:** 2026-10-09
**Author:** Łukasz Majewski
**Status:** Draft
**Source research:** `docs/research/rozpoznanie-2026-10-09.md` (Polish, state as of 2026-10-09)

## 1. Problem Statement

Claude Code ships an optional screen reader mode (`--ax-screen-reader`, since 2.1.181) that flattens the interface into labelled plain text, replaces animated spinners with static text, renders menus as numbered lists and rings the terminal bell at the end of a turn. It is a solid base, but blind developers using NVDA, JAWS and VoiceOver still report the same gaps release after release:

- The end of a turn is effectively inaudible: a single bell, identical for "turn finished", "waiting for input" and "tool running longer than 5 s", is easy to miss or mute, and streamed text is read as it arrives and cannot be paused (#87978, #37569, #35579).
- Pickers and menus are silent: arrow keys in the slash command menu produce no speech, the `AskUserQuestion` picker is unusable with NVDA, options are truncated (#100253, #88839, #99660).
- The mode does not turn itself on (#89002); the environment variable is sometimes ignored (#88221). Installing a plugin from inside a session goes through a picker, which is exactly what does not work.
- Every tool call is narrated with the same weight, so a long session is a stream of noise with no way to tell routine reads from a failed command.
- Speech exists only through the system `say` on macOS. Nothing speaks on Windows, where most NVDA and JAWS users are.

Existing projects (claude-sonar, Claude Code Reader, the family of "done chime" mods) each cover one slice, none combine the mod API with the screen reader mode, none fix dialogs, and none speak on Windows.

**Hypothesis:** a single mod that treats the screen reader mode as its base layer and adds only what the mode lacks lets a blind developer run a full Claude Code session without sighted help.

## 2. Target Users

| User | Setup | What they need |
|------|-------|----------------|
| Blind developer on Windows | NVDA or JAWS, Windows Terminal or PowerShell, Claude Code CLI | Speech that reaches their screen reader, audible turn boundaries, usable question dialogs |
| Blind developer on macOS | VoiceOver, Terminal or iTerm2 | Short spoken summaries that do not fight VoiceOver, distinguishable earcons |
| Blind developer on Linux | Orca, GNOME Terminal | Same as above through `spd-say` or Orca; lower priority, no open issues yet |
| Low-vision or motion-sensitive user | Magnifier, reduced motion | Not a target of this mod; served by the built-in mode and `prefersReducedMotion` |
| Anthropic engineers | Issue tracker | Reproducible bug reports with screen reader and version, produced as a by-product |

The mod runs in the Claude Code terminal and in the desktop app. It does not run in `claude -p`, the SDK, the cloud, the VS Code panel or WSL, which the mod API does not support.

## 3. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unassisted session | A blind tester with NVDA (Windows) and one with VoiceOver (macOS) complete a scripted session: install from the shell, restart, send a prompt, answer an `AskUserQuestion`, approve a permission, hear the end of the turn | Manual test protocol in `docs/`, pass/fail per step |
| End-of-turn detection | Tester identifies the end of the turn within 1 s in every turn of the scripted session | Manual test, counted per turn |
| Tool narration load | Spoken tool events per turn reduced to significant ones only (errors, permissions, writes); routine reads silent or earcon-only | Count of spoken vs total tool calls in a 20-call session |
| Windows speech | Speech audible through NVDA or SAPI on a clean Windows 11 machine | Manual test |
| Mode auto-enable | With a screen reader running and no override set, the second session starts with `[Screen Reader Mode: on via settings]` | Manual test on all three platforms |
| Validity | `claude plugin validate .` passes on every commit; mod works on the current Claude Code release | Pre-commit, manual check per release |
| Upstream feedback | Reproductions with screen reader and version posted to #87978 and #100253 | Links in `docs/` |

## 4. Scope

### In Scope (MVP)

Numbering follows the recommendation in the research note.

1. **Screen reader detection and mode enabling (item 7).** On first `session.start`, detect a running screen reader (`pgrep -x VoiceOver`; `nvda.exe` / `jfw.exe` or `SPI_GETSCREENREADER` through PowerShell; `gsettings get org.gnome.desktop.a11y.applications screen-reader-enabled`). Ask by voice and in the transcript, answered with `y` or `n`; on `y` write `"axScreenReader": true` to `~/.claude/settings.json`, speak and ring that the mode is on from the next start, and ask for a restart. A refusal is remembered until `/a11y-on` or a mod update. Never override `CLAUDE_AX_SCREEN_READER=0`. Provide `/a11y-on`, `/a11y-off` and `/a11y-status`. Document shell installation (`claude plugin install ... --scope user`) because the in-session picker is unusable.
2. **End-of-turn and waiting signal (item 1).** On `turn.complete` and when the session waits for input: an earcon plus one short spoken sentence summarising the turn (number of tool calls, errors, pending questions). Distinct sounds for "finished", "waiting for you" and "tool still running".
3. **Screen-reader-usable `AskUserQuestion` (item 3).** Replace the picker with a numbered list rendered as plain text, speak the option on every selection change, accept a digit as the answer. Subject to verification: if the built-in mode already reads the dialog correctly with NVDA, this item shrinks to a reproduction report.
4. **Earcons for events (item 4).** Tool start, tool error, permission request, end of turn. One sound language shared with the foundation's audio games. Every earcon has a text equivalent the screen reader can read.
5. **Significance classification of tool calls (item 5).** Classify calls as noise, routine, notable or important (approach taken from claude-sonar, MIT) and narrate only notable and important ones. Digest mode on demand.
6. **Speech on Windows (item 6).** `$.audio.speak` is verified on Windows and Linux; where it does not reach the screen reader, speak through SAPI or directly to NVDA / JAWS via `$.process.run`.

### Out of Scope

- Replacing the `Spinner`: the screen reader mode already renders it as static text.
- Anything the mod API cannot reach: the permission prompt, the input field, the slash command menu, announcements in the desktop app and the VS Code panel. These become bug reports to Anthropic, not features.
- `claude -p`, SDK, cloud and WSL sessions.
- Braille display support and Orca-specific work beyond generic Linux speech (no open issues, no testers yet).
- Low-vision features (magnifier cursor, reduced motion): covered by existing settings.
- A GUI wrapper around the CLI (the Claude Code Reader approach).

## 5. Architecture

### Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Mod | TypeScript, ES modules | 5.x, strict | Runs inside the Claude Code process; `hooks/hooks.json` points at `src/mod.ts` exporting `register(on, options)` |
| Mod runtime | Claude Code mod API | >= 2.1.287, types checked for 2.1.295 | `$.audio.speak`, `$.audio.play`, `$.ui.*`, `$.process.run`, `$.fs`, `$.store`; events `turn.complete`, `tool.call`, `prompt.submit`, `classic.Notification`, `classic.Stop` |
| Tooling | Node 22, npm | 22.x | Vitest for unit tests, ESLint, `tsc --noEmit` |
| Speech | System TTS | per platform | macOS `say`; Windows SAPI or NVDA / JAWS bridge; Linux `spd-say` |
| Audio assets | Short WAV / AIFF earcons | | Played with `$.audio.play` where supported |
| State | `$.store`, `~/.claude/settings.json` | 4 MiB limit | Settings written only with consent and reversibly |

### Infrastructure

| Component | Choice | Notes |
|-----------|--------|-------|
| Git Host | GitHub | `unlocked-spark/claude-code-earshot`, private until first release; no remote yet |
| Cloud Provider | none | |
| CI/CD | none | Manual `npm test`, `npm run lint`, `claude plugin validate .`; GitHub Actions planned at Alpha |
| Containers | none | |
| IaC | none | |

### Environment Strategy

| Environment | Purpose | URL | Deploy Trigger |
|-------------|---------|-----|----------------|
| Local | Development, unit tests, manual sessions with `claude --plugin-dir . --ax-screen-reader` | n/a | Manual |
| Production | Published plugin in a marketplace | n/a | Manual, requires approval |

**Environment Tier:** 1 (local only; "production" is a marketplace release, not a server)

Manual testing needs two machines or VMs: macOS with VoiceOver and Windows 11 with NVDA (JAWS if a licence is available).

## 6. Milestones & Roadmap

### Current Maturity: POC

### Roadmap

| Milestone | Goal | Target Maturity | Status | Success Criteria |
|-----------|------|-----------------|--------|------------------|
| M1: Heard turn | A blind user knows the mode is on and when a turn ends | poc | NOW | Items 1, 2, 4 work on macOS; `claude plugin validate .` passes |
| M2: Usable dialogs, quieter tools | Questions can be answered and tool noise is filtered | alpha | NEXT | Items 3, 5; specs and unit tests for classifier and formatters |
| M3: Windows | The mod speaks where NVDA and JAWS users are | alpha | LATER | Item 6 verified on a clean Windows 11 machine |
| M4: Release | Published, documented, reproductions filed upstream | beta | LATER | Marketplace listing, manual test protocol, issues #87978 and #100253 updated |

### Milestone Detail

#### M1: Heard turn [NOW]
**Goal:** Prove the mod can detect a screen reader, enable the mode for the next session, and make the end of a turn unmistakable.
**Appetite:** Two weeks of part-time work.
**Target maturity:** poc
**Features:**
- Screen reader detection and `axScreenReader` enabling with consent and `/a11y-off`
- End-of-turn earcon plus spoken one-sentence summary
- Earcons for tool start, tool error, permission request
**Success criteria:**
- [ ] On macOS with VoiceOver running, a fresh install leads to a second session in screen reader mode without editing files by hand
- [ ] Every turn end is heard within 1 s in a 10-turn session
- [ ] `claude plugin validate .` passes
- [ ] Verified: whether toast and status line are read in the screen reader mode, and whether `$.audio.speak` doubles what the screen reader already reads

#### M2: Usable dialogs, quieter tools [NEXT]
**Goal:** Answer `AskUserQuestion` by ear and reduce tool narration to what matters.
**Appetite:** Two weeks.
**Target maturity:** alpha
**Features:**
- Numbered-list `AskUserQuestion` with spoken selection and digit answers (after verifying the built-in mode's behaviour with NVDA)
- Significance classifier for tool calls, digest mode
**Success criteria:**
- [ ] Specs in `specs/` for both features
- [ ] Unit tests for classifier and formatters, lint and typecheck in pre-commit
- [ ] NVDA reproduction posted to #100253 and #88839

#### M3: Windows [LATER]
**Goal:** Speech reaches NVDA and JAWS users.
**Features:** `$.audio.speak` verification on Windows and Linux; SAPI or screen reader bridge fallback.

#### M4: Release [LATER]
**Goal:** Public repository, marketplace listing, manual test protocol, upstream reproductions.

### Maturity Promotion Path

| From | To | Requirements |
|------|-----|-------------|
| poc → alpha | Specs for critical paths, unit tests for classifier and formatters, lint and typecheck in pre-commit, written manual test protocol, consistent commit convention |
| alpha → beta | Coverage above 50% of testable code, tests with NVDA and VoiceOver repeated per Claude Code release, CHANGELOG maintained, public repository with LICENSE |
| beta → ga | 30 days without regressions across Claude Code releases, two external blind users confirming the scripted session, marketplace listing |

## 7. Key Features

### Feature 1: Screen reader detection and mode enabling
Detect a running screen reader at session start, ask for consent by voice with a `y`/`n` answer, write `axScreenReader: true` to the user settings, announce by speech and bell that a restart is needed. Implemented in cycle 1 (spec `specs/screen-reader-detection.md`), manual sessions pending. Reversible with `/a11y-off`; respects `CLAUDE_AX_SCREEN_READER=0`. Closes the practical gap behind #89002 until Anthropic adds it to the core.

### Feature 2: End-of-turn signal
On `turn.complete` play a distinct earcon and speak one sentence: "Done, three tool calls, one question for you." Separate sounds for waiting on input and for long-running tools. Replaces the single ambiguous bell (#87978).

### Feature 3: Screen-reader-usable AskUserQuestion
Custom renderer for the `AskUserQuestion` surface: numbered options as plain text, spoken on selection change, answerable with a digit. Depends on verifying that the built-in mode's numbered lists do not already solve #88839.

### Feature 4: Earcons
One short sound per event class, assets shared with the foundation's audio games. Every earcon has a text equivalent so nothing is conveyed by sound alone.

### Feature 5: Tool call significance
Classifier (noise / routine / notable / important) and formatters derived from claude-sonar, adapted to the mod event model. Only notable and important calls are spoken; a digest summarises the rest.

### Feature 6: Windows speech
Speech path that works where `$.audio.speak` does not: SAPI through PowerShell or direct NVDA / JAWS calls via `$.process.run`.

## 8. Non-Functional Requirements

- **Performance:** hooks finish well under the 10 s limit; speech is queued, never blocking; redraws stay within 10/s.
- **Security:** the only file written outside the plugin is `~/.claude/settings.json`, with consent, reversibly, and never when `CLAUDE_AX_SCREEN_READER=0` is set. `$.process.run` calls use fixed commands, no user-controlled arguments.
- **Accessibility:** the mod must itself pass the foundation's bar: nothing conveyed by sound or colour alone, speech short enough not to collide with the screen reader, every spoken message also present as text in the transcript.
- **Compatibility:** Claude Code >= 2.1.287; macOS, Windows 11, Linux (GNOME). Re-tested on each Claude Code release because regressions are frequent.
- **Licensing:** code from claude-sonar is MIT; this project's licence to be chosen before publication (Apache 2.0 like the SDK, or MIT).

## 9. Open Questions

- Does `$.audio.speak` produce speech on Windows and Linux, and does it reach NVDA / JAWS or only the speakers?
- Are `$.ui.toast` and `$.ui.status` read by the screen reader in `--ax-screen-reader` mode, or does the mode drop them?
- Does the mod's speech double what the screen reader already reads from the flat transcript? If so, the mod should speak less and rely on earcons.
- Does the built-in numbered-list `AskUserQuestion` already work with NVDA, making Feature 3 unnecessary?
- Is a mod-rendered `Spinner` or `ToolProgress` overridden when the model names the step (#99483)? Relevant to how tool events are surfaced.
- Do #91058 (box-drawing remnants) and #88221 (ignored environment variable) still reproduce on the current release?
- Which marketplace: the foundation's own repository or an existing mod marketplace?

## 10. Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-10-09 | 0.1.0 | Łukasz Majewski | Initial draft from the research note and the ADD init interview; spinner replacement dropped as redundant with the screen reader mode |
