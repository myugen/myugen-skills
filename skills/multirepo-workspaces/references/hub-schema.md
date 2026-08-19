# Hub Schema

`HUB.yml` is the human-readable inventory for one functional vertical. It maps logical source
catalog names to directories of independent Git clones, then classifies repositories by how
commonly the hub needs them. It is not a monorepo manifest and does not grant permission to
change source clones.

## Hub Layout

A complete hub lives at `~/dev/workspaces/<hub>/` and contains:

```text
<hub>/
├── HUB.yml         repository inventory and source catalogs
├── SYSTEM_MAP.md   project context, topology, and conventions
├── AGENTS.md       portable instructions for hub and ticket work
├── CLAUDE.md       Claude Code adapter for the hub instructions
├── .archive/       archived ticket coordination roots, created only when needed
└── <ticket>/       one coordination root per ticket, never a Git repository
```

The hub and ticket roots are coordination directories, not repositories. Only their selected
repository children are linked Git worktrees.

An optional external control hub lives outside this layout. It is registered in `HUB.yml`, not
created beneath the workspace root, and is governed by `workspace-control-hub`.

## Names and destination safety

- Hub names, ticket names, source identifiers, and repository names must be non-empty, unique in
  their relevant map/list, and contain only letters, digits, `.`, `_`, and `-`.
- Reject names containing separators, `.` or `..` as complete names, or absolute paths.
- Resolve and normalize every destination before writing. A hub must remain under the selected
  workspace root; an active ticket must remain directly under its hub; an archived ticket must
  remain directly under `<hub>/.archive/`; and a worktree must remain directly under its active
  ticket.
- Do not follow a symlink that would escape one of those roots. A destination that already exists
  as a file, symlink, or unrelated directory is a conflict, not permission to overwrite it.
- A source root and source repository may be symlinks only when their resolved paths still match
  the user-confirmed source catalog and Git repository. Never create symlinks as workspaces.
- `.archive/` is reserved for archived ticket coordination roots. Do not create it until the first
  successful archive, and do not create or overwrite an archive whose ticket name already exists.

## Complete Example

```yaml
version: 1

control_hub:
  root: ~/dev/control-hubs/example

sources:
  primary:
    root: ~/dev/source-catalog
  shared:
    root: ~/dev/shared-catalog

repositories:
  required:
    - name: core-api
      source: primary
      role: core-api
      criticality: critical
      codegraph: true
    - name: partner-api
      source: primary
      role: integrations
      criticality: high
  optional:
    - name: contracts
      source: shared
      role: interface-documentation
      criticality: medium
    - name: customer-web
      source: primary
      role: frontend
      criticality: high
```

## Fields

| Path | Required | Meaning |
|------|----------|---------|
| `version` | Recommended | Schema version. Use `1` for this document. |
| `control_hub.root` | No | Absolute or home-relative external control-hub directory. Its `CONTROL.yml.workspace_hub` must resolve back to this hub. |
| `sources` | Yes | Map of stable, hub-local source catalog identifiers. |
| `sources.<id>.root` | Yes | Absolute or home-relative directory containing source clones. |
| `repositories.required` | Yes | Repositories that describe the hub's normal working context. May be empty. |
| `repositories.optional` | Yes | Repositories included only when a ticket needs them. May be empty. |
| `name` | Yes | Source clone directory name and ticket worktree directory name. Must be unique across both lists. |
| `source` | Yes | Key from `sources`; never an implicit directory path. |
| `role` | Yes | Short, functional purpose in this hub, such as `core-api`, `contracts`, or `frontend`. |
| `criticality` | Yes | Operational importance to the vertical. Prefer `critical`, `high`, `medium`, or `low`. |
| `codegraph` | No | When `true`, initialize and verify a local CodeGraph index in every selected ticket worktree. Absence means disabled. |

Keep names and roles portable. Organization-specific topology belongs in each hub's live
`HUB.yml` and `SYSTEM_MAP.md`, not in the skill.

## Path Resolution

For a repository entry, resolve its source clone as:

```text
<expanded sources.<source>.root>/<repository.name>
```

Expand `~` using the current user's home directory. Do not interpret it relative to the hub.
Normalize paths for comparison, but retain a clear human-readable path in coordination files.
A hub may reference any number of catalogs, and multiple hubs may reference the same source
clone. Git worktrees provide ticket isolation; copying or relocating the source clone does not.

Before creating a worktree, verify:

