# Control Hub Schema

A control hub is external to a workspace hub and has no ownership over source repositories or
their worktrees. It is a structured, evidence-backed read model that joins cross-ticket facts.

## Layout

```text
<control-hub>/
├── CONTROL.yml
├── AGENTS.md
├── CLAUDE.md
└── epics/
    └── <epic-id>/
        ├── EPIC.yml
        └── EPIC.md
```

Do not create a Git repository here. An existing repository is allowed, but it remains under the
user's normal repository policy rather than this skill's control.

## `CONTROL.yml`

```yaml
schema_version: 1
workspace_hub: ~/dev/workspaces/example
purpose: Cross-ticket delivery control for Example
language: en
providers:
  tracker:
    type: jira
    base_url: https://tracker.example.com
  git_host:
    type: github
    base_url: https://github.com/example
```

| Field | Required | Meaning |
|---|---|---|
| `schema_version` | Yes | Use `1`. |
| `workspace_hub` | Yes | Absolute or home-relative path to the associated workspace hub. |
| `purpose` | Yes | What the vertical is coordinating. |
| `language` | Yes | Language used for controller-local prose. |
| `providers` | No | Read-only external sources that may be consulted when configured and authorized. |

The corresponding workspace `HUB.yml` contains the reciprocal optional field:

```yaml
control_hub:
  root: ~/dev/control-hubs/example
```

Paths must normalize to each other. A control root outside the workspace root is intentional and
does not relax any workspace containment rule.

## `EPIC.yml`

```yaml
schema_version: 1
epic:
  key: EXAMPLE-123
  title: Example delivery
  tracker_url: https://tracker.example.com/browse/EXAMPLE-123
  lifecycle: active
links:
  specifications: []
  decisions: []
  plans: []
updated_at: 2026-08-12
items:
  - key: EXAMPLE-456
    title: Implement the slice
    tracker:
      status: to-do
      url: https://tracker.example.com/browse/EXAMPLE-456
      observed_at: 2026-08-12
    implementation:
      status: not-started
      observed_at: 2026-08-12
      evidence: []
    workspace:
      state: absent
      path: null
      observed_at: 2026-08-12
    changes: []
    dependencies: []
    gates: []
    readiness:
      state: ready
      reasons: []
      assessed_at: 2026-08-12
    latest_event:
      at: 2026-08-12
      summary: Ticket imported from the tracker.
      evidence: []
integration:
  expected_order: []
  stacked_changes: []
external_dependencies: []
rollout_gates: []
```

Use identifiers rather than embedded worktree detail. `changes` may contain repository, branch,
base, PR URL, PR state, CI state, and observation time. A dependency must include its target,
`type` (`code`, `merge`, `product-decision`, `external-delivery`, `rollout`, or
`ownership-confirmation`), its condition, and evidence. Use `applies_to` when only a slice of a
ticket is blocked.

## State Vocabulary

Keep these fields separate:

| Field | Values | Authority |
|---|---|---|
| `tracker.status` | Provider-native normalized status | Tracker |
| `implementation.status` | `not-started`, `in-progress`, `blocked`, `completed` | Ticket `PLAN.md` |
| `workspace.state` | `absent`, `active`, `archived` | Workspace filesystem and coordination metadata |
| `readiness.state` | `ready`, `blocked`, `verify`, `hold` | Control-hub assessment with reasons |
| `epic.lifecycle` | `planned`, `active`, `completed`, `archived` | Epic control record |

`completed` implementation can still have an open PR. `archived` workspace can represent paused
work. Neither implies a tracker transition, merge, or ticket completion.

## Evidence And Freshness

Every fact copied from a volatile source has `observed_at` and, where practical, a link, command,
or source reference in `evidence`. Do not claim that a source was checked when it was unavailable.
Use an explicit null or `unknown` only where the schema permits it, and explain it in the event or
readiness reasons.

`EPIC.md` is a concise view for people: context capsule, a ticket table, ready-now items,
integration intent, and history. It navigates to authorities and must not become a duplicate plan
or a durable-design document.

## Workspace Backlink

Ticket coordination records use an optional control section:

```yaml
control:
  epic: EXAMPLE-123
  epic_record: ~/dev/control-hubs/example/epics/EXAMPLE-123/EPIC.yml
```

Both fields are required together. They are operational links only; all selected repositories stay
under `repositories` as before.

## Migration

Legacy Markdown boards can be inspected with `control-hub-doctor.py`. The doctor does not write or
infer a migration. It can identify candidate epic directories, ticket keys found in board rows,
ticket workspaces, and legacy `Tablero de epica:` links. Review all candidate values before
creating `CONTROL.yml` and `EPIC.yml`; legacy prose is evidence, not canonical structured data.
