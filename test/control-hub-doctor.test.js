import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const doctor = new URL("../skills/workspace-control-hub/scripts/control-hub-doctor.py", import.meta.url)

function run(workspaceHub, controlHub, environment = {}) {
  return spawnSync("python3", [doctor.pathname, "--workspace-hub", workspaceHub, "--control-hub", controlHub], {
    encoding: "utf8",
    env: { ...process.env, PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`, ...environment },
  })
}

test("diagnoses a legacy board without changing it", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-doctor-"))
  const workspaceHub = join(root, "workspaces", "example")
  const controlHub = join(root, "knowledge")
  const plan = join(workspaceHub, "EXAMPLE-456", ".coordination", "PLAN.md")
  const board = join(controlHub, "epics", "EXAMPLE-123", "EPIC.md")

  await mkdir(join(workspaceHub, "EXAMPLE-456", ".coordination"), { recursive: true })
  await mkdir(join(controlHub, "epics", "EXAMPLE-123"), { recursive: true })
  await writeFile(join(workspaceHub, "HUB.yml"), "version: 1\n")
  await writeFile(plan, `# Ticket Plan\n\nTablero de épica: ${board}\n`)
  const legacyBoard = "# EXAMPLE-123\n\n| Ticket |\n|---|\n| EXAMPLE-456 |\n"
  await writeFile(board, legacyBoard)

  const result = run(workspaceHub, controlHub)

  assert.equal(result.status, 0)
  assert.match(result.stdout, /WARN: workspace hub has no control_hub.root/)
  assert.match(result.stdout, /INFO: EXAMPLE-123: legacy board is a migration candidate/)
  assert.equal(await (await import("node:fs/promises")).readFile(board, "utf8"), legacyBoard)
})

test("does not treat plan and decision references as ticket workspaces", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-doctor-"))
  const workspaceHub = join(root, "workspaces", "example")
  const controlHub = join(root, "knowledge")
  const board = join(controlHub, "epics", "EXAMPLE-123", "EPIC.md")

  await mkdir(workspaceHub, { recursive: true })
  await mkdir(join(controlHub, "epics", "EXAMPLE-123"), { recursive: true })
  await writeFile(join(workspaceHub, "HUB.yml"), "version: 1\n")
  await writeFile(board, "# EXAMPLE-123\n\nPLAN-0001 DEC-0002\n")

  const result = run(workspaceHub, controlHub)

  assert.equal(result.status, 0)
  assert.doesNotMatch(result.stdout, /PLAN-0001|DEC-0002: board references/)
})

test("uses legacy control-table rows instead of narrative ticket references", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-doctor-"))
  const workspaceHub = join(root, "workspaces", "example")
  const controlHub = join(root, "knowledge")
  const board = join(controlHub, "epics", "EXAMPLE-123", "EPIC.md")

  await mkdir(join(workspaceHub, "EXAMPLE-456"), { recursive: true })
  await mkdir(join(controlHub, "epics", "EXAMPLE-123"), { recursive: true })
  await writeFile(join(workspaceHub, "HUB.yml"), "version: 1\n")
  await writeFile(
    board,
    "# EXAMPLE-123\n\nEXAMPLE-999 is an external dependency.\n\n| Ticket |\n|---|\n| EXAMPLE-456 |\n",
  )

  const result = run(workspaceHub, controlHub)

  assert.equal(result.status, 0)
  assert.doesNotMatch(result.stdout, /EXAMPLE-999: board references/)
})

test("reports a ticket link missing from a structured epic", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-doctor-"))
  const workspaceHub = join(root, "workspaces", "example")
  const controlHub = join(root, "knowledge")
  const ticket = join(workspaceHub, "EXAMPLE-456", ".coordination")
  const record = join(controlHub, "epics", "EXAMPLE-123", "EPIC.yml")

  await mkdir(ticket, { recursive: true })
  await mkdir(join(controlHub, "epics", "EXAMPLE-123"), { recursive: true })
  await writeFile(join(workspaceHub, "HUB.yml"), `control_hub:\n  root: ${controlHub}\n`)
  await writeFile(join(controlHub, "CONTROL.yml"), `workspace_hub: ${workspaceHub}\n`)
  await writeFile(record, "epic:\n  key: EXAMPLE-123\nitems: []\n")
  await writeFile(
    join(ticket, "REPOSITORIES.yml"),
    `control:\n  epic: EXAMPLE-123\n  epic_record: ${record}\n`,
  )

  const result = run(workspaceHub, controlHub)

  assert.equal(result.status, 1)
  assert.match(result.stdout, /ERROR: EXAMPLE-456: linked epic EXAMPLE-123 does not list the ticket/)
})

test("reports mismatched reciprocal structured paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-doctor-"))
  const workspaceHub = join(root, "workspaces", "example")
  const controlHub = join(root, "knowledge")

  await mkdir(workspaceHub, { recursive: true })
  await mkdir(controlHub, { recursive: true })
  await writeFile(join(workspaceHub, "HUB.yml"), "control_hub:\n  root: ~/wrong-control-hub\n")
  await writeFile(join(controlHub, "CONTROL.yml"), "schema_version: 1\nworkspace_hub: ~/wrong-workspace-hub\n")

  const result = run(workspaceHub, controlHub)

  assert.equal(result.status, 1)
  assert.match(result.stdout, /ERROR: HUB.yml control_hub.root does not match/)
  assert.match(result.stdout, /ERROR: CONTROL.yml workspace_hub does not match/)
})

