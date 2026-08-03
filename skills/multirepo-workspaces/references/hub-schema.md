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
└── <ticket>/       one coordination root per ticket, never a Git repository
```

The hub and ticket roots are coordination directories, not repositories. Only their selected
repository children are linked Git worktrees.

## Names and destination safety

- Hub names, ticket names, source identifiers, and repository names must be non-empty, unique in
  their relevant map/list, and contain only letters, digits, `.`, `_`, and `-`.
- Reject names containing separators, `.` or `..` as complete names, or absolute paths.
- Resolve and normalize every destination before writing. A hub must remain under the selected
  workspace root; a ticket must remain directly under its hub; a worktree must remain directly
  under its ticket.
- Do not follow a symlink that would escape one of those roots. A destination that already exists
  as a file, symlink, or unrelated directory is a conflict, not permission to overwrite it.
- A source root and source repository may be symlinks only when their resolved paths still match
  the user-confirmed source catalog and Git repository. Never create symlinks as workspaces.

## Complete Example

```yaml
version: 1

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
| `sources` | Yes | Map of stable, hub-local source catalog identifiers. |
| `sources.<id>.root` | Yes | Absolute or home-relative directory containing source clones. |
| `repositories.required` | Yes | Repositories that describe the hub's normal working context. May be empty. |
| `repositories.optional` | Yes | Repositories included only when a ticket needs them. May be empty. |
| `name` | Yes | Source clone directory name and ticket worktree directory name. Must be unique across both lists. |
| `source` | Yes | Key from `sources`; never an implicit directory path. |
| `role` | Yes | Short, functional purpose in this hub, such as `core-api`, `contracts`, or `frontend`. |
| `criticality` | Yes | Operational importance to the vertical. Prefer `critical`, `high`, `medium`, or `low`. |

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

Do not fetch to satisfy validation. A missing branch or start point is a decision to surface,
not permission to change local or remote state.

## Initialization and reruns

Before initializing a hub, collect and validate its purpose, source roots, repository inventory,
repository classifications, roles, criticality, and any known system conventions. Show the final
file layout and repository inventory before creating any file. Generated live files must contain
actual values, not template placeholders.

A rerun is compatible only when existing hub or ticket metadata agrees with the requested name,
paths, repository source, role, criticality, branch, and start point. In that case, report it as
a no-op or offer to add only missing scaffold files after confirmation.

When a ticket was partially created, inspect its coordination metadata and `git worktree list
--porcelain` for every selected source. Reuse a worktree only when its path, source, branch, and
HEAD match the requested state. Record every newly successful worktree immediately. On any
failure, report the actual created state and stop; never roll it back automatically.

Any mismatch, placeholder-filled live file, occupied destination, branch attached elsewhere, or
worktree registered with different metadata is incompatible. Stop and ask the user how to proceed;
never overwrite, detach, force, or silently repair it.

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
```

Use actual values, not placeholders, in a live ticket workspace. Update the file whenever a
repository, branch, role, or path changes, and record the reason in `DECISIONS.md` when the
scope change is significant.
