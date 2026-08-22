# Spec — Workspace memory configuration in `HUB.yml`

Status: ready to implement (rev 3)
Requested by: Miguel Cabrera, 2026-08-22
Revised: 2026-08-22, twice, after maintainer-agent reviews (see Revision log at the bottom)
Target: `multirepo-workspaces` (primary) and `knowledge-vault` (resolver change)

## Problem

Workspaces are not memory-aware. The `fever` hub has an Obsidian vault full of decisions,
communication policies, and environment gotchas, but nothing in the workspace tells an agent it
exists. Whether the vault gets consulted while planning or exploring depends on the user
prompting for it, and persistence only happens because a stop hook forces it. During GAME-1078
an agent planned a reply to a reviewer without finding the existing decision note about that
same reviewer's previous round (DEC-0028).

The workspace should declare its memory, and the hub/ticket instructions should make consulting
it at task start and persisting to it at task end part of the normal protocol **for sessions
started at the hub root or a ticket root**. Sessions started inside a repository worktree get
partial coverage in v1: some runtimes load ancestor instructions and some do not (see
"Supported session entry points").

## Design decisions (already made with Miguel, do not reopen)

1. `memory` is a **list** of entries, not a single block.
2. `path` is always a generic disk path or locator. Skill-specific parameters go in an optional
   `config` map (for example the vault *name* that the `knowledge-vault` skill needs). When
   `skill` is set, **`config` is authoritative** and `path` is informational (it is the
   read-only fallback when the skill is unavailable).
3. Scope is **`HUB.yml` only**. No per-ticket override in v1.
4. **Validation is agent-enforced in v1**, like the rest of the hub schema: normative rules
   written into the skill instructions and applied by the agent during create, rerun, and
   inspect flows. There is no executable HUB.yml validator and this spec does not introduce one
   (noted as a possible v2). Nothing in this spec may claim executable accept/reject behavior —
   the single exception is `resolve-vault.sh`, which is an executable and gets a precisely
   specified canonical-form reader (below).
5. In v1 the **primary memory (first entry) must be `type: local` and declare a `skill`** — it
   is the only operative write target. `remote` entries are schema-valid but unsupported at
   runtime (neither read nor written; reported as unsupported).
6. **At most one entry per `skill` value.**
7. **Entries without `skill` are read-only in v1.** Agents consult them (grep, file reads) but
   never write into them.

## Schema

New optional top-level key in `HUB.yml`:

```yaml
memory:
  - name: vault                          # required, unique within the list, hub name charset
    type: local                          # required: local | remote (remote: schema-valid, unsupported in v1)
    path: ~/Documents/vaults/fever       # required: absolute or ~/ path (local) or URL/locator (remote); informational when skill is set
    skill: knowledge-vault               # optional: skill that manages this memory
    config:                              # only valid together with skill; authoritative for the skill
      vault: fever
  - name: knowledge-hub
    type: local
    path: ~/dev/fever/funlabs-knowledge-hub   # no skill: read-only plain files
```

### Semantics

- The **first** entry is the primary memory: the write target for decisions, plans, and durable
  context. In v1 it must be `local` and skill-managed (decision 5); if a hub violates this, the
  agent treats the whole memory block as read-only and says so.
- All `local` entries are consulted for reads: through their skill when declared and available,
  by plain file search under `path` otherwise.
- If a declared skill is unavailable in the current runtime, degrade that entry to read-only
  file access under `path` and say so. Never fail the user's task because a memory skill is
  missing.
- `remote` entries are ignored at runtime in v1 and reported as unsupported when listed.
- Memory complements `.coordination/`; it does not replace it. Ticket-scoped records (PLAN.md,
  DECISIONS.md, IMPACT.md) stay in the ticket. Memory is for knowledge that outlives one ticket.

### Validation rules (agent-enforced, v1)

Normative rules the skill instructions direct the agent to apply when it creates a hub, reruns
scaffolding, or inspects one. Prose rules, enforced the same way the rest of the hub schema is
enforced today.

