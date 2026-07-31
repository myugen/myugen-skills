# Hub Schema

`HUB.yml` is the human-readable inventory for one functional vertical. It maps logical source
catalog names to directories of independent Git clones, then classifies repositories by how
commonly the hub needs them. It is not a monorepo manifest and does not grant permission to
change source clones.

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
