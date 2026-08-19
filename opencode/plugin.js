const SKILL_CATALOG_URL = "https://raw.githubusercontent.com/myugen/myugen-skills/main/skills/"

export const commands = Object.freeze({
  "workspace-init": Object.freeze({
    description: "Interactively initialize a complete multirepo workspace hub/project",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Create a Hub workflow as the authoritative
portable procedure. Treat $ARGUMENTS as an optional hub-name answer; ask for every missing or
ambiguous value. Validate all source clones and destinations, show the complete hub layout and
    repository inventory including optional per-repository CodeGraph policies, and obtain explicit
    confirmation before writing. Create HUB.yml, SYSTEM_MAP.md, AGENTS.md, and CLAUDE.md under
    ~/dev/workspaces/<hub>, never a Git repository. Do not overwrite, fetch, clone, or alter a
    source checkout.`,
  }),
  "workspace-new": Object.freeze({
    description: "Interactively create a ticket workspace with selected repository worktrees",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Create a Ticket Workspace workflow as the
authoritative portable procedure. Treat $ARGUMENTS as optional hub-name and ticket answers; ask
which registered repositories are involved. Validate local refs, branches, source clones, and
    destinations. For repositories configured with codegraph: true, verify the CodeGraph CLI before
    the first write; record the effective policy before initializing and verifying that worktree's
    local index. Stop and report resumable partial state if initialization fails. Never fetch, pull,
    push, reset, clean, force, overwrite existing workspace content, or mutate source checkouts.`,
  }),
  "workspace-archive": Object.freeze({
    description: "Interactively archive a ticket workspace while preserving branches and metadata",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Archive A Workspace workflow as the
authoritative portable procedure. Treat $ARGUMENTS as optional hub-name and ticket answers; ask
for missing or ambiguous values. Before the first write, validate every declared worktree against
its source repository, inspect status and detectable unpushed commits from existing local refs,
and reject dirty worktrees, drift, unexpected ticket-root content, or archive collisions. Show all
worktrees to remove, retained branches, and the archive destination, then obtain explicit
    confirmation. Remove only declared healthy local CodeGraph indexes with codegraph uninit
    <worktree> --force, verify clean worktrees, then remove linked worktrees without force and
    preserve their branches. Move the verified ticket coordination root to <hub>/.archive/<ticket>
    only after every removal succeeds. Never fetch, pull, push, reset, clean, force, overwrite,
    delete branches, or mutate source checkouts.`,
    }),
  "workspace-control-init": Object.freeze({
    description: "Interactively create an external control hub for one workspace vertical",
    agent: "build",
    template: `Follow the workspace-control-hub skill's Create A Control Hub workflow as the
authoritative portable procedure. Treat $ARGUMENTS as optional workspace-hub and control-hub
answers; ask for missing or ambiguous values. Validate both reciprocal paths and inspect existing
content, show the controller layout and path changes, then obtain explicit confirmation before
writing. Never initialize or mutate Git in the controller, and never alter source checkouts.`,
  }),
  "workspace-control-status": Object.freeze({
    description: "Report cross-workspace epic status, readiness, blockers, and stale evidence",
    agent: "build",
    template: `Follow the workspace-control-hub skill's Answer A Status Question workflow. Treat
$ARGUMENTS as optional control-hub and epic answers. Read controller and ticket coordination data,
and consult configured tracker or Git-hosting providers only in read-only mode when authorized.
Report readiness, blockers, review bottlenecks, stale observations, and drift separately. Do not
edit files, worktrees, trackers, remotes, or source checkouts while answering.`,
  }),
  "workspace-control-doctor": Object.freeze({
    description: "Read-only diagnosis of a workspace control hub or legacy epic boards",
    agent: "build",
    template: `Follow the workspace-control-hub skill's Diagnose A Controller Or Legacy Hub
workflow. Treat $ARGUMENTS as optional workspace-hub and control-hub answers. Run the doctor only
in read-only mode: it may report structural drift and migration candidates, but must never create,
edit, move, initialize, commit, fetch, or otherwise modify files, worktrees, repositories,
trackers, or remotes.`,
  }),
})

export default async function myugenSkillsPlugin() {
  return {
    config(config) {
      config.skills ??= {}
      config.skills.urls ??= []
      if (!config.skills.urls.includes(SKILL_CATALOG_URL)) {
        config.skills.urls.push(SKILL_CATALOG_URL)
      }

      config.command ??= {}
      for (const [name, command] of Object.entries(commands)) {
        config.command[name] ??= { ...command }
      }
    },
  }
}
