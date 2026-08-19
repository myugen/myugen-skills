# Ticket Workspace

Before working, read and follow `.coordination/AGENTS.md`, then read
`.coordination/REPOSITORIES.yml`, `.coordination/PLAN.md`, and the parent hub's `AGENTS.md`.

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

Every task requires the official `show-me` skill from `humanlayer/skills`. Before editing, verify
it is available to the active agent; if it is not, stop and suggest `npx skills add
humanlayer/skills --skill show-me --global --agent <agent>`. Use `show-me` before editing to show
the intended change from the plan and current code. After implementation and validation, use it
again from the actual code and diff, identifying any deviation from that intended shape. Use the
smallest useful visual; do not create HTML or workspace artifacts unless the user asks.

Keep `.coordination/PLAN.md`, `IMPACT.md`, and `DECISIONS.md` current as implementation reveals
new scope, impact, or decisions. Do not work outside the declared repositories, alter source
clones, or perform remote, destructive, worktree-removal, or branch-deletion operations unless
the user explicitly requests them.
