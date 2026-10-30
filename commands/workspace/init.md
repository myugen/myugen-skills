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
   classification, role, criticality, optional per-repository `codegraph: true` policy, system
   context, and branch convention. Ask whether to configure optional workspace memory; if so,
    collect the primary `knowledge-vault` path and vault name plus any read-only local sources.
    Ask whether to configure optional skill defaults for future workspaces. Each entry references
    a real local folder with `name`, `path`, and a contextual `when` criterion; default to `skills: []`.
3. Validate every proposed source clone and destination before writing anything. Show the complete
    hub layout, repository inventory, ordered memory roles, and skill defaults with validated local
    folders and usage criteria, then obtain explicit confirmation. Never install skills globally.
4. Create the hub only after confirmation. It must contain `HUB.yml`, `SYSTEM_MAP.md`,
   `AGENTS.md`, and `CLAUDE.md`, but never a Git repository.
5. Report the created files and any safely resumable partial state. Do not overwrite, fetch,
   clone, or alter a source checkout.
