---
name: multirepo-workspaces
description: Creates, archives, and safely manages local, ticket-scoped Git worktree workspaces spanning multiple repositories without making a monorepo or changing source clones. It should be used for requests such as "create a workspace for ticket X", "set up a multirepo environment", "prepare worktrees for this vertical", "add a repository to the ticket workspace", "archive a multirepo workspace", or "close a multirepo workspace", including equivalent requests such as "crea un workspace", "monta un entorno multirepo", and "limpia el workspace".
---

# Multirepo Workspaces

Use a hub to describe the repositories that normally support one functional vertical. Create
one directory per ticket beneath that hub, with an isolated Git worktree for each repository
actually needed by the ticket. Source catalogs remain independent clones and are never
reorganized into a monorepo.

## Prerequisites

- Use a local Git installation and verify uncertain syntax against `git help worktree`.
- Treat `~/dev/workspaces` as the workspace root unless the user identifies another one.
- Before every create, inspect, change, or close operation, read the hub's `HUB.yml`, then
  `SYSTEM_MAP.md` and `AGENTS.md` when they exist.
- When `HUB.yml` declares `control_hub.root`, also read that controller's `CONTROL.yml` and use
  `workspace-control-hub` for epic registration, cross-workspace status, and reconciliation.
  Its absence is valid and preserves the standalone workspace workflow.
- Read [the hub schema](references/hub-schema.md) before creating or changing a hub, and when
  validating fields or resolving repository paths.

## Create A Hub

A hub is one project or functional vertical beneath `~/dev/workspaces/<hub>/`. It inventories
source clones and their roles; it is never itself a Git repository and does not create a worktree.

1. List existing hubs, then ask for the hub name, purpose, and system context when they were not
   supplied. Ask for source catalog roots and every repository that belongs to the project.
2. For each repository, collect its source catalog, required/optional classification, role,
   criticality, and whether its ticket worktrees require `codegraph: true`. Required means normal
   context, not automatic ticket scope. CodeGraph remains disabled when the field is absent.
3. Validate every source catalog and source clone without changing it. Read its Git status and
   confirm the resolved path is the expected repository.
4. Gather the branch convention and any durable context that belongs in `SYSTEM_MAP.md`. Do not
   invent organizational details that the user did not provide.
5. Before the first write, validate the hub name, destination containment, repository uniqueness,
   and any pre-existing hub state. Show the full file layout and repository inventory, including
   each repository's CodeGraph policy, then get explicit confirmation.
6. Optionally collect an external control-hub root. Validate that it is a user-approved location
   separate from the workspace hub; do not initialize Git there. Create it through
   `workspace-control-hub` before recording its reciprocal reference.
7. Create `HUB.yml` from `assets/HUB.yml.example` and `SYSTEM_MAP.md`, `AGENTS.md`, and
   `CLAUDE.md` from `assets/hub/`, using actual values only. Do not leave scaffold placeholders
   in live files, and never run `git init`.
8. On a compatible rerun, inspect and report the existing hub as a no-op. Resume a partial hub
   only after confirming its existing files and planned additions; stop on incompatible content
   rather than overwriting or repairing it silently.

See [the hub schema](references/hub-schema.md) for names, layout, containment, and rerun rules.

## Create A Ticket Workspace

1. Identify the hub and ticket. Resolve the hub as `~/dev/workspaces/<hub>/`; do not treat a
   source catalog as a hub. If either value is ambiguous, ask before creating anything.
2. Before acting, read `<hub>/HUB.yml`, then `<hub>/SYSTEM_MAP.md` and `<hub>/AGENTS.md` when
   they exist. Hub-local instructions and the live files are authoritative.
3. Validate every repository under consideration. Expand each source root, confirm the
   declared source path exists and is the expected Git repository, and inspect rather than
   alter it with commands such as:

   ```sh
   git -C <source-repository> rev-parse --show-toplevel
   git -C <source-repository> status --short --branch
   git -C <source-repository> worktree list --porcelain
   ```

4. Determine the effective ticket scope. Start from the hub's `required` repositories as
   normal context, remove any irrelevant to this ticket, and add needed `optional`
   repositories. `required` is not a command to create every worktree. Use `SYSTEM_MAP.md`,
   the request, and repository evidence; if scope is still uncertain, ask before creating
   unnecessary worktrees.
5. Determine the branch and local start point for each selected repository. Use only refs
   already present locally unless the user explicitly asks for a remote operation. Check
   whether each branch is already attached to another worktree.
