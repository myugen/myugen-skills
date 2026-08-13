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

Work only in the declared worktrees for this ticket. Do not modify source clones, other ticket
workspaces, or repositories outside the declared scope. Do not initialize a Git repository in
the ticket or hub directory.

Keep `PLAN.md` status and validation current. Update `IMPACT.md` when affected flows,
interfaces, consumers, or risks change. Record meaningful decisions and open questions in
`DECISIONS.md`. If scope changes, update `REPOSITORIES.yml` and explain the reason in the
coordination documents before working in the added repository.

Do not fetch, pull, push, delete worktrees or branches, or use destructive Git commands unless
the user explicitly requests that operation.
