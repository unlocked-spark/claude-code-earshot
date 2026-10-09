# Active Learnings (10 of 10)

> Pre-filtered by severity and date. Full data: `.add/learnings.json`

### architecture
- **[high]** The mod is an overlay on --ax-screen-reader, not a replacement (L-001, 2026-10-09)
  The screen reader mode already renders static spinners, a flat labelled transcript, numbered menus and a terminal bell. Replacing the Spinner was dropped from scope as redundant. Before adding any feature, check what the mode already does with the screen reader actually running; the open issues do not always say whether the reporter had the mode on (AskUserQuestion, #88839, is the first case to ve… [truncated — full entry in learnings.json]
- **[medium]** Keep mod API behind a thin adapter so logic is testable without Claude Code (L-004, 2026-10-09)
  Detection, mode-state resolution, settings writing and the consent state machine take injected run/fs/env/store/clock interfaces and return actions; src/adapter.ts is the only module that calls $.process, $.fs, $.store, $.audio and $.ui. Vitest then covers the decisions without launching Claude Code, and manual sessions with VoiceOver and NVDA only verify the adapter and the ear. Decided in docs/p… [truncated — full entry in learnings.json]
### technical
- **[high]** Streaming hooks: read the iterator by hand, the return value is the result (L-009, 2026-10-09)
  A turn.step hook and its .catch handler are async generators. for await discards the generator return value, and the kit stream's .result promise settled undefined in tests, so both the hook and the kit test iterate with next() and take item.value when done is true. Holding chunks in an array and yielding them after the stream ends delays only the display: the engine still records and runs every t… [truncated — full entry in learnings.json]
- **[high]** The mod loader only lets $ reach top-level functions (L-005, 2026-10-09)
  A hooks module fails to load (and claude plugin validate reports it) when $ is passed to a function defined inside the register closure or to a function parameter. Keep every helper that takes $ as a top-level function declaration and keep session facts in a module-level record; a higher-order helper such as runCommand($, action) is refused. Found with claude plugin test on 2026-10-09.
- **[high]** Screen reader mode cannot be switched on inside a running session (L-002, 2026-10-09)
  The mode is decided once at startup (flag, then CLAUDE_AX_SCREEN_READER, then the axScreenReader setting) and mods load after that decision. There is no /config row, so $.config.set cannot change it. A mod can only write axScreenReader: true to ~/.claude/settings.json for the next session and announce the restart by speech and bell. Verified in the 2.1.295 binary; source: docs/research/rozpoznanie… [truncated — full entry in learnings.json]
- **[medium]** Kit limits for turn.step tests (L-010, 2026-10-09)
  A test's bottom turn.step hook cannot yield engine chunks (the kit refuses a ref it never pulled), so scripted streams carry text, thinking, tool, input and stop only. A second hook on an event mock.store already answers (store.set, store.delete) needs a matcher such as { key } or the module fails with "registered twice". Registered before mock.store, such a hook runs above it and can record write… [truncated — full entry in learnings.json]
- **[medium]** claude plugin test can be blocked by a stale mods rollout flag (L-008, 2026-10-09)
  claude plugin test . answered "hooks modules are turned off in this process: the rollout switch was saved off by an earlier session" although the same suite had passed minutes before. The switch is tengu_plugin_hooks_modules in ~/.claude.json; a headless run (claude -p "Reply with the single word ok." --max-turns 1) with network access refreshed it to true and the suite ran again. Treat this messa… [truncated — full entry in learnings.json]
- **[medium]** Two test harnesses: Vitest for hooks/lib, claude plugin test for the mod (L-007, 2026-10-09)
  claude plugin test . runs hooks/*.test.ts with the claude-code/testing kit and does not descend into node_modules; Vitest is configured to run only tests/unit/*.spec.ts so neither harness picks up the other. In a kit test, stubs beneath the mod answer each $ call event with { value }, mock.env/store/clock cover those nouns, and the test must answer session.start and prompt.submit at the bottom of … [truncated — full entry in learnings.json]
- **[medium]** Plugin names starting with claude- are reserved; command names take no colon (L-006, 2026-10-09)
  claude plugin validate refuses names starting with claude-, anthropic-, anthropics- or cc-plugin-, so the plugin is a11y-companion while the repository stays claude-code-a11y. Command names allow letters, digits, _ and - only, hence /a11y-on, /a11y-off, /a11y-status. Transcript lines from $.ui.log carry the plugin name as prefix, so the name is spoken by the screen reader on every line: keep it sh… [truncated — full entry in learnings.json]
- **[medium]** Install instructions must avoid in-session pickers (L-003, 2026-10-09)
  /plugin install opens a picker that does not work with NVDA. Documentation must give the shell path: claude plugin install <name>@<marketplace> --scope user, then start claude normally. The same applies to any onboarding step the mod designs.

---
*Auto-generated. Do not edit — regenerated on each learning write.*
