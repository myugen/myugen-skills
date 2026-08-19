import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)

async function text(path) {
  return readFile(new URL(path, root), "utf8")
}

test("new ticket workspace instructions require official show-me before and after every task", async () => {
  const files = await Promise.all([
    text("skills/multirepo-workspaces/assets/AGENTS.md"),
    text("skills/multirepo-workspaces/assets/CLAUDE.md"),
    text("skills/multirepo-workspaces/assets/coordination/AGENTS.md"),
    text("skills/multirepo-workspaces/assets/coordination/CLAUDE.md"),
  ])

  for (const instruction of files) {
    assert.match(instruction, /official `show-me` skill from `humanlayer\/skills`/)
    assert.match(instruction, /(?:Before editing.*show-me|show-me.*before editing)/s)
    assert.match(instruction, /After implementation and validation.*actual code and diff/s)
    assert.match(instruction, /do not create\s+HTML or workspace artifacts unless the user asks/)
    assert.match(instruction, /npx skills add\s+humanlayer\/skills --skill show-me --global\s+--agent <agent>/)
  }
})

test("workspace workflow and doctor document the external show-me dependency", async () => {
  const [workspace, doctor] = await Promise.all([
    text("skills/multirepo-workspaces/SKILL.md"),
    text("skills/workspace-control-hub/SKILL.md"),
  ])

  assert.match(workspace, /Every ticket task requires the official `show-me` skill/)
  assert.match(workspace, /actual code and diff/)
  assert.match(doctor, /official `humanlayer\/skills` `show-me` skill/)
  assert.match(doctor, /invokes `npx`/)
})
