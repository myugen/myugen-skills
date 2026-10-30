import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)

async function text(path) {
  return readFile(new URL(path, root), "utf8")
}

test("new ticket instructions use optional snapshot criteria instead of mandatory show-me", async () => {
  for (const path of ["assets/AGENTS.md", "assets/CLAUDE.md", "assets/coordination/AGENTS.md", "assets/coordination/CLAUDE.md"]) {
    const instruction = await text(`skills/multirepo-workspaces/${path}`)
    assert.match(instruction, /SKILLS\.yml/)
    assert.match(instruction, /SKILLS\.md/)
    assert.match(instruction, /main session/)
    assert.doesNotMatch(instruction, /Every task requires|For every task, use|npx skills add|--global/)
  }
  assert.match(await text("skills/multirepo-workspaces/assets/CLAUDE.md"), /^@\.coordination\/SKILLS\.md$/m)
})

test("workflow and doctor no longer require or globally install show-me", async () => {
  const workspace = await text("skills/multirepo-workspaces/SKILL.md")
  assert.match(workspace, /show-me` has no special required status/)
  assert.match(workspace, /Manage Workspace Skills/)
  assert.match(workspace, /Retain skill\s+copies, selection, guidance, and ownership state/)
  const doctor = await text("skills/workspace-control-hub/SKILL.md")
  assert.match(doctor, /unselected `show-me` is not a missing dependency/)
  assert.doesNotMatch(workspace, /Every ticket task requires|npx skills add/)
})
