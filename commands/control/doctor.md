---
description: Read-only diagnosis of a workspace control hub, legacy epic boards, and selected workspace skills.
argument-hint: "[workspace-hub] [control-hub]"
disable-model-invocation: true
---

# Diagnose A Workspace Control Hub

Follow the `workspace-control-hub` skill's **Diagnose A Controller Or Legacy Hub** workflow. Treat
`$ARGUMENTS` as optional workspace-hub and control-hub answers; ask for every missing or ambiguous
value.

Run `control-hub-doctor.py` in read-only mode. It may inspect structured controller links, a legacy
Markdown epic hub, and each ticket's independent optional skill snapshot. Report modified copies,
detectable global collisions, and legacy mandatory show-me instructions; never require an unselected
skill or suggest installing it globally. Never create, edit, move, initialize, commit, fetch,
invoke `npx`, or otherwise modify any file, worktree, repository, tracker, or remote resource.
