import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { access, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join } from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"
import test from "node:test"

import plugin, { commands } from "../opencode/plugin.js"

const repository = fileURLToPath(new URL("../", import.meta.url))
let installedPackage

function packageFixture() {
  return installedPackage ??= (async () => {
    const directory = await mkdtemp(join(tmpdir(), "myugen-opencode-package-"))
    const env = { ...process.env, npm_config_cache: join(directory, "cache"), npm_config_update_notifier: "false" }
    const packed = spawnSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", directory], {
      cwd: repository, env, encoding: "utf8", timeout: 60000,
    })
    assert.equal(packed.status, 0, packed.stderr)
    const [artifact] = JSON.parse(packed.stdout)
    const consumer = join(directory, "consumer")
    await mkdir(consumer)
    await writeFile(join(consumer, "package.json"), '{"private":true}')
    const installed = spawnSync("npm", ["install", "--ignore-scripts", "--offline", "--no-audit", "--no-fund", "--no-package-lock", "--prefix", consumer, join(directory, artifact.filename)], {
      cwd: directory, env, encoding: "utf8", timeout: 60000,
    })
    assert.equal(installed.status, 0, installed.stderr)
    const require = createRequire(join(consumer, "package.json"))
    const entrypoint = require.resolve("myugen-skills")
    assert.equal(entrypoint, require.resolve("myugen-skills/opencode"))
    const { default: definition } = await import(pathToFileURL(entrypoint).href)
    return { directory, artifact, definition, packageRoot: dirname(dirname(entrypoint)) }
  })()
}

function runtime({ commandEntries = [], skillEntries = [] } = {}) {
  const commandTransforms = []
  const skillTransforms = []
  const registrations = []
  const calls = []
  function register(transforms, callback) {
    transforms.push(callback)
    const registration = { async dispose() {
      const index = transforms.indexOf(callback)
      if (index >= 0) transforms.splice(index, 1)
    } }
    registrations.push(registration)
    return registration
  }
  function replay(entries, transforms, key) {
    const values = new Map(entries.map((entry) => [entry[key], entry]))
    for (const transform of transforms) {
      const result = transform({
        get: (id) => values.get(id),
        add: (entry) => values.set(entry[key], entry),
      })
      assert.equal(result, undefined, "domain transforms must stay synchronous and replayable")
    }
    return values
  }
  const currentCommands = () => replay(commandEntries, commandTransforms, "name")
  const currentSkills = () => replay(skillEntries, skillTransforms, "id")
  const ctx = {
    command: {
      list: async () => ({ data: [...currentCommands().values()].map(({ name, description }) => ({ name, description })) }),
      transform: async (callback) => register(commandTransforms, callback),
    },
    skill: { transform: async (callback) => register(skillTransforms, callback) },
    session: {
      switchAgent: async (input) => { calls.push({ type: "agent", input }) },
      prompt: async (input) => { calls.push({ type: "prompt", input }) },
    },
  }
  return { ctx, commands: currentCommands, skills: currentSkills, calls, registrations }
}

test("exports a native V2 definition and registers all workspace commands and portable skills", async () => {
  assert.equal(plugin.id, "myugen-skills")
  assert.equal(typeof plugin.setup, "function")
  const state = runtime()
  await plugin.setup(state.ctx)
  assert.deepEqual([...state.commands().keys()].sort(), Object.keys(commands).sort())
  for (const [name, definition] of state.commands()) {
    assert.equal(definition.description, commands[name].description)
    assert.equal(typeof definition.execute, "function")
    assert.equal(definition.template, undefined, "V2 command definitions use executors, not V1 config templates")
  }
  const catalog = JSON.parse(await readFile(join(repository, "skills/index.json"), "utf8"))
  assert.deepEqual([...state.skills().keys()].sort(), catalog.skills.map((skill) => skill.name).sort())
  for (const skill of state.skills().values()) {
    assert.equal(skill.name, skill.id)
    assert.ok(isAbsolute(skill.path))
    assert.ok(skill.description.length > 20)
    assert.equal(skill.autoinvoke, true)
    assert.ok(skill.content.startsWith("# "))
    assert.doesNotMatch(skill.content, /^---\nname:/)
    await access(skill.path)
  }
})

