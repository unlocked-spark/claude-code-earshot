# claude-code-earshot

Accessibility mod for Claude Code aimed at blind developers. It is an overlay on the built-in screen reader mode (`--ax-screen-reader`) and adds only what that mode lacks: spoken end-of-turn summaries, earcons for tool and permission events, a screen-reader-usable `AskUserQuestion` dialog, significance-filtered tool narration, speech on Windows, and automatic enabling of the mode when a screen reader is detected. Project of the Unlocked Spark Foundation.

Stage: screen reader detection (confirmed with VoiceOver), whole answer delivery (turn.step hold) and tool narration (ui.render on tool rows, mechanism confirmed by a spike in screen reader mode; hidden by default since 2026-10-11, `/earshot-tools` chooses) implemented with unit and mod tests, plus a heartbeat every 20 s of silence during a turn (`/earshot-heartbeat`) and a render log of every drawn component in the debug log (`/earshot-log`) for hunting the messages a screen reader reads; VoiceOver sessions for the last two and all NVDA sessions pending. Research (Polish): `docs/research/rozpoznanie-2026-10-09.md`; spike results and loader constraints: `docs/research/spikes-2026-10.md`.

The plugin is named `earshot` (names starting with `claude-` are reserved by the validator); the repository keeps its name.

## Methodology

This project follows Agent Driven Development (ADD): specs drive agents, humans architect and decide, trust-but-verify ensures quality.

- **PRD:** `docs/prd.md`
- **Specs:** `specs/`
- **Plans:** `docs/plans/`
- **Config:** `.add/config.json`
- **Knowledge base:** `.add/learnings.json` (canonical) and the generated `.add/learnings-active.md`

Document hierarchy: PRD → Spec → Plan → Tests → Implementation.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Mod | TypeScript, ES modules | 5.x, strict |
| Mod runtime | Claude Code mod API | >= 2.1.287 (types checked for 2.1.295) |
| Tooling | Node, npm, Vitest, ESLint | Node 22 |
| Speech | System TTS per platform | macOS `say`, Windows SAPI or NVDA/JAWS bridge, Linux `spd-say` |

## Commands

### Development
```
claude --plugin-dir . --ax-screen-reader   # Run Claude Code with the mod loaded, in screen reader mode
npm test                                   # Unit tests of hooks/lib (Vitest, tests/unit/*.spec.ts)
claude plugin test .                       # Mod-level tests (claude-code/testing kit, hooks/*.test.ts)
npm run lint                               # ESLint
npm run typecheck                          # tsc against .claude-plugin/types (written by the engine on first load)
claude plugin validate .                   # Validate manifest, hooks and mod API usage
```
`.claude-plugin/types/` is generated and ignored by git. Until the engine has loaded the mod once, copy the current `claude-code.d.ts` from the plugin-authoring skill there as `claude-code/index.d.ts` so `tsc` has the declarations.

### ADD Workflow
```
/add:spec {feature}                  # Create feature specification
/add:plan specs/{feature}.md         # Create implementation plan
/add:tdd-cycle specs/{feature}.md    # Execute TDD cycle
/add:verify                          # Run quality gates
/add:retro                           # Retrospective, learnings, maturity promotion
```

## Architecture

### Layout
```
.claude-plugin/plugin.json   # plugin manifest (name earshot, version read by the mod)
hooks/hooks.json             # points at hooks/register.ts
hooks/register.ts            # the only module that calls the mod API: adapter and event wiring
hooks/state.ts               # shared session state and $-free transitions (command list, facts, consent steps)
hooks/lib/detect.ts          # platform and screen reader detection (pgrep, PowerShell)
hooks/lib/mode-state.ts      # mode resolution (variable over settings) and the ask/silent decision
hooks/lib/settings-file.ts   # settings path, strict JSON editing, the snapshot /earshot-on stores and /earshot-off restores
hooks/lib/consent.ts         # consent state machine, y/n parsing, 30 s timeout constant
hooks/lib/stream-delivery.ts # whole answer delivery: mode resolution, /earshot-stream parsing, the chunk hold
hooks/lib/tool-narration.ts  # tool narration: mode (off/brief/full), summaries per tool, labels, result counts, ring buffer of results
hooks/lib/render-log.ts      # render log: one debug line per drawn component, change memo, /earshot-log parsing
hooks/lib/heartbeat.ts       # heartbeat: silence reducer per tick, interval setting, /earshot-heartbeat parsing
hooks/lib/language.ts        # system display language: PowerShell, AppleLanguages, LC_ALL/LC_MESSAGES/LANG
hooks/lib/messages.ts        # the live table of spoken and printed lines, setLanguage
hooks/lib/lines/*.ts         # one table per language (en, pl, de, fr, es, it) and the shared Messages type
hooks/register.test.ts       # mod-level tests: detection and commands (claude plugin test)
hooks/stream.test.ts         # mod-level tests: turn.step hold and /earshot-stream
hooks/narration.test.ts      # mod-level tests: ToolUse, ToolResult, ToolGroup, ToolProgress and Spinner rows mounted on the terminal surface, the render log
hooks/heartbeat.test.ts      # mod-level tests: turn.start/turn.complete ticks on the mocked clock
tests/unit/*.spec.ts         # Vitest tests of hooks/lib
docs/research/               # research notes (Polish) and spike results
docs/testing/                # manual test protocols
```
Planned next: `hooks/lib/classify/` (tool call significance), speech backends for Windows, earcon assets, surface renderers.

