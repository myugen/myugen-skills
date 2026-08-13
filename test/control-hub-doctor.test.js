import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const doctor = new URL("../skills/workspace-control-hub/scripts/control-hub-doctor.py", import.meta.url)

function run(workspaceHub, controlHub) {
  return spawnSync("python3", [doctor.pathname, "--workspace-hub", workspaceHub, "--control-hub", controlHub], {
    encoding: "utf8",
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
