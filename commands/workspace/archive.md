---
description: Interactively archive a ticket workspace, remove clean worktrees, preserve branches, and retain coordination history. Use to archive a workspace ticket or run workspace archive.
argument-hint: "[hub-name] [ticket]"
disable-model-invocation: true
---

# Archive A Ticket Workspace

Follow the `multirepo-workspaces` skill's **Archive A Workspace** workflow as the authoritative
portable procedure. Treat `$ARGUMENTS` as optional hub-name and ticket answers; ask for every
missing or ambiguous value.

1. Read the hub and ticket coordination files. Validate every declared worktree against its source
   repository, inspect status and detectable unpushed commits from existing local refs, and stop
   on dirty worktrees, drift, unexpected ticket-root content, or archive collisions.
2. Show every worktree to remove, every branch to retain, and the destination
   `<hub>/.archive/<ticket>/`. Obtain explicit confirmation before removing anything.
3. Remove only clean linked worktrees without force. Verify each removal and retained branch. On a
   failure, stop and preserve the active ticket coordination root as resumable partial state.
4. After every removal succeeds, record the archive and move the verified ticket coordination root
   to `<hub>/.archive/<ticket>/`.
5. Never fetch, pull, push, reset, clean, force, overwrite, delete branches, or mutate source
   checkouts.
