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
