import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
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

test("keeps the generated skill catalog current", () => {
  const result = spawnSync("python3", ["scripts/generate-skill-index.py", "--check"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
})

test("CI enables installed-artifact integration with a pinned real OpenCode V2 runtime", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /workflow_call:/)
  assert.match(workflow, /OPENCODE_VERSION: "2\.2\.2"/)
  assert.match(workflow, /@opencode\/cli@\$OPENCODE_VERSION/)
  assert.match(workflow, /OPENCODE_V2_BIN=.*>> "\$GITHUB_ENV"/)
  assert.match(workflow, /run: npm test/)
  assert.doesNotMatch(workflow, /id-token: write/)
})

test("releases validate the committed catalog and tag before optional publication", async () => {
  const ci = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  const release = await readFile(new URL("../.github/workflows/publish-npm.yml", import.meta.url), "utf8")
  assert.match(ci, /if: \$\{\{ !inputs\.release_tag \}\}\s+run: python3 scripts\/generate-skill-index\.py\n/)
  assert.match(ci, /if: \$\{\{ inputs\.release_tag != '' \}\}\s+run: python3 scripts\/generate-skill-index\.py --check/)
  assert.match(ci, /process\.env\.RELEASE_TAG !== `v\$\{version\}`/)
  assert.match(release, /uses: \.\/\.github\/workflows\/ci\.yml/)
  assert.match(release, /release_tag: \$\{\{ github\.event\.release\.tag_name \}\}/)
  assert.match(release, /needs: validate/)
  assert.match(release, /vars\.PUBLISH_NPM == 'true'/)
  assert.match(release, /ref: \$\{\{ github\.sha \}\}/)
})

test("only the opt-in publishing job receives OIDC write access", async () => {
  const workflow = await readFile(new URL("../.github/workflows/publish-npm.yml", import.meta.url), "utf8")
  const [validation, publishing] = workflow.split("\n  publish:\n")
  assert.doesNotMatch(validation, /id-token: write/)
  assert.match(publishing, /permissions:\s+contents: read\s+id-token: write/)
  assert.match(publishing, /run: npm publish --provenance/)
})
