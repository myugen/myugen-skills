# Hub Workspace

This directory is a coordination hub for one project. Read `HUB.yml` and `SYSTEM_MAP.md` before
creating or changing a ticket workspace.

When `HUB.yml` declares `control_hub.root`, read that controller's `CONTROL.yml` before working on
an epic-linked ticket. The external controller is the cross-ticket read model; use
`workspace-control-hub` to keep reciprocal epic links current and report drift rather than
silently reconciling it.

The hub is not a Git repository. Source clones remain in the catalogs declared by `HUB.yml`; each
ticket directory contains only its selected linked Git worktrees and coordination files. Never
alter source-clone checkouts, create a repository in this directory, or work outside a ticket's
declared repository scope.

Before creating a ticket, validate its selected source repositories, local refs, branches, and
destinations. Record only successfully created worktrees in the ticket's `.coordination/`
metadata. Do not fetch, pull, push, reset, clean, force, remove worktrees, or delete branches
unless the user explicitly requests it.
