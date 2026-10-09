# claude-code-a11y

Accessibility mod for Claude Code aimed at blind developers. It is an overlay on the built-in screen reader mode (`--ax-screen-reader`) and adds only what that mode lacks: spoken end-of-turn summaries, earcons for tool and permission events, a screen-reader-usable `AskUserQuestion` dialog, significance-filtered tool narration, speech on Windows, and automatic enabling of the mode when a screen reader is detected. Project of the Unlocked Spark Foundation.

Stage: notes and PRD, no code yet. Research (Polish): `docs/research/rozpoznanie-2026-10-09.md`.

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
npm test                                   # Unit tests (Vitest)
npm run lint                               # ESLint
npm run typecheck                          # tsc --noEmit
claude plugin validate .                   # Validate manifest, hooks and mod API usage
```
`package.json` does not exist yet; create it with these scripts when the first code lands.

### ADD Workflow
```
/add:spec {feature}                  # Create feature specification
/add:plan specs/{feature}.md         # Create implementation plan
/add:tdd-cycle specs/{feature}.md    # Execute TDD cycle
/add:verify                          # Run quality gates
/add:retro                           # Retrospective, learnings, maturity promotion
```

## Architecture

### Planned layout
```
.claude-plugin/plugin.json   # plugin manifest, userConfig flag for enabling the screen reader mode
hooks/hooks.json             # points at the mod module
src/mod.ts                   # register(on, options): event handlers and surface renderers
src/detect/                  # screen reader detection per platform ($.process.run)
src/classify/                # tool call significance (noise / routine / notable / important)
src/speech/                  # speech backends: $.audio.speak, SAPI, NVDA/JAWS, spd-say
src/surfaces/                # AskUserQuestion, ToolProgress renderers
assets/earcons/              # short sounds, one per event class
tests/unit/                  # classifier, formatters, detection parsing
docs/research/               # research notes (Polish)
docs/testing/                # manual test protocol for NVDA and VoiceOver
```

### Design rules
- The mod complements `--ax-screen-reader`; it never re-implements what the mode already does (static spinner, flat transcript, numbered menus). Check the mode first, then add.
- Speech is short. The screen reader reads the transcript; the mod speaks only what the transcript cannot convey (turn boundaries, event class, counts).
- Nothing is conveyed by sound alone. Every earcon and spoken message has a text equivalent in the transcript.
- Writes outside the plugin are limited to `~/.claude/settings.json`, with consent, reversible (`/a11y:off`), never when `CLAUDE_AX_SCREEN_READER=0`.
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

- **Git host:** GitHub, `unlocked-spark/claude-code-a11y`, private until first release (no remote yet)
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
