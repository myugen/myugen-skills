import assert from "node:assert/strict"
import { chmod, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import test from "node:test"

const repository = fileURLToPath(new URL("../", import.meta.url))
const resolver = join(repository, "skills/knowledge-vault/scripts/resolve-vault.sh")
const workspaceReader = join(repository, "skills/knowledge-vault/scripts/resolve-workspace-memory.py")
const startHook = join(repository, "scripts/session-start.sh")
const stopHook = join(repository, "scripts/session-stop.sh")
const endHook = join(repository, "scripts/session-end.sh")

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "workspace-memory-")))
  const home = join(root, "home")
  const hub = join(root, "external-workspaces", "example")
  const ticket = join(hub, "EXAMPLE-123")
  const worktree = join(ticket, "api")
  await mkdir(join(home, ".config", "knowledge-vault"), { recursive: true })
  await mkdir(join(ticket, ".coordination"), { recursive: true })
  await mkdir(worktree, { recursive: true })
  await writeFile(join(ticket, ".coordination", "REPOSITORIES.yml"), "version: 1\nhub: example\n")
  return { root, home, hub, ticket, worktree }
}

function environment(home, extra = {}) {
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`,
    ...extra,
  }
}

function runResolver(cwd, home, extra = {}) {
  return spawnSync("bash", [resolver], {
    cwd,
    env: environment(home, extra),
    encoding: "utf8",
  })
}

async function writeHub(hub, vault = "fever") {
  await writeFile(
    join(hub, "HUB.yml"),
    `version: 1\n\nmemory:\n  - name: vault\n    type: local\n    path: ~/Documents/vaults/fever\n    skill: knowledge-vault\n    config:\n      vault: ${vault}\n\n  - name: knowledge-hub\n    type: local\n    path: ~/dev/fever/funlabs-knowledge-hub\n`,
  )
}

async function writeConfig(home, config) {
  await writeFile(
    join(home, ".config", "knowledge-vault", "config.json"),
    JSON.stringify(config),
  )
}

test("workspace vault resolves from hub, ticket, worktree, nested, hub subdirectory, and archive", async () => {
  const { home, hub, ticket, worktree } = await fixture()
  const nested = join(worktree, "src", "handlers")
  const hubDocs = join(hub, "docs", "architecture")
  const archived = join(hub, ".archive", "EXAMPLE-456")
  await mkdir(nested, { recursive: true })
  await mkdir(hubDocs, { recursive: true })
  await mkdir(join(archived, ".coordination"), { recursive: true })
  await writeFile(join(archived, ".coordination", "REPOSITORIES.yml"), "version: 1\nhub: example\n")
  await writeHub(hub)

  for (const cwd of [hub, ticket, worktree, nested, hubDocs, archived]) {
    const result = runResolver(cwd, home)
    assert.equal(result.status, 0, `${cwd}: ${result.stderr}`)
    assert.equal(result.stdout.trim(), "fever")
  }
})

test("workspace memory precedence is explicit override, hub, repository prefix, then default", async () => {
  const { home, hub, worktree } = await fixture()
  await writeHub(hub, "workspace-vault")
  await writeConfig(home, {
    defaultVault: "default-vault",
    repositories: { [worktree]: "repository-vault" },
  })

  assert.equal(runResolver(worktree, home).stdout.trim(), "workspace-vault")
  assert.equal(runResolver(worktree, home, { OBSIDIAN_VAULT: "explicit-vault" }).stdout.trim(), "explicit-vault")

  await writeFile(join(hub, "HUB.yml"), "version: 1\n")
  assert.equal(runResolver(worktree, home).stdout.trim(), "repository-vault")

  await writeConfig(home, { defaultVault: "default-vault", repositories: {} })
  assert.equal(runResolver(worktree, home).stdout.trim(), "default-vault")

  await writeFile(join(hub, "HUB.yml"), "version: 1\nmemory: []\n")
  assert.equal(runResolver(worktree, home).stdout.trim(), "default-vault")
})

test("workspace-required resolution rejects inherited and configured fallbacks without changing manual resolution", async () => {
  const { home, hub, worktree } = await fixture()
  await writeConfig(home, { defaultVault: "global-vault", repositories: { [worktree]: "mapped-vault" } })
  const env = environment(home, { OBSIDIAN_VAULT: "inherited-vault" })
  const required = () => spawnSync("bash", [resolver, "--workspace-required"], { cwd: worktree, env, encoding: "utf8" })
  await writeHub(hub, "declared-vault")
  let result = required()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "declared-vault")
  for (const text of ["version: 1\n", "memory: []\n"]) {
    await writeFile(join(hub, "HUB.yml"), text)
    result = required()
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, "")
    assert.match(result.stderr, /no workspace knowledge-vault declared/)
    assert.equal(runResolver(worktree, home, { OBSIDIAN_VAULT: "inherited-vault" }).stdout.trim(), "inherited-vault")
    assert.equal(runResolver(worktree, home, { OBSIDIAN_VAULT: "" }).stdout.trim(), "mapped-vault")
  }
})

test("canonical reader supports key order, quotes, and comments", async () => {
  const { home, hub } = await fixture()
  await writeFile(
    join(hub, "HUB.yml"),
    `# hub\nmemory: # workspace memory\n  - config:\n      vault: 'fe#ver' # quoted hash\n    skill: "knowledge-vault" # manager\n    path: "~/Documents/vaults/fever"\n    type: local\n    name: vault\n`,
  )

  const result = runResolver(hub, home)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "fe#ver")
})

