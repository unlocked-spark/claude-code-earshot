<!-- ADD:MANAGED:START version=0.11.0 maturity=poc generated=2026-10-11T15:32:38Z -->

# claude-code-earshot

Earshot, an accessibility mod for Claude Code aimed at blind developers. An overlay on the built-in screen reader mode (`--ax-screen-reader`): it enables the mode when a screen reader is detected, shows each answer whole instead of streaming it, hides or condenses tool rows, says when a turn starts and that work goes on, and speaks in the system's language. Project of the Unlocked Spark Foundation. Version 0.1.8, public preview, used daily with NVDA on Windows.

## Critical Rules

- Project maturity is **poc**: specs are optional, tests recommended, lint is the only gate. Promotion happens through evidence, not aspiration.
- The mod complements the screen reader mode. Check what `--ax-screen-reader` already does before adding a feature; never re-implement the static spinner, the flat transcript or the numbered menus.
- Nothing is conveyed by sound alone. Every spoken message has a text equivalent in the transcript, and speech stays short so it does not collide with the screen reader.
- Writes outside the plugin are limited to `~/.claude/settings.json` and its `.earshot-backup`, with consent; `/earshot-off` restores the saved settings. The start question is never asked while `CLAUDE_AX_SCREEN_READER` is set.
- A release is a `version` bump in `.claude-plugin/plugin.json` (and `package.json`) with a dated CHANGELOG entry; without the bump `claude plugin update` keeps the old copy.
- Repository content is English; research notes under `docs/research/` are Polish. Commits are imperative English sentences without type prefixes or AI attribution.

## Pointers

- PRD: `docs/prd.md`
- Specs (all implemented): `specs/screen-reader-detection.md`, `specs/whole-answer-delivery.md`, `specs/tool-narration.md`, `specs/system-language.md`
- Manual test protocols: `docs/testing/`
- Research: `docs/research/rozpoznanie-2026-10-09.md`, `docs/research/spikes-2026-10.md`
- Plans: written per feature in `docs/plans/` while it is built, removed once finished
- Configuration: `.add/config.json`; knowledge base `.add/learnings.json`, view in `.add/learnings-active.md`
- Agent context: `CLAUDE.md`

<!-- ADD:MANAGED:END -->
