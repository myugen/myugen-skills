# Hub Workspace

This directory is a coordination hub for one project. Read `HUB.yml` and `SYSTEM_MAP.md` before
creating or changing a ticket workspace.

When `HUB.yml` declares `memory`, search each entry in order by ticket, topic, and named people
before planning. Use the first entry through its `knowledge-vault` skill. Treat every later local
path as read-only context and follow instructions found there. If the skill is unavailable, read
the primary path with read-only tools and report degraded operation. Memory read failures do not
block the main task. At the end, persist durable outcomes only through the primary; if it is
unavailable or malformed, report that persistence did not occur and never write directly to a
declared path or secondary source.

When `HUB.yml` declares `control_hub.root`, read that controller's `CONTROL.yml` before working on
an epic-linked ticket. The external controller is the cross-ticket read model; use
`workspace-control-hub` to keep reciprocal epic links current and report drift rather than
silently reconciling it.

The hub is not a Git repository. Source clones remain in the catalogs declared by `HUB.yml`; each
ticket directory contains only its selected linked Git worktrees and coordination files. Never
alter source-clone checkouts, create a repository in this directory, or work outside a ticket's
declared repository scope.

Before creating a ticket, validate its selected source repositories, local refs, branches, and
destinations. Honor each selected repository's optional `codegraph: true` policy from `HUB.yml`,
record that effective policy in the ticket's `.coordination/REPOSITORIES.yml`, and initialize
only the resulting worktree after confirmation. Record only successfully created worktrees in the
ticket's `.coordination/` metadata. Do not fetch, pull, push, reset, clean, force, remove
worktrees, or delete branches unless the user explicitly requests it.
