# Ticket Workspace

Before working, read and follow `.coordination/AGENTS.md`, then read
`.coordination/REPOSITORIES.yml`, `.coordination/PLAN.md`, and the parent hub's `AGENTS.md`.

Search the parent `HUB.yml` memory stack by ticket, topic, and named people before planning when
one is declared. Use only its primary through `knowledge-vault` for persistence; later local memory
paths are read-only context. If the skill is unavailable, search the primary path read-only and
report degraded operation without blocking the task. At the end, persist durable outcomes only
through the primary, or report that persistence did not occur. Never write directly to a declared
path or fall back to a secondary source.

This protocol is guaranteed when the agent starts at the hub or ticket root. Claude Code also
loads these ancestor instructions when started in a worktree. OpenCode may stop at that
repository's own instructions, so a worktree-started OpenCode session has partial coverage in
version 1.

Treat this ticket directory as a coordination root, not as a Git repository. Each listed child
directory is an independent Git worktree with its own branch, history, tests, and repository
instructions.

Before editing, confirm the target repository is in `.coordination/REPOSITORIES.yml` and read
its local `AGENTS.md` or `CLAUDE.md` when present. Run Git and repository commands inside the
specific worktree, or target it explicitly with `git -C`; never run repository-wide Git
operations from the ticket root.

When that repository declares `codegraph: true`, first check that its local index is healthy for
the exact worktree with `codegraph status --json <worktree>`. Use its CodeGraph tools or CLI to
explore code structure and call paths; pass that worktree as `projectPath` to MCP tools. Report an
absent, partial, failed, mismatched, or
undeclared index as drift; do not initialize, rebuild, or remove it outside an explicit workspace
lifecycle operation.

Read `.coordination/SKILLS.md` and `.coordination/SKILLS.yml` when present. They describe this
workspace's optional skills and when to use them in the main session; no coordinating subagent is
required. Selection does not require using every skill on every task. Do not inherit later changes
from the hub or install missing skills globally. Report missing copies or stale guidance rather
than silently repairing them. Start the agent at this ticket root for workspace skill discovery.

Keep `.coordination/PLAN.md`, `IMPACT.md`, and `DECISIONS.md` current as implementation reveals
new scope, impact, or decisions. Do not work outside the declared repositories, alter source
clones, or perform remote, destructive, worktree-removal, or branch-deletion operations unless
the user explicitly requests them.
