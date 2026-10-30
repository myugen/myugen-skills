# Ticket Workspace Instructions

This directory coordinates one ticket across independent Git worktrees.

Before changing code:

1. Read `.coordination/PLAN.md`, `.coordination/REPOSITORIES.yml`, then the parent hub's
   `HUB.yml`, `SYSTEM_MAP.md`, and `AGENTS.md`.
2. When `HUB.yml` declares memory, search every valid entry in order by ticket, topic, and named
   people. Use `knowledge-vault` for the primary and read-only file tools for later paths. If the
   skill is unavailable, search the primary path read-only and report degraded operation. Memory
   read failures do not block the main task.
3. Confirm that the repository you intend to change is listed in `REPOSITORIES.yml`.
4. Read and follow the local instructions inside each included repository.
5. When `REPOSITORIES.yml` declares `control`, read the referenced epic record before working on
   the ticket. It summarizes cross-ticket dependencies and readiness; it does not replace the
   ticket plan or tracker.
6. When the selected repository declares `codegraph: true`, use `codegraph status --json
   <worktree>` to confirm a healthy index for that exact worktree before querying it. Prefer
   CodeGraph for structural exploration and call paths when it is healthy; pass that worktree as
   `projectPath` to MCP tools.
7. Read `.coordination/SKILLS.yml` and `.coordination/SKILLS.md` when present. Use selected
   optional skills in the main session when their `when` criteria fit the task. This is an
   independent workspace snapshot, not live inheritance from `HUB.yml`. Missing skill files or
   stale guidance are drift to report, not permission to install globally or change the selection.

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

Optional skill copies live in the ticket root's `.claude/skills/`, outside all repositories.
Start the agent at that root for discovery. Selection does not require invoking each skill on
every task, and does not require a coordinating subagent. Global and repository-owned skills are
outside this selection; report collisions rather than claiming that this is a sandbox.

At the end, persist decisions or context that will outlive the ticket only through the primary
`knowledge-vault`. Keep ticket-specific state in these coordination files. If primary persistence
is unavailable, report that it did not occur; never write directly to a memory path or use a
secondary source as a fallback writer.