test("does not require show-me or suggest global installation for an empty selection", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-doctor-"))
  const workspaceHub = join(root, "workspaces", "example")
  const controlHub = join(root, "knowledge")
  const home = join(root, "home")

  await mkdir(join(home, ".claude", "skills", "show-me"), { recursive: true })
  await mkdir(join(home, ".agents"), { recursive: true })
  await mkdir(workspaceHub, { recursive: true })
  await mkdir(controlHub, { recursive: true })
  await writeFile(join(workspaceHub, "HUB.yml"), "version: 1\n")
  await writeFile(join(home, ".claude", "skills", "show-me", "SKILL.md"), "---\nname: show-me\ndescription: Visualize code\n---\n")
  await writeFile(
    join(home, ".agents", ".skill-lock.json"),
    JSON.stringify({ version: 3, skills: { "show-me": { source: "humanlayer/skills" } } }),
  )

  const result = run(workspaceHub, controlHub, { HOME: home, XDG_STATE_HOME: join(home, ".state") })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /hub skill defaults: 0/)
  assert.doesNotMatch(result.stdout, /install show-me|npx|missing for|official humanlayer/)
})

test("diagnoses global skill leakage without migrating a legacy workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-doctor-"))
  const workspaceHub = join(root, "workspaces", "example")
  const controlHub = join(root, "knowledge")
  const home = join(root, "home")

  await mkdir(join(home, ".config", "opencode", "skills", "show-me"), { recursive: true })
  await mkdir(workspaceHub, { recursive: true })
  await mkdir(controlHub, { recursive: true })
  await writeFile(join(workspaceHub, "HUB.yml"), "version: 1\n")
  const ticket = join(workspaceHub, "EXAMPLE-123")
  await mkdir(join(ticket, ".coordination"), { recursive: true })
  await writeFile(join(ticket, ".coordination/REPOSITORIES.yml"), "version: 1\nrepositories: []\n")
  await writeFile(join(home, ".config", "opencode", "skills", "show-me", "SKILL.md"), "---\nname: show-me\ndescription: Visualize code\n---\n")

  const result = run(workspaceHub, controlHub, { HOME: home, XDG_STATE_HOME: join(home, ".state") })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /EXAMPLE-123: no workspace skill snapshot \(legacy; not migrated\)/)
  assert.match(result.stdout, /global skill show-me is outside this selection/)
  assert.doesNotMatch(result.stdout, /npx|--global/)
  assert.deepEqual(await readdir(join(ticket, ".coordination")), ["REPOSITORIES.yml"])
})

test("verifies only the ticket snapshot and reports copy drift without writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "control-hub-skills-"))
  const workspaceHub = join(root, "hub")
  const controlHub = join(root, "controller")
  const ticket = join(workspaceHub, "EXAMPLE-123")
  const home = join(root, "home")
  const source = join(root, "catalog", "review-design")
  await mkdir(join(ticket, ".coordination"), { recursive: true })
  await mkdir(controlHub)
  await mkdir(home)
  await mkdir(source, { recursive: true })
  await writeFile(join(source, "SKILL.md"), "---\nname: review-design\ndescription: Review design alternatives\n---\n# Review\n")
  await writeFile(join(workspaceHub, "HUB.yml"), `version: 1\nskills:\n  - name: review-design\n    path: ${JSON.stringify(source)}\n    when: "When comparing alternatives."\n`)
  await writeFile(join(ticket, ".coordination/REPOSITORIES.yml"), "version: 1\nrepositories: []\n")
  const helper = new URL("../skills/multirepo-workspaces/scripts/workspace-skills.py", import.meta.url)
  const initialized = spawnSync("python3", [helper.pathname, "init", "--workspace", ticket, "--apply"], {
    encoding: "utf8", env: { ...process.env, HOME: home, PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}` },
  })
  assert.equal(initialized.status, 0, initialized.stdout + initialized.stderr)
  // Invalid future defaults must not become the ticket's effective selection.
  await writeFile(join(workspaceHub, "HUB.yml"), "skills: invalid\n")
  const snapshot = await readFile(join(ticket, ".coordination/SKILLS.yml"), "utf8")
  const result = run(workspaceHub, controlHub, { HOME: home })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /new-workspace skill defaults invalid/)
  assert.match(result.stdout, /EXAMPLE-123: 1 selected workspace skills verified/)
  const copy = join(ticket, ".claude/skills/review-design/SKILL.md")
  await writeFile(copy, "Manual edits\n")
  const drift = run(workspaceHub, controlHub, { HOME: home })
  assert.equal(drift.status, 1, drift.stdout + drift.stderr)
  assert.match(drift.stdout, /workspace skills drift: managed skill review-design has changed/)
  assert.equal(await readFile(copy, "utf8"), "Manual edits\n")
  assert.equal(await readFile(join(ticket, ".coordination/SKILLS.yml"), "utf8"), snapshot)
  const scripts = new URL("../skills/multirepo-workspaces/scripts/", import.meta.url)
  assert.ok(!(await readdir(scripts)).includes("__pycache__"), "read-only diagnosis must not create bytecode files")
})