test("plain hashes remain scalar content while ambiguous explicit memory fails closed", async () => {
  const { home, hub } = await fixture()
  await writeFile(
    join(hub, "HUB.yml"),
    "memory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault: fe#ver\n",
  )
  assert.equal(runResolver(hub, home).stdout.trim(), "fe#ver")

  for (const document of [
    "\"memory\": []\n",
    " memory: []\n",
    "version: 1\n  memory: []\n",
    "memory:[]\n",
    "memory:\n  - name: null\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault: fever\n",
    "memory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault: foo: bar\n",
    "memory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault: foo:\n",
    "memory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault: - foo\n",
    "memory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault: @foo\n",
    "memory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault: 'foo' 'bar'\n",
    "memory: []\n  - name: unexpected\n",
  ]) {
    await writeFile(join(hub, "HUB.yml"), document)
    const result = runResolver(hub, home)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /workspace memory is unusable/)
  }
})

test("repository-local HUB.yml does not hide the ticket workspace hub", async () => {
  const { home, hub, worktree } = await fixture()
  await writeHub(hub, "workspace-vault")
  await writeHub(worktree, "repository-vault")

  const result = runResolver(worktree, home)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "workspace-vault")
})

test("ticket marker with a missing calculated hub is malformed and never guesses an ancestor", async () => {
  const { root, home, hub, worktree } = await fixture()
  await writeHub(root, "wrong-ancestor")
  await writeConfig(home, { defaultVault: "wrong-fallback", repositories: {} })

  const result = runResolver(worktree, home)
  assert.notEqual(result.status, 0)
  assert.equal(result.stdout, "")
  assert.ok(result.stderr.includes(`missing or unreadable ${join(hub, "HUB.yml")}`))
})

test("malformed explicit memory fails closed instead of using config.json", async () => {
  const { home, hub, worktree } = await fixture()
  await writeFile(
    join(hub, "HUB.yml"),
    "version: 1\nmemory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault:\n",
  )
  await writeConfig(home, { defaultVault: "wrong-vault", repositories: {} })

  const result = runResolver(worktree, home)
  assert.notEqual(result.status, 0)
  assert.equal(result.stdout, "")
  assert.match(result.stderr, /workspace memory.*config\.vault/i)
})

test("unsupported YAML outside an absent memory block does not disable legacy fallback", async () => {
  const { home, hub, worktree } = await fixture()
  await writeFile(join(hub, "HUB.yml"), "version: 1\nsources:\n\tprimary:\n\t\troot: ~/dev/source\n")
  await writeConfig(home, { defaultVault: "legacy-vault", repositories: {} })

  const result = runResolver(worktree, home)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "legacy-vault")
})

