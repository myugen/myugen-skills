---
name: workspace-control-hub
description: Creates and maintains an external, per-vertical control hub that summarizes epics, ticket workspaces, dependencies, readiness, and delivery evidence without replacing Jira, Git hosting, or ticket coordination records. Use it when someone asks "como van los workspaces", "que puedo arrancar", "estado de una epica", "que bloquea este trabajo", "crea un hub controlador", or wants to diagnose drift between parallel workspaces.
---

# Workspace Control Hub

Use one external control hub per multirepo workspace hub. It is a read model for cross-ticket
coordination: it links authoritative sources, makes freshness visible, and answers what is ready
or blocked without turning a personal dashboard into a second issue tracker.

The control hub may live anywhere and may already be a Git repository, but never initialize,
change, commit, or otherwise manage its Git state as part of this skill.

## Prerequisites

- A workspace hub created with `multirepo-workspaces`, or its equivalent, must identify its
  external controller in `HUB.yml` through `control_hub.root`.
- Read the workspace hub's `HUB.yml`, `SYSTEM_MAP.md`, and `AGENTS.md` before changing control
  data. Read `CONTROL.yml` and the relevant `EPIC.yml` before changing an epic.
- Read [the control-hub schema](references/control-hub-schema.md) before creating, changing, or
  validating a control hub. It defines the source-of-truth boundaries and state vocabulary.

## Create A Control Hub

1. Collect the workspace hub path, controller destination, purpose, language, and any configured
   tracker or Git-hosting providers. Provider configuration is optional; never require Jira or
   GitHub to use the local controller.
2. Resolve and validate the controller destination. It must be an existing or new directory the
   user approved; it is not constrained beneath the workspace root. Inspect an existing directory
   and never overwrite it or initialize Git there.
3. Verify the workspace hub exists and has `HUB.yml`. Confirm the reciprocal paths that will be
   recorded in the workspace hub and `CONTROL.yml`.
4. Show the planned layout and both path changes, then get explicit confirmation before writing.
5. Create `CONTROL.yml`, `AGENTS.md`, and `CLAUDE.md` from `assets/control/` with actual values.
   Add `control_hub.root` to the workspace hub's `HUB.yml` only after the controller is valid.
6. Report the exact paths. A compatible rerun is a no-op; mismatched roots, schema versions, or
   existing unrelated content require user direction rather than repair.

## Register And Update An Epic

An epic is represented by `epics/<epic-id>/EPIC.yml` plus `EPIC.md`. The YAML file is the
structured control record; the Markdown file is a concise human control-tower view. Update both
together, but do not duplicate ticket plans, specifications, or durable decisions into either.

1. Verify the epic key is unique in this controller and gather its tracker link, title, relevant
   artifacts, known work items, dependencies, and integration intent.
2. Create the files from `assets/epic/`. Add observations with a source, timestamp, and evidence
   whenever copying a volatile fact from a tracker, PR, or filesystem.
3. Model tracker state, implementation state, workspace lifecycle, PR delivery state, and
   readiness independently. Do not derive one from another without recording the evidence.
4. Record dependencies once in `EPIC.yml`, with a type and condition. Keep the Markdown graph and
   "ready now" view as navigational summaries of those edges.
5. For each ticket workspace in the epic, set `.coordination/REPOSITORIES.yml` `control.epic` to
   the epic key and record the reciprocal workspace path in `EPIC.yml`. The association is only
   valid after both files point at each other.

## Answer A Status Question

1. Read `CONTROL.yml`, the requested `EPIC.yml`, and every declared ticket's current
   `.coordination/REPOSITORIES.yml` and `PLAN.md`. Inspect active and archived workspace paths.
2. When configured and authorized, inspect tracker and Git-hosting providers in read-only mode.
   Label each result with source and observation time; a failed external lookup is unknown, not
   unchanged.
3. Report separately: work ready to start, work blocked or on hold, review or merge bottlenecks,
   stale observations, missing workspaces, and mismatches. Link to the authoritative record rather
   than copying its full detail.
4. Update an epic only after the observation is verified. Change the affected item, readiness
   summary, and `updated_at`; do not rewrite unrelated rows or history.

## Diagnose A Controller Or Legacy Hub

`scripts/control-hub-doctor.py` is deliberately read-only. It can inspect a new structured
controller or a legacy Markdown-only epic hub such as FunLab. It reports missing reciprocal links,
orphaned ticket entries, ticket workspaces without epic links, legacy migration candidates, and
the integrity of each ticket's independent optional skill snapshot. It reuses the
`multirepo-workspaces` skill's helper when available, reports legacy tickets without migrating
them, and warns about detectable global skill collisions and old mandatory show-me instructions.
An unselected `show-me` is not a missing dependency, and no global installation is suggested.

```sh
python3 skills/workspace-control-hub/scripts/control-hub-doctor.py \
  --workspace-hub ~/dev/workspaces/funlab \
  --control-hub ~/dev/fever/funlabs-knowledge-hub
```

Run it before migrating an existing controller and after workspace archive operations. It never
creates directories, edits files, calls external services, invokes `npx`, or offers an apply mode.

## Lifecycle Integration

- When creating a ticket workspace, `multirepo-workspaces` records `control.epic` only when a
  configured controller and an explicit epic are supplied. Then register the workspace in the
  epic record after its ticket coordination root succeeds.
- When archiving, update the epic workspace state and path only after all worktrees are removed
  and the ticket coordination root has moved successfully. Archive is not equivalent to completion
  or merge.
- If either side cannot be updated after a successful workspace operation, preserve the successful
  operational state and report the reconciliation required. Never roll back worktrees to make
  metadata look atomic.

## Safety Rules

- The controller is a cross-workspace read model, not the authority for tracker, PR, repository,
  design, or durable-decision facts.
- Never initialize or mutate a Git repository in the controller.
- Never change a workspace, source clone, branch, PR, tracker issue, or remote state while
  answering a status question or running doctor.
- Never write a controller entry before the associated workspace exists and its coordination
  metadata is valid.
- Never silently reconcile disagreement. Preserve evidence, report drift, and ask before choosing
  between conflicting claims.
- Do not use `—`, blank values, or prose to conflate unknown, absent, not applicable, and not yet
  observed. Use explicit state and evidence fields.

## Reference Files

- `references/control-hub-schema.md` — schemas, vocabulary, ownership boundaries, and migration
  rules. Read it before changing control data.
- `assets/control/` — controller-root scaffolding.
- `assets/epic/` — canonical epic record and control-tower view scaffolding.
- `scripts/control-hub-doctor.py` — read-only structural diagnostics for new and legacy hubs.
