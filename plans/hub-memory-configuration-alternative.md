# Alternative Spec: Workspace memory in `HUB.yml`

Status: ready to implement
Requested by: Miguel Cabrera, 2026-08-22
Revised: 2026-08-22 after reviews of the original and alternative proposals
Target: `multirepo-workspaces`, `knowledge-vault`, and Claude lifecycle hooks

## Goal

Make ticket workspaces consult durable organizational memory before deriving context and persist
durable outcomes after work, without silently writing to the wrong memory.

V1 deliberately supports one writable memory implementation: `knowledge-vault`. Additional local
directories may be declared as read-only context. Other skills and remote memories require a later
schema revision.

## Design Principles

1. `HUB.yml` is the only workspace memory configuration source.
2. `memory` is optional and backward compatible.
3. The first entry is the only writable memory.
4. In v1, the first entry must be a local `knowledge-vault`.
5. Secondary entries are local, skill-less, and read-only.
6. No runtime writes directly into a declared filesystem path.
7. Explicit but malformed workspace memory fails closed instead of falling back to another vault.
8. Hubs without `memory` preserve the existing `config.json` behavior.
9. Schema validation remains agent-enforced.
10. Executable resolution uses a documented canonical subset, not a general YAML parser.

## V1 Schema

```yaml
memory:
  - name: vault
    type: local
    path: ~/Documents/vaults/fever
    skill: knowledge-vault
    config:
      vault: fever

  - name: knowledge-hub
    type: local
    path: ~/dev/fever/funlabs-knowledge-hub
```

## Validation Rules

- `memory` is optional.
- `memory: []` is equivalent to absence but should be reported as redundant during inspection.
- When present and non-empty, `memory` must be a list of maps.
- `name`, `type`, `path`, and `skill` must be non-empty scalar strings when present.
- Names must be unique and use letters, digits, `.`, `_`, and `-`.
- Every v1 entry must use `type: local`.
- Local paths must be absolute or begin with `~/`.
- The first entry must declare `skill: knowledge-vault`.
- The first entry must contain a map `config` with a non-empty scalar `vault`.
- Secondary entries must not declare `skill` or `config`.
- Unknown entry keys are reported and require user direction.
- Missing local paths are warnings.
- A malformed primary makes the whole memory block read-only and unusable for automatic writes.

These rules are normative agent instructions. V1 does not introduce a general executable
`HUB.yml` validator.

## Runtime Protocol

At the start of planning, exploration, or implementation:

1. Read the hub's `HUB.yml`.
2. Search every valid local memory by ticket key, topic, and named people.
3. Use `knowledge-vault` for the primary when the skill and Obsidian prerequisites work.
4. Search secondary entries directly with read-only file tools.
5. If the skill is unavailable, search the primary path read-only and report degraded operation.
6. Never fail the main task because memory cannot be read.

At the end of work:

1. Identify decisions or context that will outlive the ticket.
2. Persist them only through the primary `knowledge-vault`.
3. Keep ticket-specific `PLAN.md`, `IMPACT.md`, and `DECISIONS.md` in `.coordination/`.
4. If the skill or its prerequisites do not work, report that persistence did not occur.
5. Never write directly under `memory[].path` as a fallback.

## Supported Entry Points

The protocol is guaranteed when the session starts at the hub root or ticket root.

Claude Code also loads ancestor instructions when started inside a worktree. OpenCode may stop at
the worktree repository's own instructions, so worktree-started OpenCode sessions have partial
coverage in v1.

Injecting workspace instructions into arbitrary OpenCode worktree sessions is deferred.

## Workspace Discovery

Executable vault resolution must not select an arbitrary ancestor named `HUB.yml`.

Use this algorithm:

1. Resolve the physical current directory.
2. First pass: ascend to the filesystem root looking for
   `.coordination/REPOSITORIES.yml`.
3. The directory containing `.coordination/` is a ticket root.
4. For an active ticket, its parent is the hub candidate.
5. For an archived ticket whose parent is `.archive`, the parent of `.archive` is the hub
   candidate.
6. Accept the candidate only when `<candidate>/HUB.yml` exists and is readable.
7. Second pass, only when no ticket marker was found: ascend from the physical working directory
   to the filesystem root and select the nearest readable `HUB.yml`. This covers the hub root and
   arbitrary subdirectories beneath the hub.
