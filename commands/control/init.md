---
description: Interactively create an external control hub for one multirepo workspace vertical.
argument-hint: "[workspace-hub] [control-hub]"
disable-model-invocation: true
---

# Initialize A Workspace Control Hub

Follow the `workspace-control-hub` skill's **Create A Control Hub** workflow as the authoritative
portable procedure. Treat `$ARGUMENTS` as optional workspace-hub and control-hub answers; ask for
every missing or ambiguous value.

1. Read the workspace hub's `HUB.yml`, `SYSTEM_MAP.md`, and `AGENTS.md`.
2. Collect the external destination, purpose, language, and optional read-only provider settings.
3. Validate reciprocal paths and inspect existing content. The controller may already be a Git
   repository, but never initialize or mutate its Git state.
4. Show the controller layout and both reciprocal path changes. Obtain explicit confirmation
   before writing.
5. Create the controller scaffolding and add `control_hub.root` to the workspace hub only after
   the controller is valid. Never overwrite, fetch, clone, commit, or alter source checkouts.