test("non-knowledge-vault primary fails closed", async () => {
  const { home, hub, worktree } = await fixture()
  await writeFile(
    join(hub, "HUB.yml"),
    "memory:\n  - name: docs_primary\n    type: local\n    path: ~/docs\n    skill: another-skill\n    config:\n      vault: wrong\n",
  )
  await writeConfig(home, { defaultVault: "wrong-fallback", repositories: {} })

  const result = runResolver(worktree, home)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /skill must be knowledge-vault/)
})

test("reader reports absent, valid, and malformed workspace memory as JSON", async () => {
  const { home, hub } = await fixture()
  await writeFile(join(hub, "HUB.yml"), "version: 1\n")
  let result = spawnSync("python3", [workspaceReader, hub], { env: environment(home), encoding: "utf8" })
  assert.deepEqual(JSON.parse(result.stdout), { status: "absent" })

  await writeHub(hub)
  result = spawnSync("python3", [workspaceReader, hub], { env: environment(home), encoding: "utf8" })
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "valid",
    vault: "fever",
    path: "~/Documents/vaults/fever",
  })

  await writeFile(join(hub, "HUB.yml"), "memory:\n\t- name: vault\n")
  result = spawnSync("python3", [workspaceReader, hub], { env: environment(home), encoding: "utf8" })
  assert.equal(JSON.parse(result.stdout).status, "malformed")
})

async function fakeCommand(bin, name, body) {
  const path = join(bin, name)
  await writeFile(path, `#!/usr/bin/env bash\n${body}\n`)
  await chmod(path, 0o755)
}

async function dirtyRepository(worktree) {
  const init = spawnSync("git", ["init", "-q"], { cwd: worktree, encoding: "utf8" })
  assert.equal(init.status, 0, init.stderr)
  await writeFile(join(worktree, "change.txt"), "change\n")
}

async function editedTurn(root) {
  const path = join(root, "transcript.jsonl")
  const entries = [
    { type: "user", message: { content: "Edit a file" } },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "edit-1", name: "Edit", input: {} }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "edit-1", content: "success" }] } },
  ]
  await writeFile(path, entries.map(JSON.stringify).join("\n") + "\n")
  return path
}