8. Always complete the ticket-marker pass before considering an ancestor `HUB.yml`. This prevents
   a repository-local `HUB.yml` inside a worktree from hiding the actual workspace hub.
9. If a ticket marker produces a candidate without a readable `HUB.yml`, report malformed
   workspace structure and do not guess another hub.
10. If neither pass produces a candidate, report that no workspace memory was found.
11. Workspaces outside `$HOME` are supported.

The existing workspace layout guarantees that active tickets are direct children of their hub and
archived tickets live directly under `<hub>/.archive/`.

## Canonical Memory Reader

Add a stdlib-only helper:

```text
skills/knowledge-vault/scripts/resolve-workspace-memory.py
```

The helper receives a working directory and returns one of:

```json
{"status":"absent"}
{"status":"valid","vault":"fever","path":"~/Documents/vaults/fever"}
{"status":"malformed","message":"..."}
```

Supported syntax:

- Two-space indentation.
- Top-level `memory:`.
- Block-style list entries.
- Scalar key/value pairs in any order.
- One `config` map containing scalar values.
- Blank lines and full-line comments.
- Trailing comments.
- Single- and double-quoted scalar values.
- `#` inside a quoted scalar.

Unsupported syntax inside `memory`:

- Flow collections.
- Anchors or aliases.
- Multi-line scalars.
- Tabs.
- Nested structures beyond `config`.

Unsupported or ambiguous syntax returns `malformed`; it is never guessed.

The helper is only a workspace-memory reader. It is not advertised as a general YAML validator.

## Vault Resolution

`resolve-vault.sh` uses this precedence:

1. Non-empty `$OBSIDIAN_VAULT`.
2. Valid workspace primary `config.vault`.
3. Existing `config.json` longest repository-prefix match, only when workspace memory is absent.
4. Existing `config.json` `defaultVault`, only when workspace memory is absent.

Failure behavior:

- Workspace memory absent: preserve legacy `config.json` behavior.
- Workspace memory valid: return its vault even when `config.json` does not exist.
- Workspace memory malformed: exit non-zero and do not fall back to `config.json`.
- Workspace primary is not `knowledge-vault`: exit non-zero and do not fall back.
- Workspace vault is empty: exit non-zero and do not fall back.

Failing closed prevents writes to an unrelated default vault.

## Claude Hook Behavior

The hooks must respect workspace memory ownership.

```text
No HUB memory
  -> preserve legacy knowledge-vault behavior

Valid knowledge-vault primary
  -> SessionStart, Stop, and SessionEnd use config.vault

Explicit malformed memory
  -> hooks no-op and report diagnostics where the lifecycle event permits

Primary managed by another skill
  -> hooks no-op
```

`session-stop.sh` must not ask the model to persist through `knowledge-vault` unless it is the
valid primary.

`session-end.sh` must not write a `SESS-` note to a secondary or fallback vault when explicit
workspace memory exists.

`autoSession: false` in user `config.json` remains the global kill switch.

## Files To Change

| File | Change |
|---|---|
| `skills/multirepo-workspaces/references/hub-schema.md` | Document the narrowed v1 schema and protocol |
| `skills/multirepo-workspaces/assets/HUB.yml.example` | Add canonical memory example |
| `skills/multirepo-workspaces/assets/hub/AGENTS.md` | Hub-root protocol |
| `skills/multirepo-workspaces/assets/AGENTS.md` | Ticket-root protocol and entry-point limitation |
| `skills/multirepo-workspaces/assets/coordination/AGENTS.md` | Start/read/end persistence instructions |
| `skills/multirepo-workspaces/SKILL.md` | Collect, validate, inspect, and report memory |
| `commands/workspace/init.md` | Offer optional memory configuration |
| `opencode/plugin.js` | Include memory in the workspace-init adapter |
| `skills/knowledge-vault/scripts/resolve-workspace-memory.py` | Canonical reader and workspace discovery |
| `skills/knowledge-vault/scripts/resolve-vault.sh` | New precedence and fail-closed behavior |
| `skills/knowledge-vault/SKILL.md` | Workspace-aware resolution and degraded reads |
| `skills/knowledge-vault/references/cli-usage.md` | Resolution contract |
| `skills/knowledge-vault/references/setup.md` | Workspace operation without config.json |
| `skills/knowledge-vault/scripts/next-id.sh` | Correct resolution comments |
| `scripts/session-start.sh` | Use workspace primary and update context |
| `scripts/session-stop.sh` | Nudge only for valid knowledge-vault primary |
| `scripts/session-end.sh` | Write sessions only to valid primary or legacy config |
| `hooks/README.md` | Document workspace-aware hook behavior |
| `test/` | Resolver, hook, and generated-instruction coverage |
| `skills/index.json` | Regenerate catalog hashes |
| Plugin manifests and `package.json` | Synchronized version bump |
| `CHANGELOG.md` | Document memory-aware workspaces |

