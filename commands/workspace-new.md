---
description: Interactively create a ticket workspace with selected repository worktrees. Use to start a workspace task, add a ticket to a hub, or run workspace new.
argument-hint: "[hub-name] [ticket]"
disable-model-invocation: true
---

# Create A Ticket Workspace

Follow the `multirepo-workspaces` skill's **Create a Ticket Workspace** workflow as the
authoritative portable procedure. Treat `$ARGUMENTS` as optional hub-name and ticket answers; ask
for every missing or ambiguous value.

1. Select the hub, read its `HUB.yml`, `SYSTEM_MAP.md`, and `AGENTS.md`, then ask which task and
   which of its registered repositories are involved. Required repositories are context, not an
   instruction to create every worktree.
2. Confirm a branch and existing local start point for every selected repository. Validate all
   source clones, local refs, worktree collisions, and branch attachments before writing.
3. Show the complete plan: ticket path, selected repositories, source paths, worktree paths,
   branches, and start points. Obtain explicit confirmation before creating coordination files or
   worktrees.
4. Create full linked Git worktrees and coordination metadata, recording only worktrees that were
   actually created. Report a truthful, resumable partial state if a later step fails.
5. Never fetch, pull, push, reset, clean, force, overwrite existing workspace content, or mutate
   source checkouts.
