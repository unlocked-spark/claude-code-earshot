# Active Learnings (7 of 7)

> Pre-filtered by severity and date. Full data: `.add/learnings.json`

### architecture
- **[high]** The mod is an overlay on --ax-screen-reader, not a replacement (L-001, 2026-10-09)
  The screen reader mode already renders static spinners, a flat labelled transcript, numbered menus and a terminal bell. Replacing the Spinner was dropped from scope as redundant. Before adding any feature, check what the mode already does with the screen reader actually running; the open issues do not always say whether the reporter had the mode on (AskUserQuestion, #88839, is the first case to ve… [truncated — full entry in learnings.json]
- **[medium]** Keep mod API behind a thin adapter so logic is testable without Claude Code (L-004, 2026-10-09)
  Detection, mode-state resolution, settings writing and the consent state machine take injected run/fs/env/store/clock interfaces and return actions; src/adapter.ts is the only module that calls $.process, $.fs, $.store, $.audio and $.ui. Vitest then covers the decisions without launching Claude Code, and manual sessions with VoiceOver and NVDA only verify the adapter and the ear. Decided in docs/p… [truncated — full entry in learnings.json]
### technical
- **[high]** The mod loader only lets $ reach top-level functions (L-005, 2026-10-09)
  A hooks module fails to load (and claude plugin validate reports it) when $ is passed to a function defined inside the register closure or to a function parameter. Keep every helper that takes $ as a top-level function declaration and keep session facts in a module-level record; a higher-order helper such as runCommand($, action) is refused. Found with claude plugin test on 2026-10-09.
- **[high]** Screen reader mode cannot be switched on inside a running session (L-002, 2026-10-09)
  The mode is decided once at startup (flag, then CLAUDE_AX_SCREEN_READER, then the axScreenReader setting) and mods load after that decision. There is no /config row, so $.config.set cannot change it. A mod can only write axScreenReader: true to ~/.claude/settings.json for the next session and announce the restart by speech and bell. Verified in the 2.1.295 binary; source: docs/research/rozpoznanie… [truncated — full entry in learnings.json]
- **[medium]** Two test harnesses: Vitest for hooks/lib, claude plugin test for the mod (L-007, 2026-10-09)
  claude plugin test . runs hooks/*.test.ts with the claude-code/testing kit and does not descend into node_modules; Vitest is configured to run only tests/unit/*.spec.ts so neither harness picks up the other. In a kit test, stubs beneath the mod answer each $ call event with { value }, mock.env/store/clock cover those nouns, and the test must answer session.start and prompt.submit at the bottom of … [truncated — full entry in learnings.json]
- **[medium]** Plugin names starting with claude- are reserved; command names take no colon (L-006, 2026-10-09)
  claude plugin validate refuses names starting with claude-, anthropic-, anthropics- or cc-plugin-, so the plugin is a11y-companion while the repository stays claude-code-a11y. Command names allow letters, digits, _ and - only, hence /a11y-on, /a11y-off, /a11y-status. Transcript lines from $.ui.log carry the plugin name as prefix, so the name is spoken by the screen reader on every line: keep it sh… [truncated — full entry in learnings.json]
- **[medium]** Install instructions must avoid in-session pickers (L-003, 2026-10-09)
  /plugin install opens a picker that does not work with NVDA. Documentation must give the shell path: claude plugin install <name>@<marketplace> --scope user, then start claude normally. The same applies to any onboarding step the mod designs.

---
*Auto-generated. Do not edit — regenerated on each learning write.*
