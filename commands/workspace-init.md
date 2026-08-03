---
description: Interactively initialize a complete multirepo workspace hub/project. Use to create a workspace project, register its source repositories, or run workspace init.
argument-hint: "[hub-name]"
disable-model-invocation: true
---

# Initialize A Workspace Hub

Follow the `multirepo-workspaces` skill's **Create a Hub** workflow as the authoritative
portable procedure. Treat `$ARGUMENTS` as an optional hub-name answer; ask for every missing or
ambiguous value.

1. List existing hubs under `~/dev/workspaces/`, then ask which project the user wants to create
   when no usable hub name was supplied.
2. Collect the hub purpose, source catalog roots, repository inventory, required/optional
   classification, role, criticality, system context, and branch convention.
3. Validate every proposed source clone and destination before writing anything. Show the complete
   hub layout and repository inventory, then obtain explicit confirmation.
4. Create the hub only after confirmation. It must contain `HUB.yml`, `SYSTEM_MAP.md`,
   `AGENTS.md`, and `CLAUDE.md`, but never a Git repository.
5. Report the created files and any safely resumable partial state. Do not overwrite, fetch,
   clone, or alter a source checkout.
