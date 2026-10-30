---
description: Configure a hub's optional skill defaults for future workspaces without changing existing tickets.
argument-hint: "[hub-name] [status|add|remove|edit]"
disable-model-invocation: true
---

# Configure Hub Skill Defaults

Follow the `multirepo-workspaces` skill's **Manage Hub Skill Defaults** workflow and its
`references/workspace-skills.md` as the authoritative portable procedure. Treat `$ARGUMENTS`
as optional hub and operation answers; ask for missing or ambiguous values.

Target only the hub's defaults in `HUB.yml`. `status` is read-only; preview requested changes
and obtain confirmation before editing. Never change existing ticket snapshots or copies.
If the user means one existing ticket, direct them to `/myugen-skills:workspace:skills` instead
of silently switching scope. Do not install skills globally or introduce subagent assignments.
