# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).
Commits are written as imperative sentences without type prefixes.

## [Unreleased]

## [0.1.7] - 2026-10-11

### Fixed
- In brief tool narration a call folded into a group, which is how a single shell command is drawn too, gets its `result: <N> lines` line once it finishes; before, only the call line was drawn.

## [0.1.6] - 2026-10-11

### Changed
- The heartbeat speaks after 10 seconds of silence instead of 20, then every 10 seconds. A value set with `/earshot-heartbeat` is kept.

## [0.1.5] - 2026-10-11

### Added
- Under whole answer delivery each turn opens with one printed and spoken line, `Starting work.` in the system's language, since the hidden spinner gave no sign that the prompt was taken.
- In screen reader mode each session opens with one line that names the mod and says how to turn it off: `Welcome to Earshot for Claude Code. To turn it off, type /earshot-off.`

### Changed
- The one-time copy of the user settings is named `settings.json.earshot-backup`.

## [0.1.4] - 2026-10-11

### Changed
- `/earshot-on` turns the whole mod on: it saves the user settings it changes, then turns on screen reader mode and turns off the tips under the spinner from the next start. A `y` to the start question does the same.
- `/earshot-off` turns the whole mod off at once, restores the saved settings, and keeps the mod off in later sessions without asking.
- The commands are named after the mod: `/earshot-on`, `/earshot-off`, `/earshot-status`, `/earshot-stream`, `/earshot-tools`, `/earshot-last`, `/earshot-heartbeat` and `/earshot-log` replace the `/a11y-` names.

### Fixed
- The run-in-background pill `(ctrl+b to run in background)` under a running command is no longer drawn unless tool narration is `full`, so a screen reader does not read it.
- The spinner line and its changing word are not drawn under whole answer delivery; the heartbeat says that work goes on.

## [0.1.3] - 2026-10-11

### Fixed
- Folded tool groups (`Reading 1 file…` and the running command under it) follow the tool narration mode: hidden by default in screen reader mode, one line per call in brief, the engine's own row in full. Their results are kept for `/a11y-last`.
- The settings tests of the consent flow pass on Windows, where the settings path uses backslashes.

## [0.1.2] - 2026-10-11

### Added
- The mod's lines follow the system display language: English, Polish, German, French, Spanish or Italian, English otherwise.

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
