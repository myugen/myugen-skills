import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { commands } from "../opencode/plugin.js"

const root = new URL("../", import.meta.url)

function text(path) {
  return readFile(new URL(path, root), "utf8")
}

test("Claude hub skills command targets only defaults for future workspaces", async () => {
  const command = await text("commands/hub/skills.md")
  assert.match(command, /argument-hint: "\[hub-name\] \[status\|add\|remove\|edit\]"/)
  assert.match(command, /disable-model-invocation: true/)
  assert.match(command, /\*\*Manage Hub Skill Defaults\*\*/)
  assert.match(command, /Target only the hub's defaults in `HUB\.yml`/)
  assert.match(command, /`status` is read-only/)
  assert.match(command, /obtain confirmation before editing/)
  assert.match(command, /Never change existing ticket snapshots or copies/)
  assert.match(command, /\/myugen-skills:workspace:skills/)
  assert.doesNotMatch(command, /--workspace|--apply/)
})

test("Claude workspace skills command targets one ticket and redirects hub configuration", async () => {
  const command = await text("commands/workspace/skills.md")
  assert.match(command, /\*\*Manage Workspace Skills\*\*/)
  assert.match(command, /Target only one existing ticket's independent selection/)
  assert.match(command, /Never edit `HUB\.yml`/)
  assert.match(command, /\/myugen-skills:hub:skills/)
  assert.match(command, /`status` is read-only/)
  assert.match(command, /without `--apply`[\s\S]*only after confirmation/)
  assert.doesNotMatch(command, /Clarify whether the user means hub defaults|For hub defaults, collect/)
})

test("OpenCode command adapters keep hub defaults separate from ticket adjustments", () => {
  const hub = commands["hub-skills"]
  const workspace = commands["workspace-skills"]
  assert.equal(hub.agent, "build")
  assert.equal(workspace.agent, "build")
  assert.match(hub.template, /Manage Hub Skill Defaults/)
  assert.match(hub.template, /Target only defaults in HUB\.yml/)
  assert.match(hub.template, /Status is read-only/)
  assert.match(hub.template, /obtain confirmation before editing/)
  assert.match(hub.template, /Never change existing ticket snapshots/)
  assert.match(hub.template, /\/workspace-skills/)
  assert.match(workspace.template, /Manage Workspace Skills/)
  assert.match(workspace.template, /Target only one existing ticket's independent selection/)
  assert.match(workspace.template, /Never edit HUB\.yml/)
  assert.match(workspace.template, /\/hub-skills/)
})

test("portable hub workflow owns validation and preserves unrelated hub configuration", async () => {
  const skill = await text("skills/multirepo-workspaces/SKILL.md")
  const hub = skill.split("## Manage Hub Skill Defaults\n")[1].split("## Manage Workspace Skills\n")[0]
  const workspace = skill.split("## Manage Workspace Skills\n")[1].split("## Archive A Workspace\n")[0]
  assert.match(hub, /For `status`[\s\S]*read-only/)
  assert.match(hub, /`name`, local `path`, and contextual `when`/)
  assert.match(hub, /explicit confirmation before editing only `HUB\.yml`/)
  assert.match(hub, /preserving unrelated\s+fields and comments/)
  assert.match(hub, /Never initialize or\s+synchronize existing tickets/)
  assert.match(hub, /already absent entry is a no-op/)
  assert.match(hub, /CodeGraph's separate per-repository policy unchanged/)
  assert.match(workspace, /never edit `HUB\.yml` here/)
  assert.match(workspace, /Do not silently switch between these scopes/)
})

test("documentation presents the hub command first and explains both independent scopes", async () => {
  const readme = await text("README.md")
  const reference = await text("skills/multirepo-workspaces/references/workspace-skills.md")
  assert.ok(readme.indexOf("/myugen-skills:hub:skills") < readme.indexOf("/myugen-skills:workspace:skills"))
  assert.match(readme, /primary skill configuration\s+command/)
  assert.match(readme, /one existing ticket's independent selection/)
  assert.match(reference, /Use the hub command as the normal entry point/)
  assert.match(reference, /workspace\s+command is for per-ticket experiments or exceptions and never edits hub defaults/)
})
