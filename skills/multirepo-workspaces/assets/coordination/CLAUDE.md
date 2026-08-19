# Ticket Workspace Instructions

This directory coordinates one ticket across independent Git worktrees.

Before changing code:

1. Read `.coordination/PLAN.md`, `.coordination/REPOSITORIES.yml`, then the parent hub's
   `HUB.yml`, `SYSTEM_MAP.md`, and `AGENTS.md`.
2. Confirm that the repository you intend to change is listed in `REPOSITORIES.yml`.
3. Read and follow the local instructions inside each included repository.
4. When `REPOSITORIES.yml` declares `control`, read the referenced epic record before working on
   the ticket. It summarizes cross-ticket dependencies and readiness; it does not replace the
   ticket plan or tracker.
5. When the selected repository declares `codegraph: true`, use `codegraph status --json
   <worktree>` to confirm a healthy index for that exact worktree before querying it. Prefer
   CodeGraph for structural exploration and call paths when it is healthy; pass that worktree as
   `projectPath` to MCP tools.

Work only in the declared worktrees for this ticket. Do not modify source clones, other ticket
workspaces, or repositories outside the declared scope. Do not initialize a Git repository in
the ticket or hub directory.

Keep `PLAN.md` status and validation current. Update `IMPACT.md` when affected flows,
interfaces, consumers, or risks change. Record meaningful decisions and open questions in
`DECISIONS.md`. If scope changes, update `REPOSITORIES.yml` and explain the reason in the
coordination documents before working in the added repository.

Do not fetch, pull, push, delete worktrees or branches, or use destructive Git commands unless
the user explicitly requests that operation.

Do not initialize, rebuild, uninitialize, or manually delete a CodeGraph index outside an
explicit workspace creation or archive operation. Report an absent, partial, failed, mismatched,
or undeclared index as drift.
