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
   on dirty worktrees, drift, unexpected ticket-root content, or archive collisions. For declared
   `codegraph: true` indexes, verify their healthy local state; an undeclared or partial index is
    drift. Validate any workspace skill snapshot and owned copies before removing worktrees. Stop
    on pending selection edits, changed copies, unmanaged skills, or other unexpected `.claude/`
    content; preserve the verified skill files with the coordination history during the move.
2. Show every managed CodeGraph index and worktree to remove, every branch to retain, and the
   destination `<hub>/.archive/<ticket>/`. Obtain explicit confirmation before removing anything.
3. After confirmation, remove each declared local index with `codegraph uninit <worktree> --force`
   and verify the worktree is clean. Stop on failure; never delete `.codegraph/` manually.
4. Remove only clean linked worktrees without force. Verify each removal and retained branch. On a
   failure, stop and preserve the active ticket coordination root as resumable partial state.
5. After every removal succeeds, record the archive and move the verified ticket coordination root
   to `<hub>/.archive/<ticket>/`.
6. Never fetch, pull, push, reset, clean, force, overwrite, delete branches, or mutate source
   checkouts.
