# Ticket Workspace

Before working, read and follow `.coordination/AGENTS.md`, then read
`.coordination/REPOSITORIES.yml` and `.coordination/PLAN.md`.

Treat this ticket directory as a coordination root, not as a Git repository. Each listed child
directory is an independent Git worktree with its own branch, history, tests, and repository
instructions.

Before editing, confirm the target repository is in `.coordination/REPOSITORIES.yml` and read
its local `AGENTS.md` or `CLAUDE.md` when present. Run Git and repository commands inside the
specific worktree, or target it explicitly with `git -C`; never run repository-wide Git
operations from the ticket root.

Keep `.coordination/PLAN.md`, `IMPACT.md`, and `DECISIONS.md` current as implementation reveals
new scope, impact, or decisions. Do not work outside the declared repositories, alter source
clones, or perform remote, destructive, worktree-removal, or branch-deletion operations unless
the user explicitly requests them.
