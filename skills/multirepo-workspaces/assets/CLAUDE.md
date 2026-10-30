# Claude Code Ticket Workspace

@.coordination/AGENTS.md
@.coordination/REPOSITORIES.yml
@.coordination/PLAN.md
@.coordination/SKILLS.md

Treat this ticket directory as a coordination root, not as a Git repository. Each listed child
directory is an independent Git worktree with its own branch, history, tests, and repository
instructions.

Before editing, confirm the target repository is in `.coordination/REPOSITORIES.yml` and read
its local `CLAUDE.md` or `AGENTS.md` when present. Run Git and repository commands inside the
specific worktree, or target it explicitly with `git -C`; never run repository-wide Git
operations from the ticket root.

When that repository declares `codegraph: true`, first check that its local index is healthy for
the exact worktree with `codegraph status --json <worktree>`. Use its CodeGraph tools or CLI to
explore code structure and call paths; pass that worktree as `projectPath` to MCP tools. Report an
absent, partial, failed, mismatched, or
undeclared index as drift; do not initialize, rebuild, or remove it outside an explicit workspace
lifecycle operation.

Read `.coordination/SKILLS.yml` for the workspace's independent optional skill selection. The
imported `.coordination/SKILLS.md` supplies its contextual usage criteria to the main session;
no coordinating subagent is required. Claude discovers the copied skills in this ticket root's
`.claude/skills/`. Use them when relevant, not automatically on every task. Do not inherit later
hub changes or install skills globally. Start Claude here; for a session started inside a worktree,
add this ticket root with `--add-dir` or `/add-dir` to load its skills without changing repositories.

Keep `.coordination/PLAN.md`, `IMPACT.md`, and `DECISIONS.md` current as implementation reveals
new scope, impact, or decisions. Do not work outside the declared repositories, alter source
clones, or perform remote, destructive, worktree-removal, or branch-deletion operations unless
the user explicitly requests them.