test("preserves existing commands and skills and supports transform replay and disposal", async () => {
  const customCommand = { name: "workspace-archive", description: "My archive", execute: async () => {} }
  const customHubCommand = { name: "hub-skills", description: "My hub defaults", execute: async () => {} }
  const customSkill = { id: "knowledge-vault", name: "Local vault", content: "Local instructions", autoinvoke: false }
  const state = runtime({ commandEntries: [customCommand, customHubCommand], skillEntries: [customSkill] })
  const catalog = JSON.parse(await readFile(join(repository, "skills/index.json"), "utf8"))
  await plugin.setup(state.ctx)
  await plugin.setup(state.ctx)
  for (let replay = 0; replay < 3; replay++) {
    assert.equal(state.commands().get(customCommand.name), customCommand)
    assert.equal(state.commands().get(customHubCommand.name), customHubCommand)
    assert.equal(state.skills().get(customSkill.id), customSkill)
    assert.equal(state.commands().size, Object.keys(commands).length)
    assert.equal(state.skills().size, catalog.skills.length)
  }
  for (const registration of state.registrations) await registration.dispose()
  assert.deepEqual([...state.commands().values()], [customCommand, customHubCommand])
  assert.deepEqual([...state.skills().values()], [customSkill])
  assert.deepEqual(state.calls, [])
})

test("V2 executors preserve raw arguments, attachments and delivery without stale mention offsets", async () => {
  const state = runtime()
  await plugin.setup(state.ctx)
  const prompt = {
    text: 'funlab "GAME-1722" $& $ARGUMENTS',
    files: [{ uri: "file:///project/PLAN.md", name: "PLAN.md", mention: { start: 0, end: 6 } }],
    agents: [{ name: "reviewer", mention: { start: 7, end: 12 } }],
    skills: [{ id: "multirepo-workspaces", mention: { start: 0, end: 6 } }],
  }
  const original = structuredClone(prompt)
  for (const [name, definition] of state.commands()) {
    state.calls.length = 0
    await definition.execute({ sessionID: "ses-example", prompt, delivery: "queue" })
    assert.deepEqual(state.calls[0], { type: "agent", input: { sessionID: "ses-example", agent: commands[name].agent } })
    const { input } = state.calls[1]
    assert.equal(input.sessionID, "ses-example")
    assert.equal(input.delivery, "queue")
    assert.equal(input.text, commands[name].template.replaceAll("$ARGUMENTS", () => prompt.text))
    assert.deepEqual(input.files, [{ uri: "file:///project/PLAN.md", name: "PLAN.md" }])
    assert.deepEqual(input.agents, [{ name: "reviewer" }])
    assert.deepEqual(input.skills, [{ id: "multirepo-workspaces" }])
    assert.deepEqual(prompt, original)
  }
})

test("V2 executors accept empty arguments and do not submit after agent selection fails", async () => {
  const state = runtime()
  await plugin.setup(state.ctx)
  const definition = state.commands().get("workspace-init")
  await definition.execute({ sessionID: "ses-example", prompt: { text: "" }, delivery: "steer" })
  assert.equal(state.calls[1].input.text, commands["workspace-init"].template.replaceAll("$ARGUMENTS", ""))
  state.calls.length = 0
  state.ctx.session.switchAgent = async () => { throw new Error("Agent unavailable") }
  await assert.rejects(definition.execute({ sessionID: "ses-example", prompt: { text: "test" }, delivery: "steer" }), /Agent unavailable/)
  assert.deepEqual(state.calls, [])
})

test("installed package includes and registers complete skills without network or SDK dependencies", async () => {
  const { artifact, definition: installedPlugin, packageRoot } = await packageFixture()
  const files = new Set(artifact.files.map((file) => file.path))
  const catalog = JSON.parse(await readFile(join(repository, "skills/index.json"), "utf8"))
  for (const skill of catalog.skills) {
    for (const file of skill.files) assert.ok(files.has(`skills/${skill.name}/${file}`), `package must include ${skill.name}/${file}`)
  }
  const state = runtime()
  await installedPlugin.setup(state.ctx)
  assert.equal(state.commands().size, Object.keys(commands).length)
  for (const skill of state.skills().values()) {
    assert.ok(skill.path.startsWith(packageRoot))
    const entry = catalog.skills.find((entry) => entry.name === skill.id)
    for (const file of entry.files) await access(join(dirname(skill.path), file))
  }
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"))
  assert.equal(manifest.private, true)
  assert.deepEqual(manifest.dependencies || {}, {})
})

