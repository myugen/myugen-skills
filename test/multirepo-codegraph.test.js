import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)

async function text(path) {
  return readFile(new URL(path, root), "utf8")
}

test("documents optional per-repository CodeGraph policy in hub and ticket schemas", async () => {
  const [schema, example] = await Promise.all([
    text("skills/multirepo-workspaces/references/hub-schema.md"),
    text("skills/multirepo-workspaces/assets/HUB.yml.example"),
  ])

  assert.match(example, /criticality: critical\n      codegraph: true/)
  assert.match(schema, /\| `codegraph` \| No \| When `true`, initialize/)
  assert.match(schema, /The copied `codegraph` value is the\s+effective ticket policy/)
  assert.match(schema, /Do not persist initialization status\s+in\s+`REPOSITORIES\.yml`/)
})

test("records a worktree policy before initializing its local CodeGraph index", async () => {
  const skill = await text("skills/multirepo-workspaces/SKILL.md")
  const record = skill.indexOf("criticality, and effective `codegraph: true` policy")
  const initialize = skill.indexOf("codegraph init <absolute-worktree-path>")

  assert.ok(record >= 0)
  assert.ok(initialize > record)
  assert.match(skill, /If initialization or verification fails, stop immediately/)
  assert.match(skill, /never remove the worktree or silently continue with later repositories/)
  assert.match(skill, /An index present for a worktree without `codegraph: true` is unmanaged drift/)
})

test("uses live status for reruns and cleans only declared indexes during archive", async () => {
  const [skill, schema] = await Promise.all([
    text("skills/multirepo-workspaces/SKILL.md"),
    text("skills/multirepo-workspaces/references/hub-schema.md"),
  ])
  const status = skill.indexOf("codegraph status --json <worktree>")
  const uninit = skill.indexOf("codegraph uninit <absolute-worktree-path> --force")
  const remove = skill.indexOf("git -C <source-repository> worktree remove <worktree-path>")

  assert.ok(status >= 0)
  assert.ok(uninit >= 0)
  assert.ok(remove > uninit)
  assert.match(skill, /do\s+not silently re-run `init`, `index`, or `uninit`/)
  assert.match(skill, /do not remove\s+the worktree or delete `\.codegraph\/` manually/)
  assert.match(schema, /allow CodeGraph to install shared Git hooks: each condition is drift/)
})

test("generated workspace instructions require a healthy declared CodeGraph index", async () => {
  const [ticketAgents, ticketClaude, coordinationAgents, coordinationClaude, hubAgents] = await Promise.all([
    text("skills/multirepo-workspaces/assets/AGENTS.md"),
    text("skills/multirepo-workspaces/assets/CLAUDE.md"),
    text("skills/multirepo-workspaces/assets/coordination/AGENTS.md"),
    text("skills/multirepo-workspaces/assets/coordination/CLAUDE.md"),
    text("skills/multirepo-workspaces/assets/hub/AGENTS.md"),
  ])

  for (const instruction of [ticketAgents, ticketClaude, coordinationAgents, coordinationClaude]) {
    assert.match(instruction, /declares `codegraph: true`/)
    assert.match(instruction, /codegraph status --json\s+<worktree>/)
    assert.match(instruction, /`projectPath` to MCP tools/)
    assert.match(instruction, /absent, partial, failed, mismatched,\s+or\s+undeclared index as drift/)
  }
  assert.match(hubAgents, /optional `codegraph: true` policy from `HUB\.yml`/)
})

test("command adapters preserve CodeGraph creation and archive safeguards", async () => {
  const [newCommand, archiveCommand, openCode] = await Promise.all([
    text("commands/workspace/new.md"),
    text("commands/workspace/archive.md"),
    text("opencode/plugin.js"),
  ])

  assert.match(newCommand, /effective CodeGraph\s+policy before initializing its worktree-local index/)
  assert.match(archiveCommand, /never delete `\.codegraph\/` manually/)
  assert.match(openCode, /record the effective policy before initializing and verifying that worktree's/)
  assert.match(openCode, /codegraph uninit\n    <worktree> --force/)
})
