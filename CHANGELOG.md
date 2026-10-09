# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).
Commits are written as imperative sentences without type prefixes.

## [Unreleased]

### Added
- Screen reader detection and mode enabling: VoiceOver, NVDA and JAWS detection at session start, a spoken y/n question, `axScreenReader` written to the user settings for the next session with a backup, a remembered refusal, and the `/a11y-on`, `/a11y-off` and `/a11y-status` commands. Plugin name `a11y-companion`.
- Research note on the state of Claude Code accessibility for blind developers (Polish, 2026-10-09).
- Agent Driven Development scaffolding: PRD, configuration, knowledge base.