test("installed package loads in a real isolated OpenCode V2 server", { skip: !process.env.OPENCODE_V2_BIN }, async (t) => {
  const { directory, packageRoot } = await packageFixture()
  const project = join(directory, "v2-project")
  const home = join(directory, "v2-home")
  await mkdir(project)
  await mkdir(home)
  await writeFile(join(project, "opencode.json"), JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    plugins: [packageRoot],
    commands: { "workspace-archive": { description: "My archive override", template: "CUSTOM ARCHIVE $ARGUMENTS" } },
  }))
  const customSkill = join(project, ".opencode", "skills", "knowledge-vault")
  await mkdir(customSkill, { recursive: true })
  await writeFile(join(customSkill, "SKILL.md"), "---\nname: Local Vault\ndescription: Project-owned vault instructions\n---\nUse the project-owned vault workflow.\n")
  const source = join(directory, "workspace-skill-source")
  await mkdir(source)
  await writeFile(join(source, "SKILL.md"), "---\nname: workspace-test\ndescription: A workspace-local optional skill\n---\n# Workspace Test\nRead detail.md.\n")
  await writeFile(join(source, "detail.md"), "Supporting workspace skill file\n")
  await writeFile(join(directory, "HUB.yml"), `version: 1\nskills:\n  - name: workspace-test\n    path: ${JSON.stringify(source)}\n    when: "When evaluating workspace-local skill discovery."\n`)
  await mkdir(join(project, ".coordination"))
  await writeFile(join(project, ".coordination/REPOSITORIES.yml"), "version: 1\nrepositories: []\n")
  const prepared = spawnSync("python3", [join(packageRoot, "skills/multirepo-workspaces/scripts/workspace-skills.py"), "init", "--workspace", project, "--apply"], {
    encoding: "utf8", env: { ...process.env, HOME: home, PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`, PYTHONDONTWRITEBYTECODE: "1" },
  })
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr)
  const env = {
    PATH: process.env.PATH, HOME: home, TMPDIR: process.env.TMPDIR || tmpdir(),
    XDG_CONFIG_HOME: join(home, "config"), XDG_DATA_HOME: join(home, "data"),
    XDG_CACHE_HOME: join(home, "cache"), XDG_STATE_HOME: join(home, "state"),
    OPENCODE_DB: ":memory:", OPENCODE_PASSWORD: randomUUID(),
  }
  const server = spawn(process.env.OPENCODE_V2_BIN, ["serve", "--stdio", "--port", "0"], { cwd: project, env })
  let diagnostics = ""
  server.stderr.on("data", (chunk) => { diagnostics += chunk })
  t.after(async () => {
    if (server.exitCode !== null || server.signalCode !== null) return
    const exit = once(server, "exit")
    server.kill("SIGTERM")
    const deadline = setTimeout(() => server.kill("SIGKILL"), 5000)
    try { await exit } finally { clearTimeout(deadline) }
  })
  const url = await new Promise((resolve, reject) => {
    let output = ""
    const deadline = setTimeout(() => reject(new Error(`OpenCode startup timed out: ${diagnostics}`)), 60000)
    server.once("error", (error) => { clearTimeout(deadline); reject(error) })
    server.once("exit", () => { clearTimeout(deadline); reject(new Error(`OpenCode exited before readiness: ${diagnostics}`)) })
    server.stdout.on("data", (chunk) => {
      output += chunk
      if (!output.includes("\n")) return
      clearTimeout(deadline)
      try { resolve(JSON.parse(output.split("\n")[0]).url) } catch (error) { reject(error) }
    })
  })
  function api(method, path, data) {
    const result = spawnSync(process.env.OPENCODE_V2_BIN, ["api", "--server", url, method, path, ...(data ? ["--data", JSON.stringify(data)] : [])], {
      cwd: project, env, encoding: "utf8", timeout: 60000,
    })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
    const response = JSON.parse(result.stdout)
    return response.data ?? response
  }
  const info = api("get", "/api/info")
  const [major, minor, patch] = info.version.split(".").map(Number)
  assert.ok(major === 2 && (minor > 2 || (minor === 2 && patch >= 2)), `Integration requires an OpenCode 2.2.2+ server within V2, got ${info.version}`)
  // Prompt admission waits for location plugins. resume:false exercises that barrier without
  // running a model or tools; a one-shot registry read can precede asynchronous plugin startup.
  const session = api("post", "/api/session", { title: "Plugin integration test" })
  api("post", `/api/session/${session.id}/prompt`, { text: "Plugin readiness test only.", resume: false })
  const plugins = api("get", "/api/plugin")
  const active = plugins.find((entry) => entry.id === "myugen-skills")
  assert.ok(active, JSON.stringify(plugins))
  assert.equal(active.state.status, "active", JSON.stringify(active))
  const registeredCommands = api("get", "/api/command")
  for (const name of Object.keys(commands)) assert.ok(registeredCommands.some((entry) => entry.name === name), name)
  assert.equal(registeredCommands.find((entry) => entry.name === "workspace-archive").description, "My archive override")
  const registeredSkills = api("get", "/api/skill")
  assert.match(registeredSkills.find((entry) => entry.id === "knowledge-vault").content, /project-owned vault/)
  const workspaceSkill = registeredSkills.find((entry) => entry.id === "workspace-test")
  assert.ok(workspaceSkill, JSON.stringify(registeredSkills))
  assert.equal(workspaceSkill.path, await realpath(join(project, ".claude/skills/workspace-test/SKILL.md")))
  assert.match(workspaceSkill.content, /Read detail.md/)
  await access(join(dirname(workspaceSkill.path), "detail.md"))
  for (const id of ["multirepo-workspaces", "workspace-control-hub"]) {
    assert.ok(registeredSkills.find((entry) => entry.id === id).path.startsWith(packageRoot), id)
  }
})
