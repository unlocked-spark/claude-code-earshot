# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).
Commits are written as imperative sentences without type prefixes.

## [Unreleased]

## [0.1.1] - 2026-10-11

### Added
- Tool narration modes: in screen reader mode tool rows are hidden by default, so the transcript carries Claude's answers alone; `/a11y-tools off|brief|full|auto` chooses between hidden rows, one line per call with a count per result, and the engine's own rows, remembered across sessions.
- Heartbeat: in screen reader mode, every 20 seconds of silence while a turn runs the mod prints and speaks `Still working, N seconds.`; `/a11y-heartbeat <seconds>|off` adjusts it, remembered across sessions.
- Render log: every component the terminal draws is written as one line to the debug log (`claude --debug`), so the source of a message a screen reader reads can be found; `/a11y-log on|off` switches it.
- Tool narration: with whole answer delivery active, tool call rows become one line from the model's own description and results become a line count; `/a11y-last [n]` prints the full text of a recent result.
- Whole answer delivery: in screen reader mode each model step is shown at once instead of streaming, thinking is hidden, a bell marks the answer; `/a11y-stream on|off|auto` overrides it.
- Screen reader detection and mode enabling: VoiceOver, NVDA and JAWS detection at session start, a spoken y/n question, `axScreenReader` written to the user settings for the next session with a backup, a remembered refusal, and the `/a11y-on`, `/a11y-off` and `/a11y-status` commands. Plugin name `a11y-companion`.
- Research note on the state of Claude Code accessibility for blind developers (Polish, 2026-10-09).
- Agent Driven Development scaffolding: PRD, configuration, knowledge base.
