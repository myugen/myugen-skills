import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"

async function version(path) {
  return JSON.parse(await readFile(path, "utf8")).version
}

test("keeps package and Claude plugin versions synchronized", async () => {
  const [packageVersion, pluginVersion, marketplaceVersion] = await Promise.all([
    version(new URL("../package.json", import.meta.url)),
    version(new URL("../.claude-plugin/plugin.json", import.meta.url)),
    readFile(new URL("../.claude-plugin/marketplace.json", import.meta.url), "utf8").then(
      (content) => JSON.parse(content).plugins[0].version,
    ),
  ])

  assert.equal(packageVersion, pluginVersion)
  assert.equal(packageVersion, marketplaceVersion)
})

test("keeps the generated skill catalog current", () => {
  const result = spawnSync("python3", ["scripts/generate-skill-index.py", "--check"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
})

test("CI enables installed-artifact integration with a pinned real OpenCode V2 runtime", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assert.match(workflow, /push:\s+branches: \[main\]/)
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /run: python3 scripts\/generate-skill-index\.py/)
  assert.match(workflow, /OPENCODE_VERSION: "2\.2\.2"/)
  assert.match(workflow, /@opencode\/cli@\$OPENCODE_VERSION/)
  assert.match(workflow, /OPENCODE_V2_BIN=.*>> "\$GITHUB_ENV"/)
  assert.match(workflow, /run: npm test/)
  assert.doesNotMatch(workflow, /id-token: write/)
})

test("workflows have no npm publication, GitHub releases, or publishing credentials", async () => {
  const directory = new URL("../.github/workflows/", import.meta.url)
  const workflows = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name))
  assert.ok(!workflows.includes("publish-npm.yml"))
  assert.ok(!workflows.includes("validate-release.yml"))
  for (const name of workflows) {
    const workflow = await readFile(new URL(name, directory), "utf8")
    assert.doesNotMatch(workflow, /\bnpm\s+(?:publish|login|adduser)\b|PUBLISH_NPM|id-token:\s*write|registry-url:|NODE_AUTH_TOKEN|NPM_TOKEN/, name)
    assert.doesNotMatch(workflow, /^\s*release:\s*$|\bgh\s+release\b|release_tag|RELEASE_TAG|github\.event\.release|workflow_call:/m, name)
  }
})

test("package blocks npm publication without removing Git installation metadata", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  assert.equal(manifest.private, true)
  assert.equal(manifest.publishConfig, undefined)
  assert.equal(manifest.scripts.prepublishOnly, undefined)
  assert.doesNotMatch(JSON.stringify(manifest.scripts), /\bnpm\s+publish\b/)
  assert.equal(manifest.exports["."], "./opencode/plugin.js")
  assert.equal(manifest.repository.url, "git+https://github.com/myugen/myugen-skills.git")
})
