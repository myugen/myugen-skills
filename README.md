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
| [`knowledge-vault`](./skills/knowledge-vault) | Manage an Obsidian vault (via the `obsidian` CLI) as shared long-term memory for agents and humans — plans, decisions, session notes, and foundational knowledge about people, teams, and projects. |
| [`multirepo-workspaces`](./skills/multirepo-workspaces) | Initialize project hubs and safely manage ticket-scoped Git worktrees, independent optional skill selections, and coordination artifacts without converting source clones into a monorepo. |
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

### OpenCode V2 (server 2.2.2+)

The adapter targets the native plugin API in **OpenCode server 2.2.2 or newer within V2**.
Check the server with `opencode api get /api/info`; its version can differ from the terminal
client's `opencode --version`. The isolated 2.1.1 executable did not load this directory-based
setup; earlier releases are not supported by this adapter.

Install directly from GitHub — **the plugin is not published to npm**:

```sh
opencode plugin add github:myugen/myugen-skills
```

Or add the same source to `~/.config/opencode/opencode.jsonc` (or a project config), preserving
other entries:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:myugen/myugen-skills"]
}
```

The V2 plugin registers the portable skills included in its installed repository/package and the `/workspace-init`, `/workspace-new`,
`/workspace-archive`, `/hub-skills`, `/workspace-skills`, `/workspace-control-init`, `/workspace-control-status`, and
`/workspace-control-doctor` commands without replacing existing user definitions. Skills retain
their adjacent scripts, assets, and references; loading does not fetch another copy from `main`.
Update the Git plugin when you want the latest version. The adapter does not run Claude's memory
hooks; those remain a separate Claude-only integration.

Config changes reload automatically. Use `/reload` to force a full reload; no restart is required.
Inspect the active plugin and registered resources with:

```sh
opencode plugin list
opencode api get /api/command
opencode api get /api/skill
```

For local development, point `plugins` at the **repository directory**, not `opencode/plugin.js`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/myugen-skills"]
}
```

Version 2.x uses the native V2 `id`/`setup` API and domain transforms; OpenCode V1
users should keep the 1.x plugin. Renaming the old `plugin` config key alone cannot port V1 code.

For skills without the command adapters, OpenCode can instead load the public generated catalog
directly from this repository:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "skills": ["https://raw.githubusercontent.com/myugen/myugen-skills/main/skills/"]
}
```

This skills-only alternative uses the public HTTP catalog, without installing command adapters.
`skills/index.json` is generated from the skill directories and
updated automatically after changes under `skills/` merge into `main`.

The plugin's V2 implementation and configuration follow the official
[plugin migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1) and
[server API](https://opencode.ai/v2/docs/build/plugins/server).

#### Validating the adapter

`npm test` checks command execution, argument/attachment handling, overrides, replay, and the
installed package including every supporting skill file. To also exercise the installed artifact
in a real isolated V2 server, run:

```sh
OPENCODE_V2_BIN="/path/to/opencode-2.2.2-or-newer" npm test
```

The integration test uses a temporary home/configuration and in-memory database. It admits one
prompt with `resume: false` to wait for plugin activation; it executes no model or agent tools
and does not alter your real configuration. It is skipped when `OPENCODE_V2_BIN` is unset.
Use an executable matching the supported server version, not an older client on your `PATH`.

GitHub Actions runs the same suite, including the real installed-artifact integration, on pushes
to `main`, pull requests, and manual dispatches. `.github/workflows/ci.yml` installs the pinned OpenCode 2.2.2 runtime
under the runner's temporary directory, without credentials or model execution. It regenerates
the catalog in its own workspace for tests; the separate index workflow still commits the public
HTTP catalog after merges.

#### Repository-only distribution

The plugin is installed directly from this repository, without npm publication or GitHub Releases.
Automation is limited to CI and updating the public skill catalog; there are no publishing jobs
or publishing credentials. `package.json` supports Git-based installation and is marked
`private: true` to block npm publication. npm remains a local/CI tool for tests, installing the
pinned OpenCode runtime, and checking the installable artifact; none of these operations
publishes the plugin.

### Hub and workspace commands (Claude Code)

The installed Claude plugin exposes manual commands over the portable
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
- `/myugen-skills:hub:skills [hub-name] [status|add|remove|edit]` — the primary skill configuration
  command: inspects or changes only `HUB.yml` defaults for future workspaces after confirmation,
  without modifying existing tickets. `status` is read-only.
- `/myugen-skills:workspace:skills [hub-name] [ticket] [status|init|add|remove|sync]` — adjusts only
  one existing ticket's independent selection for experiments or exceptions. Mutations are previewed
  before confirmation; skills are copied outside repositories, never installed globally.
- `/myugen-skills:control:init [workspace-hub] [control-hub]` — creates a validated external
  per-vertical controller and records its reciprocal workspace-hub link after confirmation.
- `/myugen-skills:control:status [control-hub] [epic]` — reports ready work, blockers, delivery
  evidence, and freshness without changing local or external systems.
- `/myugen-skills:control:doctor [workspace-hub] [control-hub]` — read-only structural diagnosis
  for a structured controller or legacy Markdown epic boards; it never applies a migration. It also
  verifies selected workspace skill copies and reports legacy instructions or detectable global
  collisions, without requiring an unselected skill.

Arguments are optional answers, not permission to skip validation. The commands are
Claude-specific adapters; other agents use the same portable skill workflow directly.

### Optional workspace skills

Start with `/myugen-skills:hub:skills <hub>` in Claude Code, or `/hub-skills` in OpenCode, to
configure optional defaults for future workspaces. It asks for the operation and missing values,
previews changes, and edits only the hub's `HUB.yml` after confirmation. You can also edit that
file directly, referencing real local skill folders:

```yaml
skills:
  - name: show-me
    path: ~/dev/agent-skills/show-me
    when: "To explain complex flows visually or compare design alternatives."
