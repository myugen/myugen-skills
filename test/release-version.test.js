import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function version(path) {
  return JSON.parse(await readFile(path, "utf8")).version
}

test("keeps npm and Claude plugin versions synchronized", async () => {
  const [npmVersion, pluginVersion, marketplaceVersion] = await Promise.all([
    version(new URL("../package.json", import.meta.url)),
    version(new URL("../.claude-plugin/plugin.json", import.meta.url)),
    readFile(new URL("../.claude-plugin/marketplace.json", import.meta.url), "utf8").then(
      (content) => JSON.parse(content).plugins[0].version,
    ),
  ])

  assert.equal(npmVersion, pluginVersion)
  assert.equal(npmVersion, marketplaceVersion)
})