test("Claude hooks do not nudge or write when explicit workspace memory is malformed", async () => {
  const { root, home, hub, worktree } = await fixture()
  const bin = join(root, "bin")
  const marker = join(root, "obsidian-called")
  await mkdir(bin)
  await fakeCommand(bin, "pgrep", "exit 0")
  await fakeCommand(bin, "obsidian", `touch "${marker}"; exit 0`)
  await dirtyRepository(worktree)
  await writeFile(
    join(hub, "HUB.yml"),
    "memory:\n  - name: vault\n    type: local\n    path: ~/vault\n    skill: knowledge-vault\n    config:\n      vault:\n",
  )
  await writeConfig(home, { defaultVault: "wrong-vault", repositories: {} })
  const env = environment(home, {
    PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`,
    OBSIDIAN_VAULT: "wrong-inherited-vault",
  })

  const start = spawnSync("bash", [startHook], {
    cwd: worktree,
    env,
    input: JSON.stringify({ cwd: worktree, session_id: "session-1" }),
    encoding: "utf8",
  })
  assert.equal(start.status, 0, start.stderr)
  assert.match(JSON.parse(start.stdout).hookSpecificOutput.additionalContext, /configured but unusable/)

  const stop = spawnSync("bash", [stopHook], {
    cwd: worktree,
    env,
    input: JSON.stringify({ cwd: worktree, stop_hook_active: false }),
    encoding: "utf8",
  })
  assert.equal(stop.status, 0, stop.stderr)
  assert.equal(stop.stdout, "")

  const end = spawnSync("bash", [endHook], {
    cwd: worktree,
    env,
    input: JSON.stringify({ cwd: worktree, session_id: "session-1" }),
    encoding: "utf8",
  })
  assert.equal(end.status, 0, end.stderr)
  await assert.rejects(readFile(marker, "utf8"), { code: "ENOENT" })
})

test("Stop hook uses a valid workspace knowledge-vault without config.json", async () => {
  const { root, home, hub, worktree } = await fixture()
  const bin = join(root, "bin")
  const vaultPath = join(root, "vault")
  const obsidianLog = join(root, "obsidian.log")
  const envFile = join(root, "claude-env")
  await mkdir(bin)
  await mkdir(vaultPath)
  await fakeCommand(bin, "pgrep", "exit 0")
  await fakeCommand(
    bin,
    "obsidian",
    `printf '%s\\n' "$*" >> "${obsidianLog}"
case "$*" in
  *"vault info=path"*) printf '%s\\n' "${vaultPath}" ;;
  *" search "*) printf '%s\\n' '[]' ;;
  *" create "*) printf '%s\\n' 'Created: AI/Sessions/session.md' ;;
esac`,
  )
  await dirtyRepository(worktree)
  await writeHub(hub)
  const env = environment(home, {
    PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`,
    CLAUDE_ENV_FILE: envFile,
    OBSIDIAN_VAULT: "wrong-inherited-vault",
  })

  const start = spawnSync("bash", [startHook], {
    cwd: worktree,
    env,
    input: JSON.stringify({ cwd: worktree, session_id: "session-valid" }),
    encoding: "utf8",
  })
  assert.equal(start.status, 0, start.stderr)
  assert.match(await readFile(envFile, "utf8"), /OBSIDIAN_VAULT=fever/)

  const result = spawnSync("bash", [stopHook], {
    cwd: worktree,
    env,
    input: JSON.stringify({ cwd: worktree, transcript_path: await editedTurn(root), stop_hook_active: false }),
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /Before finishing/)

  const end = spawnSync("bash", [endHook], {
    cwd: worktree,
    env,
    input: JSON.stringify({ cwd: worktree, session_id: "session-valid" }),
    encoding: "utf8",
  })
  assert.equal(end.status, 0, end.stderr)
  assert.match(await readFile(obsidianLog, "utf8"), /vault=fever create/)
})

test("existing hub without memory does not activate hooks through a fallback vault", async () => {
  const { root, home, hub, worktree } = await fixture()
  const bin = join(root, "bin")
  await mkdir(bin)
  await fakeCommand(bin, "pgrep", "exit 0")
  await dirtyRepository(worktree)
  await writeFile(join(hub, "HUB.yml"), "version: 1\n")
  await writeConfig(home, { defaultVault: "legacy-vault", repositories: {} })

  const result = spawnSync("bash", [stopHook], {
    cwd: worktree,
    env: environment(home, { PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}` }),
    input: JSON.stringify({ cwd: worktree, transcript_path: await editedTurn(root), stop_hook_active: false }),
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, "")
})

test("generated workspace instructions include memory read, degraded, write, and entry-point rules", async () => {
  const [hubInstructions, ticketInstructions, coordinationInstructions, command, plugin] =
    await Promise.all([
      readFile(join(repository, "skills/multirepo-workspaces/assets/hub/AGENTS.md"), "utf8"),
      readFile(join(repository, "skills/multirepo-workspaces/assets/AGENTS.md"), "utf8"),
      readFile(join(repository, "skills/multirepo-workspaces/assets/coordination/AGENTS.md"), "utf8"),
      readFile(join(repository, "commands/workspace/init.md"), "utf8"),
      readFile(join(repository, "opencode/plugin.js"), "utf8"),
    ])

  for (const instructions of [hubInstructions, ticketInstructions, coordinationInstructions]) {
    assert.match(instructions, /ticket, topic, and named\s+people/)
    assert.match(instructions, /read-only/)
    assert.match(instructions, /degraded operation/)
    assert.match(instructions, /At the end/)
    assert.match(instructions, /primary/)
  }
  assert.match(ticketInstructions, /OpenCode.*partial coverage/s)
  assert.match(command, /optional workspace memory/)
  assert.match(plugin, /primary knowledge-vault and read-only local memory sources/)
})