### Mod loader rules (learned the hard way)
- `$` may only be passed to functions declared at the top of the same file; the validator refuses `$` passed to an imported function (`$ is followed only into a function declared in this same file`). So every function that takes `$` lives in `hooks/register.ts`, and only `$`-free state and transitions are split out (`hooks/state.ts`).
- `$.env.get` takes a string literal; `claude plugin validate` lists the names.
- Command names: letters, digits, `_`, `-`. Plugin names must not start with `claude-`, `anthropic-` or `cc-plugin-`.
- The module has no Node and no DOM; relative imports within the plugin work.
- A streaming hook (`turn.step`) is an async generator and so is its `.catch` handler. Read the stream by hand with the iterator: the return value is the step's result, which `for await` discards and the kit's `.result` promise does not carry.
- In kit tests, the bottom `turn.step` hook cannot fabricate `engine` chunks, and a second hook on an event `mock.store` already answers needs a matcher.
- A `ui.render` hook with no matcher may stand beside matched ones on the same event; the mod's render log is one and runs outermost of the mod's own, so it sees every row. An empty `Box` is a valid tree that draws nothing (the engine's blank row above a message stays).
- `turn.start` is raised for the main loop only; `turn.complete` carries `agentId` for a subagent's run. A `$.clock.every` timer started in `turn.start` and cancelled in `turn.complete` survives across the turn's steps; the kit's `mock.clock(on).advance(ms)` runs its ticks in order.
- The engine's debug log records only hooked dispatches, never what it drew of its own; the mod's render log (`$.ui.log` to the `debug` sink) is the way to see what the terminal put in front of a screen reader.
- Screen reader mode does raise `ui.render` for tool rows and draws the hook's tree (spike D). In a mounted kit drawing `e.requestId` is not the call id; key per-call state on `e.props.tool_use_id`, which both `ToolUse` and `ToolResult` carry. Kit tests must answer `ui.render` at the bottom for the rows the mod leaves alone.

### Design rules
- The mod complements `--ax-screen-reader`; it never re-implements what the mode already does (static spinner, flat transcript, numbered menus). Check the mode first, then add.
- Speech is short. The screen reader reads the transcript; the mod speaks only what the transcript cannot convey (turn boundaries, event class, counts).
- Nothing is conveyed by sound alone. Every earcon and spoken message has a text equivalent in the transcript.
- Writes outside the plugin are limited to `~/.claude/settings.json` and its one-time backup, with consent, reversible (`/earshot-off`), never when `CLAUDE_AX_SCREEN_READER` is set.
- The mod API cannot reach the permission prompt, the input field, the slash menu, the desktop app or the VS Code panel. Gaps there become reproducible bug reports to Anthropic, not workarounds.
- Mods do not run in `claude -p`, the SDK, the cloud or WSL.

### Environments
- **Local:** `claude --plugin-dir .` on macOS with VoiceOver; Windows 11 with NVDA for Windows work.
- **Production:** a plugin marketplace listing. Manual, approval required.

## Quality Gates

- **Mode:** spike (POC)
- **Coverage threshold:** 0% now, 50% at Alpha
- **Type checking:** non-blocking
- **E2E required:** no; screen reader behaviour is verified manually per release

All gates defined in `.add/config.json`. Run `/add:verify` to check.

## Source Control

- **Git host:** GitHub, `unlocked-spark/claude-code-earshot`, public (Apache 2.0)
- **Branching:** trunk, commits straight to `main`
- **Commits:** imperative English sentence describing the effect, no type prefix, no AI attribution
- **CI/CD:** none; GitHub Actions planned at Alpha

## Language

- Repository content (code, comments, docs, specs, PRD, commits): English.
- Research notes under `docs/research/`: Polish.
- Conversation with the developer: Polish.
- Public texts follow the foundation rules in the parent directory's `CLAUDE.md` (no double dashes, confident tone, no emphasis on the foundation being young).

## Collaboration

- **Autonomy level:** balanced (work within a task independently, ask before architectural decisions)
- **Review gates:** none; solo contributor
- **Deploy approval:** required for marketplace publication
