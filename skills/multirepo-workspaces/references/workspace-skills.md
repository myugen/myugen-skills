# Workspace Skills

## Defaults and independent snapshots

Optional skills belong to the ticket coordination root, never to a source clone or repository
worktree. The hub is a template for new tickets, not a live policy inherited by existing ones.

```yaml
skills:
  - name: show-me
    path: ~/dev/agent-skills/show-me
    when: "To explain complex flows visually or compare design alternatives."
```

Each entry requires exactly `name`, `path`, and `when`. There is no agent assignment: the main
session uses relevant skills without needing coordinating subagents. `when` is contextual guidance,
not an executable condition or a requirement to invoke the skill on every task. It complements the
skill's own description; it does not replace its instructions or native invocation restrictions.

- Names must be unique, lowercase kebab-case, and at most 64 characters. `synced` and
  `anthropic-skills` are reserved by Claude Code.
- Paths must be absolute or start with `~/`, and identify a real folder containing `SKILL.md` with
  a matching frontmatter `name` and a description. Existing custom skills work exactly like other
  local skills. Create their real files separately; do not embed a skill definition in this YAML.
- Criteria are non-empty single-line strings. Quote ambiguous YAML strings and values containing
  `: ` or ` #`. Use two-space list/four-space field indentation. JSON-compatible double quotes,
  YAML single quotes, comments, and any field order are supported. Block scalars, anchors, aliases,
  tags, nested fields, flow lists, and tabs are not. Write an empty selection as `skills: []`.
- A missing hub `skills` key means no optional defaults. A malformed declaration stops setup;
  it never falls back to a global skill or another source.

Creation copies both the selection and complete skill directories, including scripts, assets,
references, and executable bits. The source folders are read-only and no scripts are executed.
Nested symlinks and special files are rejected rather than following them outside the skill.
A source folder itself may resolve through a symlink, but must be separate from the ticket root.
Changing defaults or source files later does not change existing workspace copies.

## Generated layout

```text
<hub>/<ticket>/
├── AGENTS.md
├── CLAUDE.md
├── .coordination/
│   ├── REPOSITORIES.yml
│   ├── SKILLS.yml           independent selection, version: 1 and skills list
│   ├── SKILLS.md            generated contextual guidance, imported by CLAUDE.md
│   └── skills-state.json    ownership and content fingerprints
├── .claude/skills/
│   └── show-me/             full copy, not a link to mutable global content
│       └── SKILL.md
└── <repository>/            unchanged linked worktree
```

An empty selection still produces the manifest, guidance, ownership state, and an empty skill
directory. Do not pre-create these generated files by copying placeholders: let the helper write
them after the ticket's `REPOSITORIES.yml` exists. It rejects ownership-less snapshots rather than
silently adopting existing files. JSON state is internal bookkeeping, not configuration to edit.

## Commands and confirmation

Use the hub command as the normal entry point for configuration:

| Scope | Claude Code | OpenCode V2 |
|-------|-------------|-------------|
| Defaults for future workspaces | `/myugen-skills:hub:skills [hub-name] [status\|add\|remove\|edit]` | `/hub-skills` |
| One existing ticket's selection | `/myugen-skills:workspace:skills [hub-name] [ticket] [status\|init\|add\|remove\|sync]` | `/workspace-skills` |

Both adapters follow the portable skill's corresponding workflow. Hub status is read-only;
confirmed additions, removals, or edits change only the `skills` block in `HUB.yml`. The workspace
command is for per-ticket experiments or exceptions and never edits hub defaults. An ambiguous
request requires clarification, not silently switching scope or synchronizing existing tickets.
For example, configure defaults with `/myugen-skills:hub:skills example add`, then create a ticket
normally; changing those defaults later leaves that ticket's snapshot intact.

Resolve the helper next to this reference at `../scripts/workspace-skills.py`. It requires
Python 3.9+ and only its standard library. Run uncertain syntax through `--help`.

