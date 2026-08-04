const SKILL_CATALOG_URL = "https://raw.githubusercontent.com/myugen/myugen-skills/main/skills/"

export const commands = Object.freeze({
  "workspace-init": Object.freeze({
    description: "Interactively initialize a complete multirepo workspace hub/project",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Create a Hub workflow as the authoritative
portable procedure. Treat $ARGUMENTS as an optional hub-name answer; ask for every missing or
ambiguous value. Validate all source clones and destinations, show the complete hub layout and
repository inventory, and obtain explicit confirmation before writing. Create HUB.yml,
SYSTEM_MAP.md, AGENTS.md, and CLAUDE.md under ~/dev/workspaces/<hub>, never a Git repository.
Do not overwrite, fetch, clone, or alter a source checkout.`,
  }),
  "workspace-new": Object.freeze({
    description: "Interactively create a ticket workspace with selected repository worktrees",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Create a Ticket Workspace workflow as the
authoritative portable procedure. Treat $ARGUMENTS as optional hub-name and ticket answers; ask
which registered repositories are involved. Validate local refs, branches, source clones, and
destinations; show the complete plan and obtain explicit confirmation before creating coordination
files or worktrees. Record only successfully created worktrees and report resumable partial state.
    Never fetch, pull, push, reset, clean, force, overwrite existing workspace content, or mutate
    source checkouts.`,
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
confirmation. Remove clean linked worktrees without force, preserve their branches, and move the
verified ticket coordination root to <hub>/.archive/<ticket> only after every removal succeeds.
Never fetch, pull, push, reset, clean, force, overwrite, delete branches, or mutate source
checkouts.`,
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