- `memory` as a whole is optional. Existing hubs without it remain valid.
- Structural rules: `memory`, when present, must be a list; `memory: []` is treated as absent
  (inspect notes it); every entry must be a map; `config` must be a map; `name`, `type`,
  `path`, and `skill` must be scalars. Violations are reported as malformed configuration.
- `name`: required, non-empty, unique within the list, same charset rules as source and
  repository names (letters, digits, `.`, `_`, `-`).
- `type`: required, `local` or `remote`.
- `path`: required, non-empty. For `local`, it must be absolute or start with `~/` (same rule
  as source roots — no relative paths). Expand `~` and check existence during create and
  inspect; a missing path is a warning, not an error.
- `skill`: optional. At most one entry per skill value. The first entry must declare one.
- `config`: **only valid together with `skill`** — `config` without `skill` is invalid
  configuration and is reported as such (not merely "meaningless"). Contents are opaque to the
  generic schema, but skills may impose their own requirements (next rule).
- Per-skill rule for `knowledge-vault`: the entry must carry a non-empty scalar
  `config.vault`. Without it the entry is malformed (inspect reports it; the resolver treats
  it as unreadable and falls through).
- Keys other than the five defined ones in a memory entry: the agent flags them and asks,
  rather than silently accepting or inventing meaning for them.
- The first entry must be `type: local` with `skill` set. If not, the agent reports the block
  as read-only/misconfigured instead of picking a different write target.

## Behavioral contract (the important part)

Add a memory protocol to the generated instructions, phrased provider-neutrally like the rest
of the templates:

