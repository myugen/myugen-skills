import assert from "node:assert/strict"
import test from "node:test"

import myugenSkillsPlugin, { commands } from "../opencode/plugin.js"

const catalogUrl = "https://raw.githubusercontent.com/myugen/myugen-skills/main/skills/"

async function configure(config) {
  const plugin = await myugenSkillsPlugin()
  plugin.config(config)
}

test("registers workspace and control commands with the skills catalog", async () => {
  const config = {}

  await configure(config)

  assert.deepEqual(config.skills.urls, [catalogUrl])
  assert.deepEqual(config.command["workspace-init"], commands["workspace-init"])
  assert.deepEqual(config.command["workspace-new"], commands["workspace-new"])
  assert.deepEqual(config.command["workspace-archive"], commands["workspace-archive"])
  assert.deepEqual(config.command["workspace-control-init"], commands["workspace-control-init"])
  assert.deepEqual(config.command["workspace-control-status"], commands["workspace-control-status"])
  assert.deepEqual(config.command["workspace-control-doctor"], commands["workspace-control-doctor"])
})

test("preserves existing configuration and is idempotent", async () => {
  const customCommand = { description: "Custom workspace command", template: "Do custom work" }
  const config = {
    skills: { urls: ["https://example.com/skills/", catalogUrl] },
    command: { "workspace-archive": customCommand },
  }

  await configure(config)
  await configure(config)

  assert.deepEqual(config.skills.urls, ["https://example.com/skills/", catalogUrl])
  assert.equal(config.command["workspace-archive"], customCommand)
  assert.deepEqual(config.command["workspace-init"], commands["workspace-init"])
  assert.deepEqual(config.command["workspace-new"], commands["workspace-new"])
  assert.deepEqual(config.command["workspace-control-doctor"], commands["workspace-control-doctor"])
})
