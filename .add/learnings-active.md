# Active Learnings (12 of 20)

> Pre-filtered by severity and date. Full data: `.add/learnings.json`

### architecture
- **[high]** In screen reader mode, hiding beats condensing for tool activity (L-014, 2026-10-11)
  Daily NVDA use showed that even one-line tool rows interrupt the answer. Since 0.1.1 tool rows draw nothing by default in screen reader mode, so the transcript carries Claude's words alone; /earshot-tools brief|full|off|auto chooses and is remembered. Folded ToolGroup rows (0.1.3), the ToolProgress run-in-background hint and the Spinner line (0.1.4) must be hidden too, each through its own ui.rend… [truncated — full entry in learnings.json]
- **[high]** The mod is an overlay on --ax-screen-reader, not a replacement (L-001, 2026-10-09)
  The screen reader mode already renders static spinners, a flat labelled transcript, numbered menus and a terminal bell. Replacing the Spinner was dropped from scope as redundant. Before adding any feature, check what the mode already does with the screen reader actually running; the open issues do not always say whether the reporter had the mode on (AskUserQuestion, #88839, is the first case to ve… [truncated — full entry in learnings.json]
- **[medium]** /earshot-off must restore what /earshot-on changed (L-018, 2026-10-11)
  Turning the mod off by deleting only axScreenReader left spinnerTipsEnabled changed. Since 0.1.4 /earshot-on stores a snapshot of the keys it changes and /earshot-off restores it and keeps the mod off without asking again; the backup file is named settings.json.earshot-backup.
- **[medium]** Replace the hidden spinner with explicit signs of life (L-015, 2026-10-11)
  With the spinner hidden and answers held, the user cannot tell that the prompt was taken. A printed and spoken 'Starting work.' opens each turn (0.1.5), and a heartbeat speaks after 10 seconds of silence, then every 10 seconds (20 s was too long, 0.1.6); since 0.1.8 it adds the context window from 70% and a usage limit from 80% read from $.session.usage(), a limit only when its percentage moved.
### technical
- **[high]** Bump version on every release or users never get the update (L-013, 2026-10-11)
  The installed copy is keyed by the version in plugin.json: with 0.1.0 unchanged, claude plugin update reported the latest version already present and users kept the old commands. Every release bumps plugin.json and package.json together with a dated CHANGELOG entry (0.1.1 to 0.1.8 on 2026-10-11).
- **[high]** The loader refuses $ passed to a function imported from another file (L-012, 2026-10-10)
  claude plugin validate: "$ is passed to probeImported, imported from ./probe-import: $ is followed only into a function declared in this same file". A hooks module cannot be split by moving $-taking helpers into other files; only $-free state and transitions can move (hooks/state.ts). Plan for one long register.ts per plugin, or several plugins.
- **[high]** Streaming hooks: read the iterator by hand, the return value is the result (L-009, 2026-10-09)
  A turn.step hook and its .catch handler are async generators. for await discards the generator return value, and the kit stream's .result promise settled undefined in tests, so both the hook and the kit test iterate with next() and take item.value when done is true. Holding chunks in an array and yielding them after the stream ends delays only the display: the engine still records and runs every t… [truncated — full entry in learnings.json]
- **[high]** The mod loader only lets $ reach top-level functions (L-005, 2026-10-09)
  A hooks module fails to load (and claude plugin validate reports it) when $ is passed to a function defined inside the register closure or to a function parameter. Keep every helper that takes $ as a top-level function declaration and keep session facts in a module-level record; a higher-order helper such as runCommand($, action) is refused. Found with claude plugin test on 2026-10-09.
- **[high]** Screen reader mode cannot be switched on inside a running session (L-002, 2026-10-09)
  The mode is decided once at startup (flag, then CLAUDE_AX_SCREEN_READER, then the axScreenReader setting) and mods load after that decision. There is no /config row, so $.config.set cannot change it. A mod can only write axScreenReader: true to ~/.claude/settings.json for the next session and announce the restart by speech and bell. Verified in the 2.1.295 binary; source: docs/research/rozpoznanie… [truncated — full entry in learnings.json]
- **[medium]** System display language: AppleLanguages on macOS, PowerShell on Windows, locale variables elsewhere (L-017, 2026-10-11)
  Lines follow the system display language (en, pl, de, fr, es, it; English otherwise). macOS: `defaults read -g AppleLanguages`, first entry of the property list. Windows: PowerShell. Others: LC_ALL, LC_MESSAGES, LANG. Each language is one table in hooks/lib/lines/ typed by a shared Messages type, so a missing line is a type error.
- **[medium]** A render log finds the source of anything the screen reader reads (L-016, 2026-10-11)
  A ui.render hook with no matcher writes one debug-log line per drawn component (claude --debug, /earshot-log on|off). It is how the run-in-background pill and the spinner word were identified as the unexplained text NVDA read.
### process
- **[medium]** Work done outside ADD leaves no trace in .add/ (L-020, 2026-10-11)
  0.1.1 to 0.1.8 were built on a machine without the ADD plugin: no cycle snapshots, observations, learnings or handoff were written, and handoff, config milestone and AGENTS.md went stale. Reconstruct from commits and CHANGELOG on return, or install ADD on every development machine.

## Index (8 more — title only, read JSON for full detail)

- [medium] L-011 technical: Tool rows: key per-call state on props.tool_use_id, answer ui.render at the kit bottom (2026-10-10)
- [medium] L-010 technical: Kit limits for turn.step tests (2026-10-09)
- [medium] L-008 technical: claude plugin test can be blocked by a stale mods rollout flag (2026-10-09)
- [medium] L-007 technical: Two test harnesses: Vitest for hooks/lib, claude plugin test for the mod (2026-10-09)
- [medium] L-006 technical: Plugin names starting with claude- are reserved; command names take no colon (2026-10-09)
- [medium] L-004 architecture: Keep mod API behind a thin adapter so logic is testable without Claude Code (2026-10-09)
- [medium] L-003 technical: Install instructions must avoid in-session pickers (2026-10-09)
- [low] L-019 technical: Settings paths differ on Windows: test with the platform's separator (2026-10-11)

---
*Auto-generated. Do not edit — regenerated on each learning write.*