- **At the start** of planning, exploring, or implementing a task: resolve `memory` from
  `HUB.yml` (from a ticket, the parent hub's), then search the declared memories for existing
  context by ticket key, topic, and any person named in the request, before deriving context
  from scratch. Use the declared skill when available, plain file search otherwise.
- **At the end** of work that produced decisions or durable context: persist it to the primary
  memory **if its skill is available and its prerequisites work**. If they do not, report
  clearly that the context could not be persisted and continue — never write directly under
  `path` as a substitute.

### Supported session entry points

The protocol is guaranteed for sessions started at the **hub root or a ticket root**. From
inside a repository worktree, coverage is partial in v1 and runtime-dependent: Claude Code
loads ancestor `CLAUDE.md` files (so the hub's `@HUB.yml` still reaches the session), while
OpenCode uses the nearest local `AGENTS.md`/`CLAUDE.md` and may never see the hub or ticket
instructions. Document this limitation explicitly in the templates and skill docs. Extending
`opencode/plugin.js` to inject the memory protocol into worktree sessions is a follow-up,
out of scope for v1.

## knowledge-vault resolver change

### Precedence

Vault resolution precedence becomes, in order:

1. `$OBSIDIAN_VAULT` (explicit override, unchanged).
2. The discovered `HUB.yml`'s memory entry with `skill: knowledge-vault` → its `config.vault`.
3. `config.json` longest repository-prefix match (unchanged).
4. `config.json` `defaultVault` (unchanged).

`scripts/resolve-vault.sh` currently exits with an error when `config.json` is missing before
trying anything else (line ~30). Fix the order so step 2 can succeed without a `config.json`;
the missing-config error only applies when steps 1–2 produced nothing.

### HUB.yml discovery algorithm

From the physical working directory (`pwd -P`, symlinks resolved), ascend parent directories
up to and including `$HOME`, checking each level for a file named `HUB.yml`. The **nearest**
one wins; stop at the first hit. This covers all four session shapes: hub root (found
immediately), ticket root (one level up), worktree root and worktree subdirectory (ascend
through the ticket to the hub). Nothing above `$HOME` is examined. Nested hubs are not a valid
layout; if they exist anyway, nearest-wins applies and the inspect flow flags the nesting. A
discovered `HUB.yml` that is unreadable or malformed produces a warning on stderr and the
resolver falls through to step 3 — discovery never aborts resolution.

### Canonical-form reader (not a YAML parser)

The resolver needs `memory[].skill` and `config.vault` from `HUB.yml` without adding a YAML
dependency. Implement a **restricted canonical-form reader** inside the script's existing
`python3 - <<PY` heredoc (stdlib only), specified as follows.

Supported (the form the skill itself generates):

- Two-space indentation levels; the top-level `memory:` key; list items introduced by `- ` at
  the first indent level; scalar `key: value` pairs, keys in any order; one nested map level
  for `config:`.
- Scalar values optionally wrapped in single or double quotes — quotes are stripped.
- Full-line comments and trailing comments are ignored; a `#` inside a quoted value is part of
  the value.
- Blank lines are ignored. Keys the reader does not know are skipped without error.
- `memory: []` on one line is recognized as an empty block (treated as absent).

Not supported (out of grammar): any other flow style (`[...]`, `{...}`), anchors and aliases,
multi-line scalars (`|`, `>`), tabs for indentation.

Error behavior: any line inside the `memory` block that the reader cannot classify makes the
whole `HUB.yml` unreadable **for resolution purposes**: emit one warning on stderr and fall
through to the next precedence step. The reader never crashes the resolver and never guesses.

### Docs and comments to update with the resolver

`references/cli-usage.md`, `references/setup.md`, the header comments of `resolve-vault.sh`,
and every place that currently describes `config.json` as the only resolution source:
`scripts/session-start.sh`, `scripts/next-id.sh`, and `hooks/README.md` (mandatory, not
review-only).

## Files to change

| File | Change |
|---|---|
| `skills/multirepo-workspaces/references/hub-schema.md` | Document the `memory` block: schema, semantics, the agent-enforced validation rules (structural forms included), and a complete example |
| `skills/multirepo-workspaces/assets/HUB.yml.example` | Add a commented `memory` example |
| `skills/multirepo-workspaces/assets/hub/AGENTS.md` and `assets/AGENTS.md` | Hub-level memory protocol paragraph, including the supported-entry-point note |
| `skills/multirepo-workspaces/assets/coordination/AGENTS.md` | Ticket-level: "resolve `memory` from the parent hub's `HUB.yml`; consult it before planning, persist durable context to the primary memory when closing work (skill available), report when persistence was not possible" |
| `skills/multirepo-workspaces/SKILL.md` | Hub create flow offers configuring memory (optional, skippable); inspect flows surface declared memories and report unsupported/misconfigured/malformed entries and nested hubs; create/rerun/inspect apply the validation rules above |
| `skills/knowledge-vault/SKILL.md` + `scripts/resolve-vault.sh` | Precedence change, discovery algorithm, canonical-form reader as specified above |
| `skills/knowledge-vault/references/cli-usage.md`, `references/setup.md` | Document the new precedence and discovery |
| `scripts/session-start.sh`, `scripts/next-id.sh`, `hooks/README.md` | Update comments/docs that present `config.json` as the only resolution source (mandatory) |
| `commands/workspace/init.md` | Mention the optional memory configuration step in hub creation (mandatory) |
| `opencode/plugin.js` | `workspace-init` template mentions the optional memory configuration step (mandatory). Protocol injection into worktree sessions stays a follow-up |
| `test/` | Text-assertion tests (existing pattern, `test/multirepo-codegraph.test.js`): generated instructions contain the memory protocol and validation rules. Behavior tests for `resolve-vault.sh` (see list below) |
| `scripts/generate-skill-index.py` output (`skills/index.json`) | Regenerate after skill doc changes |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `CHANGELOG.md` | Version bump and changelog per repo convention |

### Resolver test list (behavior tests)

1. Full precedence: `$OBSIDIAN_VAULT` wins even with a configured hub; HUB.yml beats
   `config.json` prefix match; prefix match beats `defaultVault`.
2. Execution from hub root, ticket root, worktree root, and a worktree subdirectory all
   resolve the same hub vault.
3. `config.vault` quoted (single and double) resolves to the unquoted name.
4. A `knowledge-vault` entry without `config.vault` → warning + fall-through to `config.json`.
5. Malformed `HUB.yml` (out-of-grammar line inside `memory`) → warning + fall-through.
6. Hub without a `memory` block falls through to `config.json` silently.
7. HUB.yml present and valid with **no** `config.json` at all → resolves from the hub (this is
   acceptance criterion 4).

## Out of scope for v1

- Per-ticket memory overrides.
- Any `remote` runtime behavior (schema shape only; entries reported as unsupported).
- Writes to skill-less memories, and any direct-write fallback when the primary skill is
  unavailable.
- An executable HUB.yml validator (possible v2).
- `opencode/plugin.js` injection of the memory protocol into worktree sessions (follow-up).
- `workspace-control-hub` integration.

## Acceptance criteria

1. A `HUB.yml` without `memory` is treated exactly as before by every flow.
2. `hub-schema.md` and `SKILL.md` state the validation rules above as normative instructions,
   including the structural-form rules, the absolute-or-`~/` path rule, `config` without
   `skill` as invalid, and the `knowledge-vault` `config.vault` requirement.
3. Freshly scaffolded hub and ticket instructions include the memory protocol, the conditional
   persistence contract, and the supported-entry-point note (text-asserted in `test/`).
4. With a memory entry declaring `skill: knowledge-vault` and `config.vault: fever`, and no
   `~/.config/knowledge-vault/config.json`, `scripts/resolve-vault.sh` run from the hub root,
   a ticket root, a worktree root, and a worktree subdirectory prints `fever`.
   `$OBSIDIAN_VAULT` still wins over everything. The full resolver test list passes.
5. `commands/workspace/init.md` and the `workspace-init` template mention memory
   configuration; `session-start.sh`, `next-id.sh`, and `hooks/README.md` no longer describe
   `config.json` as the only source.
6. `skills/index.json` regenerated; plugin manifests, `package.json`, and `CHANGELOG.md`
   updated per repo convention.

## First consumer (reference, not part of this implementation)

`~/dev/workspaces/funlab/HUB.yml` already declares (conforms to rev 3: `~/` paths, primary is
local and skill-managed with a scalar `config.vault`, second entry skill-less and read-only;
its comment lines are within the canonical grammar):

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

## Revision log

**rev 3 (2026-08-22)** — after the maintainer agent's second review:

- Specified the resolver's YAML access as a restricted **canonical-form reader** (stdlib-only,
  exact grammar, warning + fall-through on anything out of grammar) instead of leaving the
  parser question open.
- Specified the **HUB.yml discovery algorithm** (physical paths, ascend to `$HOME`, nearest
  wins, malformed → fall-through, nested hubs flagged).
- Added the per-skill validation rule: `knowledge-vault` entries require a non-empty scalar
  `config.vault`; `config` without `skill` is now invalid configuration, not just meaningless.
- Enumerated structurally invalid forms (non-list `memory`, empty list, non-map entries,
  non-map `config`, non-scalar fields) and required absolute-or-`~/` local paths like source
  roots.
- Made the closing contract conditional: persist only when the skill works; report when it
  does not; never write directly under `path`.
- Rescoped the problem statement to hub/ticket-root sessions; worktree/OpenCode is partial
  coverage in v1.
- Promoted `commands/workspace/init.md`, the `workspace-init` plugin template, and the
  `session-start.sh`/`next-id.sh`/`hooks/README.md` comment updates from "review" to mandatory.
- Expanded the resolver test list (entry-point matrix, quoted values, malformed cases,
  fall-throughs, `$OBSIDIAN_VAULT` supremacy).

**rev 2 (2026-08-22)** — after the first review: validation honestly described as
agent-enforced; primary must be local + skill-managed; one entry per skill; skill-less entries
read-only; remote unsupported; OpenCode limitation documented; resolver precedence, docs,
manifests, and index included.

**rev 1 (2026-08-22)** — initial spec.
