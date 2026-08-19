# myugen-skills

A personal hub of **skills** for working with and inside organizations — capturing
knowledge, planning, deciding, and keeping the context that makes work over time coherent.

Skills here follow the portable [`SKILL.md`](https://code.claude.com/docs/en/skills) format:
each skill is a self-contained directory with a `SKILL.md` entry point plus any supporting
`references/`, `assets/`, or `scripts/`. That format is readable by **any AI agent** that
supports it (Claude Code, and others) and, just as importantly, by **humans** — a `SKILL.md`
is a plain, structured description of how to do something well. Nothing here is tied to a
single tool.

The repo also doubles as a **Claude Code plugin** (`.claude-plugin/plugin.json`), so Claude
Code users can install every skill in one step instead of symlinking each one by hand.

## Skills

| Skill | What it does |
|-------|--------------|
| [`conventional-commits`](./skills/conventional-commits) | Create focused, safe Git commits using the Conventional Commits 1.0.0 format, including change review, explicit staging, message composition, and post-commit verification. |
| [`knowledge-vault`](./skills/knowledge-vault) | Manage an Obsidian vault (via the `obsidian` CLI) as shared long-term memory for agents and humans — plans, decisions, session notes, and foundational knowledge about people, teams, and projects. |
| [`multirepo-workspaces`](./skills/multirepo-workspaces) | Initialize project hubs and safely manage ticket-scoped Git worktree workspaces across multiple repositories, using hub metadata and coordination artifacts without converting source clones into a monorepo. |
| [`workspace-control-hub`](./skills/workspace-control-hub) | Create and query an external, per-vertical control hub that connects epics, parallel ticket workspaces, dependencies, readiness, and delivery evidence without replacing their authoritative systems. |

_New skills get added here as the hub grows — see [Adding a skill](#adding-a-skill)._

## Using these skills

The skills under `skills/` are the source of truth in this repo. How they get picked up
depends on who's using them:

- **Humans** — just read the `SKILL.md` (and its `references/`). It's written to be followed
  directly.
- **Claude Code** — install the whole repo as a plugin:

  ```
  /plugin marketplace add myugen/myugen-skills
  /plugin install myugen-skills@myugen-skills
  ```

  Skills are then available namespaced as `/myugen-skills:knowledge-vault`, etc., and stay in
  sync with this repo — no manual copying or symlinking.

- **Other agents** — point the agent at a skill however it loads skills. For agents that
  discover skills from a flat directory (rather than a plugin format), symlink the individual
  skill so edits here take effect immediately:

  ```sh
  # clone wherever you like, then set REPO to that path
  git clone git@github.com:myugen/myugen-skills.git myugen-skills
  REPO=$(pwd)/myugen-skills

  ln -s "$REPO"/skills/knowledge-vault ~/.claude/skills/knowledge-vault
  ```

  To link every skill at once into that directory:

  ```sh
  for dir in "$REPO"/skills/*/; do
    name=$(basename "$dir")
    [ -f "$dir/SKILL.md" ] && ln -sfn "$dir" ~/.claude/skills/"$name"
  done
  ```

### OpenCode

Install the complete OpenCode integration with the npm plugin:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["myugen-skills"]
}
```

The plugin adds this repository's public skill catalog and the `/workspace-init`, `/workspace-new`,
`/workspace-archive`, `/workspace-control-init`, `/workspace-control-status`, and
`/workspace-control-doctor` commands without replacing an existing command or skill URL. Restart
OpenCode after adding the plugin; the commands then appear in its slash-command menu. `opencode
debug config` confirms that the plugin is registered.

For skills without the command adapters, OpenCode can instead load the public generated catalog
directly from this repository:

```jsonc
{
  "skills": {
    "urls": [
      "https://raw.githubusercontent.com/myugen/myugen-skills/main/skills/"
    ]
  }
}
```

Add this to `~/.config/opencode/opencode.jsonc`, then restart OpenCode and verify discovery
with `opencode debug skill`. `skills/index.json` is generated from the skill directories and
updated automatically after changes under `skills/` merge into `main`.

#### Publishing the OpenCode plugin

The first public npm release must be published manually, then npm trusted publishing can take
over. From the matching release commit, run `npm login`, `npm test`, `npm pack --dry-run`, and
`npm publish`. Then configure npm's trusted publisher as `myugen/myugen-skills` with
`.github/workflows/publish-npm.yml` and allow `npm publish`. Later non-prerelease GitHub Releases
publish through OIDC with provenance; no npm token is stored in GitHub.

### Workspace commands (Claude Code)

The installed Claude plugin exposes three manual commands over the portable
[`multirepo-workspaces`](./skills/multirepo-workspaces) skill:

- `/myugen-skills:workspace:init [hub-name]` — asks for a project/hub, its source repositories,
  roles, and context; then creates the hub under `~/dev/workspaces/` after confirmation.
- `/myugen-skills:workspace:new [hub-name] [ticket]` — asks which registered repositories are
  involved in a task, validates branches and local start points, then creates the selected linked
  worktrees and coordination files after confirmation. A repository marked `codegraph: true` in
  `HUB.yml` also receives a verified local CodeGraph index in its ticket worktree.
- `/myugen-skills:workspace:archive [hub-name] [ticket]` — validates that every ticket worktree
  is clean, removes it without force while retaining its branch, then moves its coordination
  history to `<hub>/.archive/<ticket>/` after confirmation.
- `/myugen-skills:control:init [workspace-hub] [control-hub]` — creates a validated external
  per-vertical controller and records its reciprocal workspace-hub link after confirmation.
- `/myugen-skills:control:status [control-hub] [epic]` — reports ready work, blockers, delivery
  evidence, and freshness without changing local or external systems.
- `/myugen-skills:control:doctor [workspace-hub] [control-hub]` — read-only structural diagnosis
  for a structured controller or legacy Markdown epic boards; it never applies a migration.

Arguments are optional answers, not permission to skip validation. The commands are
Claude-specific adapters; other agents use the same portable skill workflow directly.

## Automatic capture (Claude Code)

Skills are model-invoked — Claude decides whether to use one, which means during heads-down
work it often just... doesn't, and nothing lands in the vault. Installing this repo as a
Claude Code plugin also installs `hooks/` — a **Claude-only layer** that fires deterministically
on session lifecycle events (not model discretion) to close that gap:

- A factual session note (repo, branch, commits, duration) is **always** written when a
  session ends, regardless of what the model did.
- Claude is reminded at session start which vault this session is linked to, and nudged once
  before ending a turn with uncommitted changes to persist any decisions/plans.

See [`hooks/README.md`](./hooks/README.md) for exactly what's deterministic vs. model-authored,
and how to disable it (`autoSession: false` in the vault config). The `knowledge-vault` skill
itself stays fully agent-agnostic — the hooks are additive, Claude-specific plumbing on top.

## Adding a skill

1. Copy the starter: `cp -r templates/skill-template skills/my-new-skill`.
2. Fill in `skills/my-new-skill/SKILL.md` — the `name` and `description` frontmatter are what
   an agent uses to decide when to activate it, so make the `description` specific about both
   *what* it does and *when* to use it.
3. Move deep detail into `references/` and point to it from `SKILL.md`, keeping the main file
   lean and readable in one sitting.
4. Add a row to the [Skills](#skills) table above. New skills are picked up by the plugin
   automatically — no manifest changes needed.

See [`AGENTS.md`](./AGENTS.md) for the full authoring conventions this hub follows.
