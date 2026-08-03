---
name: multirepo-workspaces
description: Creates and safely manages local, ticket-scoped Git worktree workspaces spanning multiple repositories without making a monorepo or changing source clones. It should be used for requests such as "create a workspace for ticket X", "set up a multirepo environment", "prepare worktrees for this vertical", "add a repository to the ticket workspace", or "close a multirepo workspace", including equivalent requests such as "crea un workspace", "monta un entorno multirepo", and "limpia el workspace".
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
- Read [the hub schema](references/hub-schema.md) before creating or changing a hub, and when
  validating fields or resolving repository paths.

## Create A Hub

A hub is one project or functional vertical beneath `~/dev/workspaces/<hub>/`. It inventories
source clones and their roles; it is never itself a Git repository and does not create a worktree.

1. List existing hubs, then ask for the hub name, purpose, and system context when they were not
   supplied. Ask for source catalog roots and every repository that belongs to the project.
2. For each repository, collect its source catalog, required/optional classification, role, and
   criticality. Required means normal context, not automatic ticket scope.
3. Validate every source catalog and source clone without changing it. Read its Git status and
   confirm the resolved path is the expected repository.
4. Gather the branch convention and any durable context that belongs in `SYSTEM_MAP.md`. Do not
   invent organizational details that the user did not provide.
5. Before the first write, validate the hub name, destination containment, repository uniqueness,
   and any pre-existing hub state. Show the full file layout and repository inventory, then get
   explicit confirmation.
6. Create `HUB.yml` from `assets/HUB.yml.example` and `SYSTEM_MAP.md`, `AGENTS.md`, and
   `CLAUDE.md` from `assets/hub/`, using actual values only. Do not leave scaffold placeholders
   in live files, and never run `git init`.
7. On a compatible rerun, inspect and report the existing hub as a no-op. Resume a partial hub
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
   before the first write. Show the proposed repository, source path, worktree path, branch,
   role, and start point, then get explicit confirmation.
7. Inspect any existing ticket directory. An exact compatible rerun is a no-op; a partial ticket
   may be resumed after showing its actual worktrees and coordination files; incompatible content
   stops the operation. Never run `git init` in the workspace root, hub, or ticket directory.
8. Initialize the ticket's root `AGENTS.md`, `CLAUDE.md`, and `.coordination/` files before
   creating worktrees. Set `REPOSITORIES.yml` to the actual hub and ticket with an empty
   `repositories` list, not placeholders.
9. Add one worktree per selected repository. Use the source clone only as Git's worktree
   manager; do not change its checkout or files:

   ```sh
   # Existing local branch that is not attached elsewhere
   git -C <source-repository> worktree add <worktree-path> <branch>

   # New branch from a verified local ref
   git -C <source-repository> worktree add -b <branch> <worktree-path> <start-point>
   ```

   Resolve `<worktree-path>` fully under the ticket workspace because `git -C` changes the
   command's working directory to the source repository.

10. After each successful worktree, immediately record its actual path, source, branch, role, and
    criticality in `.coordination/REPOSITORIES.yml`. Initialize `PLAN.md`, `IMPACT.md`, and
    `DECISIONS.md` from known ticket context rather than inventing details.
11. Re-run `git worktree list --porcelain` for each source and report the resulting ticket
    workspace, repositories, branches, and any safely resumable partial state.

If a requested branch is attached to another worktree, do not force or detach it. Report its
current worktree and offer safe choices: use that workspace, choose a different branch name,
or create a new branch from an agreed local ref.

## Change Or Inspect A Workspace

- Read the hub files and `.coordination/AGENTS.md`, `REPOSITORIES.yml`, and `PLAN.md` before
  changing an existing ticket workspace.
- Compare `REPOSITORIES.yml` with `git worktree list --porcelain` and each worktree's
  `git status --short --branch`. Report drift; do not silently repair or discard it.
- To add a repository, repeat source validation, scope confirmation, branch-conflict checks,
  and worktree creation, then update all affected coordination documents.
- To review a workspace, report repository status, branch, source mapping, coordination state,
  and any mismatch. Reviewing requires no fetch or checkout.
- To update code, first clarify whether the user means a local merge/rebase, a remote fetch or
  pull, or only coordination metadata. Preview affected repositories and perform only the
  explicitly requested operation.

## Close A Workspace

Closing is a destructive workflow and always requires an explicit user request.

1. Read `REPOSITORIES.yml`, inspect every worktree status, and compare it with the source
   repository's worktree list.
2. Report uncommitted changes, untracked files, unpushed status when it can be determined from
   existing local refs, and the branches that would remain. Stop if preserving work is unclear.
3. Show exactly which worktrees will be removed and ask for confirmation if the request did
   not already identify them unambiguously.
4. Remove clean worktrees through their source repositories without `--force`:

   ```sh
   git -C <source-repository> worktree remove <worktree-path>
   ```

5. Do not delete branches as part of worktree removal. Branch deletion is a separate action
   that needs an explicit request and a fresh safety check. Remove leftover ticket and
   coordination directories only when the user explicitly requested the whole workspace be
   deleted and they are empty or verified safe.

## Safety Rules

- Never create a Git repository in the workspace root, hub directory, or ticket directory.
- Never move, rename, reset, clean, or check out a source clone. Never assume it is clean;
  inspect its status and preserve all local changes.
- Never run `git reset --hard`, `git clean`, forced worktree removal, or another destructive
  command.
- Never fetch, pull, push, or otherwise change remote state without an explicit request.
- Never remove a worktree or branch without an explicit request.
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
