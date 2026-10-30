import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const SKILLS_DIRECTORY = new URL("../skills/", import.meta.url)

export const commands = Object.freeze({
  "workspace-init": Object.freeze({
    description: "Interactively initialize a complete multirepo workspace hub/project",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Create a Hub workflow as the authoritative
portable procedure. Treat $ARGUMENTS as an optional hub-name answer; ask for every missing or
ambiguous value. Validate all source clones and destinations, show the complete hub layout and
    repository inventory including optional per-repository CodeGraph policies, ask whether to
    configure a primary knowledge-vault and read-only local memory sources, and obtain explicit
    confirmation before writing. Show and validate any ordered memory roles. Ask about optional
    skill defaults with name, local path, and contextual when criteria; validate real skill folders
    and default to an empty selection. Never install skills globally. Create HUB.yml,
    SYSTEM_MAP.md, AGENTS.md, and CLAUDE.md under
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
    push, reset, clean, force, overwrite existing workspace content, or mutate source checkouts.
    For a new workspace, validate and preview hub skill defaults before writing, then initialize
    its independent skill snapshot and full local copies at the ticket root before worktrees.
    Existing snapshots never inherit later hub changes. Stop on failed setup; never install
    skills globally or copy them into repositories.`,
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
    delete branches, or mutate source checkouts. Validate owned workspace skill copies before
    removing worktrees; stop on changed or unmanaged skill content and preserve verified skill
    snapshots and local copies alongside archived coordination history.`,
  }),
  "hub-skills": Object.freeze({
    description: "Configure optional hub skill defaults for future workspaces without changing existing tickets",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Manage Hub Skill Defaults workflow and its
references/workspace-skills.md. Treat $ARGUMENTS as optional hub and operation answers; ask for
missing or ambiguous values. Target only defaults in HUB.yml. Status is read-only; preview the
requested changes and obtain confirmation before editing. Never change existing ticket snapshots
or copies, install skills globally, or introduce subagent assignments. If the user means one
existing ticket, direct them to /workspace-skills instead of silently switching scope.`,
  }),
  "workspace-skills": Object.freeze({
    description: "Inspect or change one existing ticket workspace's independent optional skill selection",
    agent: "build",
    template: `Follow the multirepo-workspaces skill's Manage Workspace Skills workflow and its
references/workspace-skills.md. Treat $ARGUMENTS as optional hub, ticket, and operation answers.
Target only one existing ticket's independent selection; ask for a missing or ambiguous ticket.
Never edit HUB.yml. For defaults for future workspaces, direct the user to /hub-skills instead
of silently switching scope. Use scripts/workspace-skills.py for ticket status, init, add, remove,
and sync. Status is read-only. Preview mutations without
--apply, show copies/removals and warnings, then obtain confirmation before applying. Never
inherit changed hub defaults into existing snapshots, overwrite edited or unmanaged copies,
install globally, mutate source skill folders, or write skill files inside repositories.
Legacy instruction migration requires separate review; initialization alone does not remove old rules.`,
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

async function loadSkills() {
  const entries = await readdir(SKILLS_DIRECTORY, { withFileTypes: true })
  const skills = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const url = new URL(`${encodeURIComponent(entry.name)}/SKILL.md`, SKILLS_DIRECTORY)
    let text
    try {
      text = await readFile(url, "utf8")
    } catch (error) {
      if (error.code === "ENOENT") return undefined
      throw error
    }
    const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    const description = header?.[1].match(/^description:\s*(.+)$/m)?.[1].trim()
    if (!description || /^[>|]/.test(description)) {
      throw new Error(`${url}: expected the repository's single-line skill description`)
    }
    return {
      id: entry.name,
      name: entry.name,
      description,
      autoinvoke: true,
      path: fileURLToPath(url),
      content: text.slice(header[0].length).trim(),
    }
  }))
  return skills.filter(Boolean)
}

function expandPrompt(template, prompt) {
  const expanded = { ...prompt, text: template.replaceAll("$ARGUMENTS", () => prompt.text) }
  // Attachments survive expansion, but their offsets no longer refer to the expanded text.
  for (const field of ["files", "agents", "skills"]) {
    if (prompt[field]) expanded[field] = prompt[field].map(({ mention, ...attachment }) => attachment)
  }
  return expanded
}

// V2 accepts an id/setup definition directly; keep this small adapter dependency-free.
export default {
  id: "myugen-skills",
  async setup(ctx) {
    const [skills, availableCommands] = await Promise.all([loadSkills(), ctx.command.list()])
    // CommandEditor is add-only, so inspect existing names before installing fallbacks.
    const existingNames = new Set(availableCommands.data.map((command) => command.name))

    await ctx.skill.transform((editor) => {
      for (const skill of skills) {
        if (!editor.get(skill.id)) editor.add({ ...skill })
      }
    })

    await ctx.command.transform((editor) => {
      for (const [name, command] of Object.entries(commands)) {
        if (existingNames.has(name)) continue
        editor.add({
          name,
          description: command.description,
          async execute({ sessionID, prompt, delivery }) {
            await ctx.session.switchAgent({ sessionID, agent: command.agent })
            await ctx.session.prompt({ ...expandPrompt(command.template, prompt), sessionID, delivery })
          },
        })
      }
    })
  },
}
