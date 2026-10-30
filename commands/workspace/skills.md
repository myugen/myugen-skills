---
description: Inspect or change one existing ticket workspace's independent optional skill selection.
argument-hint: "[hub-name] [ticket] [status|init|add|remove|sync]"
disable-model-invocation: true
---

# Manage Workspace Skills

Follow the `multirepo-workspaces` skill's **Manage Workspace Skills** workflow and its
`references/workspace-skills.md` as the authoritative portable procedure. Treat `$ARGUMENTS`
as optional hub, ticket, and operation answers; ask for missing or ambiguous values.

Target only one existing ticket's independent selection. `status` is read-only. Use the portable
helper to preview `init`, `add`, `remove`, or `sync` without `--apply`, then repeat with `--apply`
only after confirmation. Legacy instruction migration requires separate review.

Never edit `HUB.yml` or reapply defaults to an existing snapshot. For defaults for future
workspaces, direct the user to `/myugen-skills:hub:skills` instead of silently switching scope.
Stop on edited or unmanaged copies; never modify global configuration, source folders,
repository files, or another workspace.
