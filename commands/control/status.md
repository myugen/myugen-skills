---
description: Report cross-workspace epic status, readiness, blockers, and stale evidence from an external control hub.
argument-hint: "[control-hub] [epic]"
disable-model-invocation: true
---

# Report Workspace Control Status

Follow the `workspace-control-hub` skill's **Answer A Status Question** workflow. Treat
`$ARGUMENTS` as optional control-hub and epic answers; ask for every missing or ambiguous value.

1. Read `CONTROL.yml`, the requested `EPIC.yml`, each ticket coordination record, and active or
   archived workspace paths.
2. Consult configured tracker and Git-hosting providers only in read-only mode and only when
   authorized. Include source and observation time for every volatile claim.
3. Report ready work, blockers, holds, review/merge bottlenecks, stale evidence, and reconciliation
   drift separately. Link to the authorities; do not edit them while answering.
