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
3. Verify the CodeGraph CLI for every selected repository configured with `codegraph: true`. Show
   the complete plan: ticket path, selected repositories, source paths, worktree paths, branches,
   start points, and CodeGraph policies. Obtain explicit confirmation before creating coordination
    files or worktrees. For a new ticket, validate the hub's optional skill defaults with the
    workspace-skills helper and include their paths and `when` criteria in this preview. Existing
    tickets retain their own snapshot; never reapply changed hub defaults.
4. Create full linked Git worktrees and coordination metadata, recording each effective CodeGraph
   policy before initializing its worktree-local index. Report a truthful, resumable partial state
    if a later step fails. Before creating worktrees, initialize the confirmed independent skill
    snapshot, guidance, ownership state, and full copies under the ticket root's `.claude/skills/`.
    Stop on skill setup failure; never install globally or write skills inside repositories.
5. Never fetch, pull, push, reset, clean, force, overwrite existing workspace content, or mutate
   source checkouts.
