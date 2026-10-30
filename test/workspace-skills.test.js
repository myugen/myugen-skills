import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const helper = new URL("../skills/multirepo-workspaces/scripts/workspace-skills.py", import.meta.url).pathname

async function put(path, data) {
  await mkdir(join(path, ".."), { recursive: true })
  await writeFile(path, data)
}

async function files(path) {
  const result = {}
  for (const name of (await readdir(path)).sort()) {
    const child = join(path, name)
    const info = await lstat(child)
    result[name] = info.isSymbolicLink() ? "symlink" : info.isDirectory() ? await files(child) : [(await readFile(child)).toString("base64"), info.mode & 0o777]
  }
  return result
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "workspace-skills-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const home = join(root, "home")
  const hub = join(root, "workspaces", "vertical")
  const ticket = join(hub, "EXAMPLE-123")
  const catalog = join(root, "skill catalog")
  await mkdir(home)
  await put(join(hub, "HUB.yml"), "version: 1\nskills: []\n")
  await put(join(ticket, ".coordination/REPOSITORIES.yml"), "version: 1\nhub: vertical\nticket: EXAMPLE-123\nrepositories: []\n")
  return { root, home, hub, ticket, catalog }
}

function run(f, action, args = [], expected = 0) {
  const result = spawnSync("python3", [helper, action, ...(action === "validate" ? ["--hub", f.hub] : ["--workspace", f.ticket]), ...args], {
    encoding: "utf8", env: {
      ...process.env, HOME: f.home, XDG_CONFIG_HOME: join(f.home, ".config"),
      PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`, PYTHONDONTWRITEBYTECODE: "1",
    },
  })
  assert.equal(result.status, expected, result.stdout + result.stderr)
  assert.equal(result.stderr, "")
  return JSON.parse(result.stdout)
}

async function skill(f, name = "show-me", extra = "") {
  const path = join(f.catalog, name)
  await put(join(path, "SKILL.md"), `---\nname: ${name}\ndescription: A real local skill\n${extra}---\n# ${name}\n\nRead references/detail.md.\n`)
  await put(join(path, "references/detail.md"), "Useful details\n")
  await put(join(path, "scripts/run.sh"), "#!/bin/sh\nexit 99 # must never execute during setup\n")
  await chmod(join(path, "scripts/run.sh"), 0o755)
  await put(join(path, "assets/image.bin"), Buffer.from([0, 255, 10, 128]))
  await mkdir(join(path, "empty"))
  return { name, path, when: "Para explicar visualmente un flujo complejo." }
}

function selection(entries) {
  return "version: 1\n\n" + (entries.length ? "skills:\n" + entries.map((entry) => Object.entries(entry).map(([key, value], index) => `${index === 0 ? "  - " : "    "}${key}: ${JSON.stringify(value)}\n`).join("")).join("") : "skills: []\n")
}

async function defaults(f, entries) {
  await writeFile(join(f.hub, "HUB.yml"), selection(entries))
}

test("validation, status, and mutation previews never write or execute skill scripts", async (t) => {
  const f = await fixture(t)
  const entry = await skill(f)
  await defaults(f, [entry])
  const before = await files(f.root)
  assert.equal(run(f, "validate").status, "valid")
  assert.equal(run(f, "status").status, "legacy")
  assert.deepEqual(run(f, "init").copy, ["show-me"])
  run(f, "validate", ["--apply"], 1)
  run(f, "status", ["--apply"], 1)
  assert.deepEqual(await files(f.root), before)
})

test("creation snapshots complete local skills and criteria outside repositories", async (t) => {
  const f = await fixture(t)
  const entry = await skill(f, "show-me", "disable-model-invocation: true\n")
  await defaults(f, [entry])
  await put(join(f.ticket, "api/.git"), "gitdir: /source/worktrees/api\n")
  await put(join(f.ticket, "api/local.txt"), "Uncommitted user work\n")
  const sourceBefore = await files(f.catalog)
  const repositoryBefore = await files(join(f.ticket, "api"))
  assert.equal(run(f, "init", ["--apply"]).status, "applied")
  assert.deepEqual(await files(join(f.ticket, ".claude/skills/show-me")), await files(entry.path))
  assert.deepEqual(run(f, "status").skills, [entry])
  assert.match(await readFile(join(f.ticket, ".coordination/SKILLS.md"), "utf8"), /Para explicar visualmente/)
  assert.deepEqual(await files(f.catalog), sourceBefore)
  assert.deepEqual(await files(join(f.ticket, "api")), repositoryBefore)
})

test("hub and source changes affect future tickets only, including invalid defaults", async (t) => {
  const f = await fixture(t)
  const first = await skill(f)
  await defaults(f, [first])
  run(f, "init", ["--apply"])
  const firstSnapshot = await files(f.ticket)
  const second = await skill(f, "review-design")
  await defaults(f, [second])
  await writeFile(join(first.path, "references/detail.md"), "Changed original\n")
  assert.equal(run(f, "init", ["--apply"]).status, "unchanged")
  assert.equal(run(f, "sync", ["--apply"]).status, "unchanged")
  assert.deepEqual(await files(f.ticket), firstSnapshot)
  const ticket = join(f.hub, "EXAMPLE-456")
  await put(join(ticket, ".coordination/REPOSITORIES.yml"), "version: 1\nrepositories: []\n")
  run({ ...f, ticket }, "init", ["--apply"])
  assert.deepEqual(run({ ...f, ticket }, "status").skills, [second])
  await writeFile(join(f.hub, "HUB.yml"), "skills: invalid\n")
  await rm(first.path, { recursive: true })
  assert.deepEqual(run(f, "status").skills, [first])
  assert.equal(run(f, "init", ["--apply"]).status, "unchanged")
  assert.deepEqual(await files(f.ticket), firstSnapshot)
})

test("empty defaults and missing defaults both snapshot an empty independent selection", async (t) => {
  const f = await fixture(t)
  await writeFile(join(f.hub, "HUB.yml"), "version: 1\nrepositories:\n  required: []\n")
  run(f, "init", ["--apply"])
  assert.deepEqual(run(f, "status").skills, [])
  assert.deepEqual(await readdir(join(f.ticket, ".claude/skills")), [])
  assert.match(await readFile(join(f.ticket, ".coordination/SKILLS.md"), "utf8"), /No optional skills/)
})

test("add and remove are preview-first and independent of hub, sources, and sibling tickets", async (t) => {
  const f = await fixture(t)
  const entry = await skill(f)
  run(f, "init", ["--apply"])
  const before = await files(f.root)
  const args = ["--name", entry.name, "--path", entry.path, "--when", entry.when]
  assert.deepEqual(run(f, "add", args).copy, [entry.name])
  assert.deepEqual(await files(f.root), before)
  run(f, "add", [...args, "--apply"])
  assert.deepEqual(run(f, "status").skills, [entry])
  const hubBefore = await readFile(join(f.hub, "HUB.yml"), "utf8")
  const sourceBefore = await files(f.catalog)
  assert.deepEqual(run(f, "remove", ["--name", entry.name]).remove, [entry.name])
  assert.equal(run(f, "status").skills.length, 1)
  run(f, "remove", ["--name", entry.name, "--apply"])
  assert.deepEqual(run(f, "status").skills, [])
  assert.equal(await readFile(join(f.hub, "HUB.yml"), "utf8"), hubBefore)
  assert.deepEqual(await files(f.catalog), sourceBefore)
})

test("explicit manifest changes regenerate guidance without refreshing same-path source bytes", async (t) => {
  const f = await fixture(t)
  const entry = await skill(f)
  await defaults(f, [entry])
  run(f, "init", ["--apply"])
  const copyBefore = await files(join(f.ticket, ".claude/skills"))
  await writeFile(join(entry.path, "references/detail.md"), "Changed upstream\n")
  const updated = { ...entry, when: "Diseño: comparar # alternativas con nombres y acentos." }
  await writeFile(join(f.ticket, ".coordination/SKILLS.yml"), selection([updated]))
  assert.match(run(f, "status", [], 1).message, /selection changed/)
  const before = await files(f.root)
  assert.deepEqual(run(f, "sync").copy, [])
  assert.deepEqual(await files(f.root), before)
  run(f, "sync", ["--apply"])
  assert.deepEqual(run(f, "status").skills, [updated])
  assert.match(await readFile(join(f.ticket, ".coordination/SKILLS.md"), "utf8"), /Diseño: comparar # alternativas/)
  assert.deepEqual(await files(join(f.ticket, ".claude/skills")), copyBefore)
})

test("explicit path changes replace only an unchanged owned skill copy", async (t) => {
  const f = await fixture(t)
  const entry = await skill(f)
  await defaults(f, [entry])
  run(f, "init", ["--apply"])
  const other = { ...f, catalog: join(f.root, "other catalog") }
  const replacement = await skill(other)
  await writeFile(join(replacement.path, "references/detail.md"), "Different implementation\n")
  await writeFile(join(f.ticket, ".coordination/SKILLS.yml"), selection([replacement]))
  assert.deepEqual(run(f, "sync").copy, [entry.name])
  run(f, "sync", ["--apply"])
  assert.deepEqual(await files(join(f.ticket, ".claude/skills/show-me")), await files(replacement.path))
})

test("modified copies, extra files, and edited guidance stop changes without discarding work", async (t) => {
  for (const relative of [".claude/skills/show-me/references/detail.md", ".claude/skills/show-me/extra.txt", ".coordination/SKILLS.md"]) {
    await t.test(relative, async (t) => {
      const f = await fixture(t)
      await defaults(f, [await skill(f)])
      run(f, "init", ["--apply"])
      await put(join(f.ticket, relative), "User edits must survive\n")
      const before = await files(f.root)
      run(f, "remove", ["--name", "show-me", "--apply"], 1)
      run(f, "sync", ["--apply"], 1)
      run(f, "status", [], 1)
      assert.deepEqual(await files(f.root), before)
    })
  }
})

test("unmanaged skill collisions and snapshots without ownership are never adopted", async (t) => {
  for (const relative of [".claude/skills/show-me/SKILL.md", ".coordination/SKILLS.yml", ".coordination/SKILLS.md"]) {
    await t.test(relative, async (t) => {
      const f = await fixture(t)
      await defaults(f, [await skill(f)])
      await put(join(f.ticket, relative), "Existing user content\n")
      const before = await files(f.root)
      run(f, "init", ["--apply"], 1)
      assert.deepEqual(await files(f.root), before)
    })
  }
})

test("unsupported YAML and invalid skill definitions fail closed before writes", async (t) => {
  const invalid = [
    "skills: null\n", "skills:\n", "skills:[]\n", "skills: []\nskills: []\n", "'skills': []\n",
    " skills: []\n", "skills: []\n  - name: bad\n", "skills:\n\t- name: bad\n",
    "skills:\n  - name: bad\n    path: relative/path\n    when: Never\n",
    "skills:\n  - name: ../bad\n    path: /somewhere\n    when: Never\n",
    "skills:\n  - name: show-me\n    path: /somewhere\n    when: false\n",
    "skills:\n  - name: show-me\n    path: /somewhere\n    when: >\n      Folded text\n",
    "skills:\n  - name: show-me\n    path: /somewhere\n    agent: claude\n    when: Never\n",
    "skills:\n  - name: show-me\n    name: other\n    path: /somewhere\n    when: Never\n",
    "skills:\n  - name: show-me\n    path: /somewhere\n    when: Unquoted: mapping\n",
    "skills:\n  - name: show-me\n    path: /somewhere\n",
  ]
  for (const document of invalid) {
    await t.test(JSON.stringify(document), async (t) => {
      const f = await fixture(t)
      await writeFile(join(f.hub, "HUB.yml"), document)
      const before = await files(f.root)
      run(f, "init", ["--apply"], 1)
      assert.deepEqual(await files(f.root), before)
    })
  }
})

test("canonical fields allow reordering, home-relative paths, quotes, and comments", async (t) => {
  const f = await fixture(t)
  const entry = await skill({ ...f, catalog: join(f.home, "catalog") })
  await writeFile(join(f.hub, "HUB.yml"), "skills: # optional\n  - when: 'Compare ''before'' # after' # comment\n    path: ~/catalog/show-me\n    name: \"show-me\"\nrepositories:\n  required: []\n")
  run(f, "init", ["--apply"])
  assert.deepEqual(run(f, "status").skills, [{ name: entry.name, path: "~/catalog/show-me", when: "Compare 'before' # after" }])
})

test("missing sources, mismatched names, duplicate IDs, links, and nested Git metadata are rejected", async (t) => {
  for (const problem of ["missing", "name", "duplicate", "symlink", "git"]) {
    await t.test(problem, async (t) => {
      const f = await fixture(t)
      const entry = await skill(f)
      if (problem === "missing") entry.path += "-missing"
      if (problem === "name") await writeFile(join(entry.path, "SKILL.md"), "---\nname: other\ndescription: Mismatch\n---\n")
      if (problem === "symlink") await symlink(join(f.hub, "HUB.yml"), join(entry.path, "outside"))
      if (problem === "git") await put(join(entry.path, ".git/config"), "Nested git metadata\n")
      await defaults(f, problem === "duplicate" ? [entry, entry] : [entry])
      const before = await files(f.root)
      run(f, "init", ["--apply"], 1)
      assert.deepEqual(await files(f.root), before)
    })
  }
})

test("workspace symlinks and repository roots cannot redirect writes or removals", async (t) => {
  for (const relative of [".claude", ".coordination/skills-state.json", ".coordination/SKILLS.yml", ".coordination/SKILLS.md"]) {
    await t.test(relative, async (t) => {
      const f = await fixture(t)
      const outside = join(f.root, "outside")
      await mkdir(outside)
      await symlink(outside, join(f.ticket, relative))
      const before = await files(f.root)
      run(f, "init", ["--apply"], 1)
      assert.deepEqual(await files(f.root), before)
    })
  }
  const f = await fixture(t)
  await put(join(f.ticket, ".git"), "gitdir: /outside\n")
  assert.match(run(f, "init", ["--apply"], 1).message, /non-Git ticket root/)
})

test("all sync additions are preflighted before any owned copy is removed", async (t) => {
  const f = await fixture(t)
  await defaults(f, [await skill(f)])
  run(f, "init", ["--apply"])
  await writeFile(join(f.ticket, ".coordination/SKILLS.yml"), selection([{ name: "missing", path: join(f.catalog, "missing"), when: "Sometimes" }]))
  const before = await files(f.root)
  run(f, "sync", ["--apply"], 1)
  assert.deepEqual(await files(f.root), before)
})

test("global skills are reported, never installed, hidden, or uninstalled implicitly", async (t) => {
  const f = await fixture(t)
  const entry = await skill({ ...f, catalog: join(f.home, ".claude/skills") })
  const before = await files(join(f.home, ".claude"))
  run(f, "init", ["--apply"])
  assert.match(run(f, "status").warnings.join("\n"), /global skill show-me is outside this selection/)
  run(f, "add", ["--name", entry.name, "--path", entry.path, "--when", entry.when, "--apply"])
  assert.match(run(f, "status").warnings.join("\n"), /may shadow this workspace's copy/)
  run(f, "remove", ["--name", entry.name, "--apply"])
  assert.deepEqual(await files(join(f.home, ".claude")), before)
})

test("legacy instructions are reported and never rewritten by initialization", async (t) => {
  const f = await fixture(t)
  const legacy = "Every task requires the official `show-me` skill from `humanlayer/skills`.\n"
  await put(join(f.ticket, "AGENTS.md"), legacy)
  assert.match(run(f, "status").warnings.join("\n"), /legacy show-me requirement/)
  run(f, "init", ["--apply"])
  assert.equal(await readFile(join(f.ticket, "AGENTS.md"), "utf8"), legacy)
})

test("archive moves retain valid skill history but prohibit further mutations", async (t) => {
  const f = await fixture(t)
  await defaults(f, [await skill(f)])
  run(f, "init", ["--apply"])
  const before = await files(f.ticket)
  const archived = join(f.hub, ".archive/EXAMPLE-123")
  await mkdir(join(f.hub, ".archive"))
  await rename(f.ticket, archived)
  const archive = { ...f, ticket: archived }
  assert.equal(run(archive, "status").status, "valid")
  assert.match(run(archive, "remove", ["--name", "show-me", "--apply"], 1).message, /archived workspaces are read-only/)
  assert.deepEqual(await files(archived), before)
})

test("skill sources can resolve through a directory symlink without sharing mutable copies", async (t) => {
  const f = await fixture(t)
  const entry = await skill(f)
  const link = join(f.root, "skill-link")
  await symlink(entry.path, link)
  await defaults(f, [{ ...entry, path: link }])
  run(f, "init", ["--apply"])
  assert.deepEqual(await files(join(f.ticket, ".claude/skills/show-me")), await files(entry.path))
  assert.equal((await lstat(join(f.ticket, ".claude/skills/show-me"))).isSymbolicLink(), false)
})

test("skill operations preserve a real source clone and its dirty linked worktree", async (t) => {
  const f = await fixture(t)
  const source = join(f.root, "source-clone")
  const worktree = join(f.ticket, "api")
  await mkdir(source)
  function git(path, args) {
    const result = spawnSync("git", ["-C", path, ...args], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  }
  git(source, ["init", "--quiet"])
  await put(join(source, "app.txt"), "Initial\n")
  git(source, ["add", "app.txt"])
  git(source, ["-c", "user.name=Workspace test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Initial fixture"])
  git(source, ["worktree", "add", "--quiet", "-b", "workspace-fixture", worktree])
  await writeFile(join(source, "app.txt"), "Dirty source checkout\n")
  await writeFile(join(worktree, "app.txt"), "Dirty ticket worktree\n")
  await put(join(worktree, "untracked.txt"), "Keep me\n")
  const entry = await skill(f)
  await defaults(f, [entry])
  const sourceBefore = await files(source)
  const worktreeBefore = await files(worktree)
  run(f, "init", ["--apply"])
  run(f, "remove", ["--name", entry.name, "--apply"])
  assert.deepEqual(await files(source), sourceBefore)
  assert.deepEqual(await files(worktree), worktreeBefore)
  assert.doesNotMatch(git(worktree, ["status", "--porcelain"]), /\.claude|SKILLS/)
})

test("snapshot sync preserves unowned sibling skills and labels them accurately", async (t) => {
  const f = await fixture(t)
  const entry = await skill(f)
  await defaults(f, [entry])
  run(f, "init", ["--apply"])
  await put(join(f.ticket, ".claude/skills/user-skill/SKILL.md"), "User-owned skill\n")
  const preview = run(f, "remove", ["--name", "show-me"])
  assert.equal(preview.warnings.filter((warning) => warning.includes("unmanaged workspace skill content:")).length, 1)
  assert.match(preview.warnings.join("\n"), /user-skill/)
  run(f, "remove", ["--name", "show-me", "--apply"])
  assert.equal(await readFile(join(f.ticket, ".claude/skills/user-skill/SKILL.md"), "utf8"), "User-owned skill\n")
})