1. The source key exists and its root is a directory.
2. The resolved repository path exists.
3. `git -C <path> rev-parse --show-toplevel` succeeds and identifies that repository root.
4. The source clone's status has been inspected without modification.
5. The repository name is unique across `required` and `optional`.
6. The proposed ticket worktree path does not collide with another file or worktree.
7. The requested branch is not already attached to another worktree.
8. If `codegraph: true`, the `codegraph` CLI is available before any workspace write. Do not run
   `codegraph install`; the user manages agent integration separately.

Do not fetch to satisfy validation. A missing branch or start point is a decision to surface,
not permission to change local or remote state.

## Initialization and reruns

Before initializing a hub, collect and validate its purpose, source roots, repository inventory,
repository classifications, roles, criticality, and any known system conventions. Show the final
file layout and repository inventory before creating any file. Generated live files must contain
actual values, not template placeholders.

A rerun is compatible only when existing hub or ticket metadata agrees with the requested name,
paths, repository source, role, criticality, CodeGraph policy, branch, and start point. In that
case, report it as a no-op or offer to add only missing scaffold files after confirmation.

When a ticket was partially created, inspect its coordination metadata and `git worktree list
--porcelain` for every selected source. Reuse a worktree only when its path, source, branch, and
HEAD match the requested state. Record every newly successful worktree immediately. On any
failure, report the actual created state and stop; never roll it back automatically.

Any mismatch, placeholder-filled live file, occupied destination, branch attached elsewhere,
worktree registered with different metadata, or non-healthy declared CodeGraph index is
incompatible. Stop and ask the user how to proceed; never overwrite, detach, force, or silently
repair it.

## Required Versus Effective Scope

`required` means "normally relevant to understanding and working in this vertical." It does
not mean every ticket must instantiate every listed repository. A ticket may:

- reduce the scope to only the required repositories affected by its change;
- include all normal required repositories when cross-repository validation needs them;
- add optional repositories when evidence or the user identifies a dependency.

The effective ticket scope is recorded in `<ticket>/.coordination/REPOSITORIES.yml`. That file
is the operational source of truth for the ticket and may be narrower or wider than the hub's
normal context. If evidence cannot determine the scope safely, ask the user before creating
worktrees.

Each effective repository record contains:

```yaml
repositories:
  - name: core-api
    source_catalog: primary
    source_repository: ~/dev/source-catalog/core-api
    worktree: ~/dev/workspaces/example-hub/TICKET-123/core-api
    branch: feature/TICKET-123
    role: core-api
    criticality: critical
    codegraph: true
```

Use actual values, not placeholders, in a live ticket workspace. Update the file whenever a
repository, branch, role, path, or CodeGraph policy changes, and record the reason in
`DECISIONS.md` when the scope change is significant. The copied `codegraph` value is the
effective ticket policy: later changes to `HUB.yml` must not silently alter an existing ticket.

For an enabled worktree, create its graph only after its record is written:

```text
codegraph init <absolute-worktree-path>
codegraph status --json <absolute-worktree-path>
```

The reported project path must be that exact worktree. Do not persist initialization status in
`REPOSITORIES.yml`; query live status because it can become stale. A healthy matching index is a
rerun no-op. An absent index may be initialized after confirmation. A failed, partial, or
mismatched index is drift to report, not permission to run `init`, `index`, or `uninit`
silently. An index for a worktree whose effective record does not enable CodeGraph is likewise
unmanaged drift.

When a ticket is tracked by an external epic controller, the same document also contains:

```yaml
control:
  epic: EXAMPLE-123
  epic_record: ~/dev/control-hubs/example/epics/EXAMPLE-123/EPIC.yml
```

`epic` and `epic_record` must either both be present or both be absent. They do not change ticket
scope, repository containment, or archive safety. The epic record must reciprocally identify the
ticket workspace; use `workspace-control-hub` to create or reconcile that association.

## Archived Tickets

Archiving moves a completed or paused ticket coordination root from `<hub>/<ticket>/` to
`<hub>/.archive/<ticket>/` only after every declared linked worktree has been safely removed.
The archive retains `REPOSITORIES.yml` as the historical effective-scope record, even though its
recorded worktree paths no longer exist.

Before moving the ticket, create `.coordination/ARCHIVED.md` with the archive time, original
ticket path, each removed worktree path, and the branch retained for each repository. Do not use
an archive record to imply that a branch was merged, pushed, or deleted. An existing archive is a
conflict; never overwrite history.

Before removing an enabled worktree during archive, remove its healthy, declared local index only
after archive confirmation:

```text
codegraph uninit <absolute-worktree-path> --force
```

Verify that `.codegraph/` is absent and the worktree is otherwise clean before `git worktree
remove`. Do not manually delete a partial `.codegraph/` directory, remove an unmanaged index, or
allow CodeGraph to install shared Git hooks: each condition is drift that stops the archive.
