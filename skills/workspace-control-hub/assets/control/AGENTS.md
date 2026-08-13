# Workspace Control Hub

This directory is an external control hub for one workspace vertical. It is not a source clone,
ticket workspace, or substitute for the tracker, Git host, documentation, or durable-decision
store.

Before changing anything, read `CONTROL.yml` and the relevant `epics/<epic>/EPIC.yml`. Read the
associated workspace hub's `HUB.yml`, `SYSTEM_MAP.md`, and `AGENTS.md` before claiming a workspace
or ticket fact.

`EPIC.yml` is the structured cross-ticket read model. `EPIC.md` is its concise human control view.
Keep them aligned, link to authoritative records rather than copying them, and record source and
observation time for volatile facts. Do not silently reconcile conflicts.

Do not initialize, mutate, commit, or otherwise manage Git in this directory. Do not change source
clones, ticket workspaces, branches, PRs, trackers, or remote state while inspecting status.