6. Validate every selected source clone, local start point, destination, and branch attachment
   before the first write. When a selected repository declares `codegraph: true`, verify that the
   `codegraph` CLI is available and inspect `codegraph help init` and `codegraph help status`.
   Show the proposed repository, source path, worktree path, branch, role, start point, and
   CodeGraph policy, then get explicit confirmation. Do not run `codegraph install`; agent setup
   is a separate, user-managed prerequisite.
7. Inspect any existing ticket directory. For each declared `codegraph: true` worktree, inspect
   `codegraph status --json <worktree>` before any write: a healthy matching index is a no-op, an
   absent index may be initialized only after confirmation, and a partial, failed, or mismatched
   index is drift that stops the operation. An exact compatible rerun is otherwise a no-op; a
   partial ticket may be resumed after showing its actual worktrees and coordination files;
   incompatible content stops the operation. Never run `git init` in the workspace root, hub, or
   ticket directory.
8. When the hub has a control root and the ticket belongs to an epic, validate the epic's
   `EPIC.yml` and reciprocal path before the first write. Record both `control.epic` and
   `control.epic_record` in `REPOSITORIES.yml`; do not add either field when no epic is supplied.
9. Initialize the ticket's root `AGENTS.md`, `CLAUDE.md`, and `.coordination/` files before
   creating worktrees. Set `REPOSITORIES.yml` to the actual hub and ticket with an empty
   `repositories` list, not placeholders.
10. Add one worktree per selected repository. Use the source clone only as Git's worktree
   manager; do not change its checkout or files:

   ```sh
   # Existing local branch that is not attached elsewhere
   git -C <source-repository> worktree add <worktree-path> <branch>

   # New branch from a verified local ref
   git -C <source-repository> worktree add -b <branch> <worktree-path> <start-point>
   ```

   Resolve `<worktree-path>` fully under the ticket workspace because `git -C` changes the
   command's working directory to the source repository.

11. After each successful worktree, immediately record its actual path, source, branch, role,
    criticality, and effective `codegraph: true` policy in `.coordination/REPOSITORIES.yml`.
    For each enabled worktree, run:

    ```sh
    codegraph init <absolute-worktree-path>
    codegraph status --json <absolute-worktree-path>
    ```

    Confirm that the reported index belongs to that exact worktree. Never initialize the hub,
    ticket root, or source clone. If initialization or verification fails, stop immediately,
    retain the valid worktree and its truthful metadata, and report a safely resumable partial
    state; never remove the worktree or silently continue with later repositories. Initialize
    `PLAN.md`, `IMPACT.md`, and `DECISIONS.md` from known ticket context rather than inventing
    details.
12. After the coordination root and every selected worktree are verified, register the reciprocal
    workspace path in the epic with `workspace-control-hub`. If this update fails, keep the valid
    workspace and report the control-hub drift; never remove a worktree to simulate atomicity.
13. Re-run `git worktree list --porcelain` for each source and report the resulting ticket
    workspace, repositories, branches, and any safely resumable partial state.

If a requested branch is attached to another worktree, do not force or detach it. Report its
current worktree and offer safe choices: use that workspace, choose a different branch name,
or create a new branch from an agreed local ref.

## Change Or Inspect A Workspace

- Read the hub files and `.coordination/AGENTS.md`, `REPOSITORIES.yml`, and `PLAN.md` before
  changing an existing ticket workspace.
- When `REPOSITORIES.yml` declares `control`, read the referenced epic before changing ticket
  lifecycle metadata. Report an absent or mismatched reciprocal epic record as drift; do not
  silently repair it.
- Compare `REPOSITORIES.yml` with `git worktree list --porcelain` and each worktree's
  `git status --short --branch`. Report drift; do not silently repair or discard it.
- To add a repository, repeat source validation, scope confirmation, branch-conflict checks,
  worktree creation, and enabled-CodeGraph initialization, then update all affected coordination
  documents. Record its effective policy before invoking `codegraph init`.
- For an enabled worktree on a compatible rerun, use `codegraph status --json <worktree>` before
  any write. A healthy index for that exact worktree is a no-op. Offer to initialize an absent
  index only after confirmation. Report a partial, failed, or mismatched index as drift and do
  not silently re-run `init`, `index`, or `uninit`.
- An index present for a worktree without `codegraph: true` is unmanaged drift. Report it; never
  remove it automatically.
- To review a workspace, report repository status, branch, source mapping, coordination state,
  and any mismatch. Reviewing requires no fetch or checkout.
- To update code, first clarify whether the user means a local merge/rebase, a remote fetch or
  pull, or only coordination metadata. Preview affected repositories and perform only the
  explicitly requested operation.

## Archive A Workspace

Archiving closes an active ticket workspace while retaining its coordination history. It is a
destructive workflow and always requires an explicit user request. It removes only clean linked
worktrees, retains their branches, then moves the ticket's coordination root to
`<hub>/.archive/<ticket>/`.