```

Use `skills: []` for none. `show-me` is optional, not a prerequisite or an every-task requirement.
The YAML references an existing skill, including a custom one with its own `SKILL.md`; it never
defines a skill body or assigns coordinating subagents. The main session chooses when to use it.

Creating a ticket copies this selection to `.coordination/SKILLS.yml`, generates contextual
`SKILLS.md` guidance imported by Claude's instructions, and copies complete skill folders into
`<ticket>/.claude/skills/`. All files live outside repository worktrees. Changes to hub defaults or
original skill content do not affect existing tickets; each can add or remove skills independently.
CodeGraph keeps its existing separate per-repository configuration and lifecycle.

The portable `skills/multirepo-workspaces/scripts/workspace-skills.py` helper requires Python 3.9+
and supports read-only `validate`/`status` plus preview-first `init`, `add`, `remove`, and `sync`.
Mutations require `--apply` after confirmation. It protects edited or unmanaged copies and never
modifies source folders or global configuration. Existing tickets require explicit opt-in and a
separate review of old instruction files; inspection never migrates them automatically.

Start Claude Code or OpenCode at the ticket root for discovery. A Claude session inside a worktree
can add the ticket root with `--add-dir` or `/add-dir` and explicitly read its guidance. **Global,
bundled, plugin, and repository-owned skills remain independent**; local selection is not a runtime
sandbox. Keep optional originals outside global discovery directories for workspace-only use.
The helper and doctor warn about detectable globals and collisions without uninstalling anything.
See [workspace skills](./skills/multirepo-workspaces/references/workspace-skills.md) for the schema,
commands, discovery limits, migration, and archive safeguards.

## Automatic memory recall and capture (Claude Code)

Skills are model-invoked — an agent can forget to consult existing knowledge or capture new
decisions. Installing this repo as a Claude Code plugin also installs `hooks/`, a
**Claude-only layer** that performs bounded discovery and supplies lifecycle guidance:

Automatic Obsidian access requires a valid `knowledge-vault` primary explicitly declared in the
workspace's `HUB.yml`. An inherited vault or global fallback config alone does not enable it;
manual skill use is unchanged. Declared control-hub references remain available without memory.

- Session start, resume, compaction, and clear inject matching memory paths and declared epic
  records. Each prompt searches new ticket/epic identifiers with a session-local cache.
- Successful edit/commit activity prompts one capture step, including at non-Git ticket roots;
  old uncommitted files alone do not trigger it.
- Eligible sessions write a factual session note when the primary vault and running Obsidian are
  available. This is best-effort metadata logging, not an automatic summary of decisions.

The model must still read relevant notes, search by topic/person, and author meaningful updates.
See [`hooks/README.md`](./hooks/README.md) for limits, cache behavior, and what's model-authored,
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
