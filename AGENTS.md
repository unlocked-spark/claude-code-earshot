<!-- ADD:MANAGED:START version=0.11.0 maturity=poc generated=2026-10-09T16:54:22Z -->

# claude-code-a11y

Accessibility mod for Claude Code aimed at blind developers. An overlay on the built-in screen reader mode (`--ax-screen-reader`) that adds what the mode lacks: spoken end-of-turn summaries, earcons for tool and permission events, a screen-reader-usable `AskUserQuestion` dialog, significance-filtered tool narration, speech on Windows, and automatic enabling of the mode when a screen reader is detected. Project of the Unlocked Spark Foundation.

## Critical Rules

- Project maturity is **poc**: specs are optional, tests recommended, lint is the only gate. Promotion happens through evidence, not aspiration.
- The mod complements the screen reader mode. Check what `--ax-screen-reader` already does before adding a feature; never re-implement the static spinner, the flat transcript or the numbered menus.
- Nothing is conveyed by sound alone. Every earcon and spoken message has a text equivalent in the transcript, and speech stays short so it does not collide with the screen reader.
- The only file written outside the plugin is `~/.claude/settings.json`, with consent, reversible with `/a11y:off`, never when `CLAUDE_AX_SCREEN_READER=0`.
- Repository content is English; research notes under `docs/research/` are Polish. Commits are imperative English sentences without type prefixes or AI attribution. Marketplace publication requires human approval.

## Pointers

- PRD: `docs/prd.md`
- Research: `docs/research/rozpoznanie-2026-10-09.md`
- Specs: `specs/` (none yet)
- Plans: `docs/plans/`
- Configuration: `.add/config.json`
- Knowledge base: `.add/learnings.json`, view in `.add/learnings-active.md`
- Agent context: `CLAUDE.md`

<!-- ADD:MANAGED:END -->
