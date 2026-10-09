# Active Learnings (3 of 3)

> Pre-filtered by severity and date. Full data: `.add/learnings.json`

### architecture
- **[high]** The mod is an overlay on --ax-screen-reader, not a replacement (L-001, 2026-10-09)
  The screen reader mode already renders static spinners, a flat labelled transcript, numbered menus and a terminal bell. Replacing the Spinner was dropped from scope as redundant. Before adding any feature, check what the mode already does with the screen reader actually running; the open issues do not always say whether the reporter had the mode on (AskUserQuestion, #88839, is the first case to ve… [truncated — full entry in learnings.json]
### technical
- **[high]** Screen reader mode cannot be switched on inside a running session (L-002, 2026-10-09)
  The mode is decided once at startup (flag, then CLAUDE_AX_SCREEN_READER, then the axScreenReader setting) and mods load after that decision. There is no /config row, so $.config.set cannot change it. A mod can only write axScreenReader: true to ~/.claude/settings.json for the next session and announce the restart by speech and bell. Verified in the 2.1.295 binary; source: docs/research/rozpoznanie… [truncated — full entry in learnings.json]
- **[medium]** Install instructions must avoid in-session pickers (L-003, 2026-10-09)
  /plugin install opens a picker that does not work with NVDA. Documentation must give the shell path: claude plugin install <name>@<marketplace> --scope user, then start claude normally. The same applies to any onboarding step the mod designs.

---
*Auto-generated. Do not edit — regenerated on each learning write.*
