# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Removed

- Removed npm publication and GitHub release automation, including the opt-in variable, OIDC
  write permission, publishing instructions, and release-specific CI inputs and checks.

### Changed

- Marked the package private to prevent npm publication while retaining GitHub installation
  and local installed-artifact tests.

## [2.0.0] - 2026-10-30

### Breaking

- Replaced the OpenCode V1 function/config-hook entrypoint with a native V2 `id`/`setup`
  definition and command/skill domain transforms, targeting OpenCode server 2.2.2+ within V2.
  OpenCode V1 consumers should retain 1.x.

### Changed

- Documented direct GitHub installation as the primary OpenCode distribution, with native V2
  `plugins` and `skills` configuration, directory-based local loading, and reload guidance.
- Included complete portable skills in the installable package, preserving adjacent scripts,
  references, and assets without network work inside registry transforms or SDK dependencies.
- Preserved command arguments, prompt attachments, delivery mode, build-agent selection, and
  user command/skill overrides through the V2 API. Claude's hooks remain unchanged.

### Added

- Added installed-artifact tests and opt-in verification in an isolated real OpenCode V2 server.
- Added reusable PR/push/release validation with a pinned OpenCode V2 runtime. npm publication
  now requires the explicit `PUBLISH_NPM=true` repository variable and successful validation.

## [1.11.0] - 2026-10-30

### Added

- Added bounded Claude Code memory recall on session start and each prompt, with explicit
  ticket/epic searches, read-only secondary sources, degraded file fallback, and session caching.
- Added declared epic-record paths to recalled context and restored memory context after
  compaction and clear without resetting initial session metrics.

### Changed

- Replaced dirty-working-tree capture nudges with successful turn-activity signals and normal
  Stop-hook feedback, supporting coordination roots and their repository worktrees.
- Required explicitly declared `HUB.yml` memory for automatic Obsidian access; environment and
  global config vault fallbacks remain available for manual skill use only.
- Extended metadata-only session logging to non-Git hub/ticket roots without inventing Git metrics.
- Distinguished automatic path discovery from agent-authored consultation and persistence.

## [1.10.0] - 2026-08-23

### Added

- Added optional ordered workspace memory to `HUB.yml`, with one writable local
  `knowledge-vault` primary and read-only local secondary sources.
- Added a stdlib-only canonical memory reader with active, archived, hub-subdirectory, and nested
  worktree discovery.

### Changed

- Made vault resolution and Claude lifecycle hooks workspace-aware while preserving user-level
  configuration for hubs without memory.
- Made malformed explicit workspace memory fail closed so automatic and agent-authored writes
  cannot silently target a fallback vault.

## [1.9.0] - 2026-08-19

### Added

- Required the official `humanlayer/skills` `show-me` skill before and after every task in newly
  created ticket workspaces, so agents present the intended implementation shape and actual diff.
- Extended the read-only workspace-control doctor to report local `show-me` availability and suggest
  installation without invoking `npx` or changing the environment.

## [1.8.0] - 2026-08-19

### Added

- Added optional per-repository `codegraph: true` workspace policies that initialize and verify a
  local CodeGraph index for selected ticket worktrees.
- Added safe CodeGraph index handling to workspace reruns and archiving without mutating source
  clones, shared Git settings, or unmanaged indexes.

## [1.7.0] - 2026-08-12

### Added

- Added the `workspace-control-hub` skill for external per-vertical control hubs with structured
  epic records, concise Markdown views, readiness assessments, and explicit evidence freshness.
- Added read-only workspace-control doctor support for structured controllers and legacy Markdown
  epic boards, including safe migration diagnostics without an apply mode.
- Added Claude and OpenCode commands to initialize, query, and diagnose workspace control hubs.

### Changed

- Added optional reciprocal external-control references to multirepo workspace and ticket
  coordination schemas while preserving existing hubs without a controller.

## [1.6.0] - 2026-08-04

### Added

- Added a safe workspace archive workflow that removes clean ticket worktrees, preserves branches,
  and retains coordination history under each hub's `.archive/` directory.
- Added `/workspace-archive` to the OpenCode plugin and grouped Claude workspace commands under
  `/myugen-skills:workspace:<action>`.

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
