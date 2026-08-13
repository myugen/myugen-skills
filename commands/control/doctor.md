---
description: Read-only diagnosis of a workspace control hub or legacy Markdown epic boards.
argument-hint: "[workspace-hub] [control-hub]"
disable-model-invocation: true
---

# Diagnose A Workspace Control Hub

Follow the `workspace-control-hub` skill's **Diagnose A Controller Or Legacy Hub** workflow. Treat
`$ARGUMENTS` as optional workspace-hub and control-hub answers; ask for every missing or ambiguous
value.

Run `control-hub-doctor.py` in read-only mode. It may inspect structured controller links or a
legacy Markdown epic hub and report migration candidates, but it must never create, edit, move,
initialize, commit, fetch, or otherwise modify any file, worktree, repository, tracker, or remote
resource.