```sh
# Read-only validation before any new-ticket write.
python3 <helper> validate --hub <hub>

# Preview initial creation, then apply only after confirmation.
python3 <helper> init --workspace <ticket>
python3 <helper> init --workspace <ticket> --apply

# Read-only selection and drift checks; never execute the selected skill scripts.
python3 <helper> status --workspace <ticket>

# Preview one addition or removal, then repeat with --apply after confirmation.
python3 <helper> add --workspace <ticket> --name show-me \
  --path ~/dev/agent-skills/show-me --when "To explain a complex flow visually."
python3 <helper> remove --workspace <ticket> --name show-me

# After explicit local edits to SKILLS.yml, preview and apply their effect.
python3 <helper> sync --workspace <ticket>
```

Every command returns JSON. `validate` and `status` never write and reject `--apply`. Other
commands are previews unless `--apply` is supplied. `init` on a compatible existing workspace is
a no-op and does not reread hub defaults. `sync` never copies defaults from the hub.

`add` records all three fields, copies that skill, and regenerates guidance. `remove` removes only
the named managed copy and selection entry, preserving its source and all other skills. `sync`
applies local manifest edits. An unchanged source path preserves the existing copied bytes even
if its original folder changed or disappeared; changing a path explicitly replaces the owned copy.
To refresh from the same source, explicitly remove and add the skill after reviewing the source.

Before a change, the helper verifies all owned copies, generated guidance, new sources, and
destination collisions. User edits, missing managed copies, unsafe links, unsupported YAML, and
unmanaged name collisions stop it before writes. Generated guidance must not be edited directly;
change the manifest and run `sync`. Preview after every change in intent; a prior confirmation does
not authorize different sources or removals. An unexpected filesystem failure may leave partial
state: stop, report it, and reconcile explicitly rather than overwriting files or deleting worktrees.

## Discovery and limits

Start the agent at the ticket root. Claude Code discovers `.claude/skills/` there; OpenCode V2
supports the same directory as a compatibility source. Root instructions load the generated
guidance, because neither runtime automatically interprets `SKILLS.yml` or its `when` field.
Native manual-only invocation settings in copied skills are preserved.

Sessions started inside a repository worktree can stop discovery at that worktree's Git root.
For Claude Code, add the ticket root with `--add-dir <ticket>` or `/add-dir <ticket>` to expose its
skills, and explicitly read the ticket instructions/guidance. Adding a directory does not promise
to import its `CLAUDE.md`. For OpenCode, start or move the session to the ticket root. Do not create
per-repository skill copies or change repository settings to work around discovery.

This selection is not a sandbox or a complete allowlist for every runtime. Global, bundled, plugin,
and repository-owned skills remain independently available. In particular, Claude personal skills
can shadow a same-name local copy. The helper reports detectable filesystem global skills and
collisions; it does not inspect every managed, synced, plugin, remote catalog, or custom source.
For workspace-only optional skills, keep originals in a neutral catalog such as
`~/dev/agent-skills/`, outside global auto-discovery directories. Moving or uninstalling an existing
global installation is a separate user-approved operation, never part of workspace creation.

## Existing workspaces and archive

Missing `SKILLS.yml` and ownership state identifies a legacy ticket. Inspection does not migrate
it. On request, preview and apply `init` to snapshot today's defaults, then separately review and
update legacy adapters to read `SKILLS.md` and remove unconditional `show-me` requirements. The
helper warns about recognizable old instructions, but never overwrites them. Do not treat `init`
alone as a complete instruction migration. Existing tickets with snapshots never change when
the hub changes.

Before archiving, run `status`, verify every owned copy, and stop on pending manifest changes or
unmanaged `.claude/` content. Retain the selection, guidance, ownership state, and local copies
alongside coordination history. Paths inside ownership state are relative so a normal archive
move preserves their meaning; source paths in the manifest remain historical provenance. The
helper refuses to mutate archived tickets. Never clean a source folder or global installation
during archive. CodeGraph retains its separate per-repository lifecycle unchanged.