Claude adapter files that import the corresponding `AGENTS.md` files do not need duplicated
protocol prose.

## Behavior Tests

1. `$OBSIDIAN_VAULT` wins over every source.
2. Valid workspace memory works without `config.json`.
3. Workspace memory wins over repository-prefix and default config.
4. Hub without memory preserves prefix and default behavior.
5. Malformed explicit memory fails closed.
6. Missing `config.vault` fails closed.
7. A non-knowledge-vault primary fails closed.
8. Resolution works from hub root, ticket root, worktree root, and nested worktree directories.
9. Resolution works for a workspace outside `$HOME`.
10. A repository-local unrelated `HUB.yml` is ignored.
11. Resolution works from an arbitrary subdirectory beneath the hub.
12. Resolution works from an archived ticket under `<hub>/.archive/<ticket>/`.
13. A ticket marker whose calculated hub has no readable `HUB.yml` reports malformed workspace
    structure and does not select another ancestor.
14. Quoted values, comments, key ordering, and `#` inside quotes parse correctly.
15. Unsupported canonical forms return `malformed`.
16. `session-stop.sh` does not nudge for malformed or non-knowledge-vault primary memory.
17. `session-end.sh` does not write to legacy config when explicit workspace memory is malformed.
18. Existing hubs without memory retain current hook behavior.
19. Generated instructions contain start, degraded-read, conditional-write, and entry-point rules.
20. Version metadata and generated skill catalog remain synchronized.

## Acceptance Criteria

1. Existing hubs without `memory` behave exactly as before.
2. A valid primary `knowledge-vault` resolves without user `config.json`.
3. Explicit malformed memory never causes a write to another vault.
4. Secondary memories are read-only.
5. All Claude hooks honor the primary-memory contract.
6. Hub, ticket, and coordination instructions contain the memory protocol.
7. Workspace creation offers memory but permits skipping it.
8. Resolver and hook behavior tests pass.
9. Catalog, manifests, package version, and changelog are synchronized.

## First Consumer

The first intended consumer is the existing FunLab workspace hub. Updating that live hub remains
outside this implementation; after the feature ships, `~/dev/workspaces/funlab/HUB.yml` can use:

```yaml
memory:
  - name: vault
    type: local
    path: ~/Documents/vaults/fever
    skill: knowledge-vault
    config:
      vault: fever

  - name: knowledge-hub
    type: local
    path: ~/dev/fever/funlabs-knowledge-hub
```

This conforms to v1: the primary is a local `knowledge-vault`, and the secondary local directory
is read-only.

## Out Of Scope

- Writable memory implementations other than `knowledge-vault`.
- Remote memories.
- Secondary memory skills.
- Direct filesystem writes to memory paths.
- Per-ticket overrides.
- General YAML validation.
- Automatic OpenCode instruction injection inside repository worktrees.
- Automatic migration of existing hubs.

## Revision Log

### Alternative rev 2 - 2026-08-22

- Added two-pass workspace discovery so ticket metadata takes precedence over repository-local
  `HUB.yml` files while hub subdirectories remain supported.
- Added archived-ticket discovery and malformed candidate behavior.
- Added the FunLab first-consumer reference.
- Marked the alternative plan ready to implement after review by both agents.

### Alternative rev 1 - 2026-08-22

- Narrowed writable memory in v1 to a local `knowledge-vault` primary.
- Made secondary local memories read-only and deferred remote and secondary-skill behavior.
- Made explicit malformed workspace memory fail closed instead of falling back to another vault.
- Required Claude lifecycle hooks to honor the declared primary memory.
- Replaced arbitrary ancestor `HUB.yml` discovery with workspace-structure-aware resolution.
- Defined behavior tests for resolver precedence, canonical parsing, hooks, and backward
  compatibility.

This alternative was derived from `plans/hub-memory-configuration.md` rev 3 after maintainer-agent
reviews identified unresolved hook ownership, discovery, and parser-scope risks.
