# Changelog

All notable changes to this project are documented in this file.

## [1.5.0] - 2026-08-03

### Added

- Added `workspace-init` and `workspace-new` Claude commands for interactive hub and ticket
  workspace creation.
- Added complete hub scaffolding for system context and hub-level instructions.
- Added an npm-distributed OpenCode plugin that installs the skill catalog and workspace commands.

### Changed

- Made multirepo hub and ticket creation explicitly validated, resumable, and safe to rerun.

## [1.4.0] - 2026-08-03

### Added

- Added the `conventional-commits` skill for focused, safely staged Git commits that follow
  Conventional Commits 1.0.0.

## [1.3.1] - 2026-08-03

### Added

- Added portable helpers for bounded CLI calls and multiline note appends.

### Changed

- Updated the knowledge-vault workflow to use exact artifact paths and full filename wikilink
  targets.
- Simplified all note templates to frontmatter and a title; recommended body structures now live
  in the schema reference.

### Fixed

- Corrected folder listing, selected-vault path lookup, list-property, backlink, and alias
  targeting guidance for the Obsidian CLI.
- Updated automatic session notes to add their own body heading after template simplification.

## [1.3.0] - 2026-08-03

### Added

- Added the `multirepo-workspaces` skill for ticket-scoped Git worktree coordination across
  repositories.
- Added a generated OpenCode skill catalog and post-merge updater workflow.

### Fixed

- Made automatic Session notes hook-only, idempotent by session ID, and collision-safe.
- Documented that Obsidian `create ... overwrite` auto-suffixes instead of replacing a note.

## [1.2.0] - 2026-07-08

### Added

- Added Claude Code lifecycle hooks for vault context, persistence nudges, and automatic session
  records.
- Added the shared `next-id.sh` helper and the `autoSession` configuration switch.

### Fixed

- Sanitized dots in automatic session-note filenames to avoid malformed Obsidian creates.

## [1.1.1] - 2026-07-08

### Fixed

- Documented that list-valued properties require `property:set type=list`.

## [1.1.0] - 2026-07-08

### Added

- Added user-level vault resolution with repository overrides and `OBSIDIAN_VAULT` support.
- Added setup guidance, vault configuration example, `resolve-vault.sh`, and the seven note
  templates.

## [1.0.0] - 2026-07-08

### Added

- Introduced the knowledge-vault skill and the agent-agnostic skill hub.
- Added installable Claude Code plugin and marketplace manifests.
