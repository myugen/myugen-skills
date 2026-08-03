import assert from "node:assert/strict"
import test from "node:test"

import myugenSkillsPlugin, { commands } from "../opencode/plugin.js"

const catalogUrl = "https://raw.githubusercontent.com/myugen/myugen-skills/main/skills/"

async function configure(config) {
  const plugin = await myugenSkillsPlugin()
  plugin.config(config)
}

test("registers workspace commands and the skills catalog", async () => {
  const config = {}

  await configure(config)

  assert.deepEqual(config.skills.urls, [catalogUrl])
  assert.deepEqual(config.command["workspace-init"], commands["workspace-init"])
  assert.deepEqual(config.command["workspace-new"], commands["workspace-new"])
})

test("preserves existing configuration and is idempotent", async () => {
  const customCommand = { description: "Custom workspace command", template: "Do custom work" }
  const config = {
    skills: { urls: ["https://example.com/skills/", catalogUrl] },
    command: { "workspace-new": customCommand },
  }

  await configure(config)
  await configure(config)

  assert.deepEqual(config.skills.urls, ["https://example.com/skills/", catalogUrl])
  assert.equal(config.command["workspace-new"], customCommand)
  assert.deepEqual(config.command["workspace-init"], commands["workspace-init"])
})
