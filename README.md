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

### OpenCode V2 (server 2.2.2+)

The adapter targets the native plugin API in **OpenCode server 2.2.2 or newer within V2**.
Check the server with `opencode api get /api/info`; its version can differ from the terminal
client's `opencode --version`. The isolated 2.1.1 executable did not load this directory-based
setup; earlier releases are not supported by this adapter.

Install directly from GitHub — **no npm publication is required**:

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
`/workspace-archive`, `/workspace-control-init`, `/workspace-control-status`, and
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

An optional npm distribution can also be installed with `opencode plugin add 'myugen-skills@^2'`
once published. Version 2.x uses the native V2 `id`/`setup` API and domain transforms; OpenCode V1
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
to `main` and pull requests. `.github/workflows/ci.yml` installs the pinned OpenCode 2.2.2 runtime
under the runner's temporary directory, without credentials or model execution. It regenerates
the catalog in its own workspace for tests; the separate index workflow still commits the public
HTTP catalog after merges. Release validation instead requires the committed index to be current
and the release tag to match `package.json`.

#### Optional npm publishing

GitHub releases always validate through the reusable CI workflow; **npm publishing is disabled
by default** and is not required for GitHub installation. To enable the optional registry path:

1. Publish the first npm version manually from its matching release commit with `npm login`,
   `npm test`, `npm pack --dry-run`, and `npm publish`.
2. Configure npm's trusted publisher as `myugen/myugen-skills`, workflow
   `.github/workflows/publish-npm.yml`.
3. Set the GitHub repository Actions variable `PUBLISH_NPM` to exactly `true`.

Later non-prerelease releases publish only after validation succeeds, using OIDC with provenance.
Only the publishing job receives `id-token: write`; no npm token is stored in GitHub. Leave the
variable unset or set it to `false` to keep GitHub-only distribution.

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
  for a structured controller or legacy Markdown epic boards; it never applies a migration. It also
  reports whether the official `show-me` skill is locally available to OpenCode and Claude Code.

Arguments are optional answers, not permission to skip validation. The commands are
Claude-specific adapters; other agents use the same portable skill workflow directly.

### Ticket Visualizations

Every task in a new multirepo ticket workspace uses the official
[`show-me`](https://github.com/humanlayer/skills/tree/main/plugins/show-me) skill before editing to
show the intended change, and after validation to show the actual code and diff. Install it for the
agents you use before starting ticket work:

```sh
npx skills add humanlayer/skills --skill show-me --global --agent opencode claude-code
```

The workspace doctor only inspects local skill files and lock metadata. It reports readiness and
prints the appropriate install command when needed; it never installs the skill itself.

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