1. Read the hub files and `<ticket>/.coordination/REPOSITORIES.yml`. Validate the active ticket
   and destination containment, and confirm that `<hub>/.archive/<ticket>/` does not already
   exist. An already compatible archive is a no-op; any source or destination collision stops the
   operation.
2. Before the first write, compare every registered repository with its source repository's
   `git worktree list --porcelain` and inspect its worktree status. For an enabled repository,
   inspect `codegraph status --json <worktree>` and treat only its declared `.codegraph/`
   directory as managed local metadata. Report uncommitted changes, untracked files, detectable
   unpushed commits from existing local refs, branch, source, worktree path, and each managed
   CodeGraph index to remove. Stop if there are changes outside managed CodeGraph metadata,
   metadata has drifted, an expected worktree is missing, an enabled index is partial or
   mismatched, or preserving work is unclear. An unmanaged `.codegraph/` directory is drift and
   stops the archive.
3. Inspect the ticket root. It may contain only the ticket adapters, `.coordination/`, and the
   declared worktree directories. Stop on unexpected files or directories rather than deleting or
   silently archiving them.
4. Show every managed CodeGraph index to remove, every worktree to remove, every branch to retain,
   the archive destination, and the archive record to create. Obtain explicit confirmation before
   removing anything.
5. After confirmation, remove each enabled worktree's local CodeGraph index without changing its
   source clone or shared Git configuration:

   ```sh
   codegraph uninit <absolute-worktree-path> --force
   ```

   Verify that `.codegraph/` is absent and that the worktree is clean. If uninitialization or the
   clean verification fails, stop and preserve the active ticket as partial state; do not remove
   the worktree or delete `.codegraph/` manually.
6. Remove each clean worktree through its source repository without `--force`:

   ```sh
   git -C <source-repository> worktree remove <worktree-path>
   ```

7. After each removal, verify that the worktree is absent from the source repository's worktree
   list and that its branch remains. If a removal fails, stop immediately. Leave the ticket's
   coordination root in place and report the actual, resumable partial state; do not archive it.
8. After every removal succeeds, create `.coordination/ARCHIVED.md` with the archive time,
   original ticket path, removed worktrees, and retained branches. Move the verified ticket root
   to `<hub>/.archive/<ticket>/`. Do not alter `REPOSITORIES.yml`; it is the historical record of
   the archived effective scope.
9. When the archived `REPOSITORIES.yml` declares `control`, update the reciprocal epic workspace
   state and path only after the move succeeds. Archive is not a claim that the ticket completed,
   merged, or changed tracker state. Report any failed control update as reconciliation drift.

## Delete A Workspace

Deleting a ticket workspace is separate from archiving and requires an explicit request. Follow
the archive safety checks first. Delete branches only with a separate explicit request and fresh
safety check. Remove an active ticket directory only when all worktrees are removed and its
remaining content is empty or independently verified safe; never treat archive metadata as
permission to delete history.

## Safety Rules

- Never create a Git repository in the workspace root, hub directory, or ticket directory.
- Never move, rename, reset, clean, or check out a source clone. Never assume it is clean;
  inspect its status and preserve all local changes.
- Never run `git reset --hard`, `git clean`, forced worktree removal, or another destructive
  command.
- Never fetch, pull, push, or otherwise change remote state without an explicit request.
- Never remove a worktree or branch without an explicit request.
- Never archive a ticket until every declared worktree has been removed and verified absent.
- Never delete a branch while archiving. Branch deletion is a separate operation requiring a
  separate explicit request and fresh safety check.
- Never force a branch already used by another worktree.
- Never touch repositories outside the ticket's declared effective scope.
- Show the repositories and branches before any ambiguous operation.
- Never overwrite a hub, ticket, coordination file, or adapter file. Report incompatible or
  partial state and require confirmation before resuming.
- Never create a symlink, copy, or nested Git repository as a substitute for a full linked
  worktree. Do not alter sparse-checkout settings unless the user explicitly asks for that.

## Resources

- `references/hub-schema.md` documents `HUB.yml`, path resolution, validation rules, and the
  distinction between hub context and effective ticket scope.
- `assets/HUB.yml.example` and `assets/hub/` are provider-neutral hub scaffolding.
- `assets/AGENTS.md` and `assets/CLAUDE.md` are ticket-root adapters that load or point agents
  to the coordination scope and plan while preserving the multi-repository boundary.
- `assets/coordination/` contains the files to copy into each ticket's `.coordination/`
  directory, including equivalent `AGENTS.md` and `CLAUDE.md` instructions.
