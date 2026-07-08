# myugen-skills

A personal hub of **skills** for working with and inside organizations — capturing
knowledge, planning, deciding, and keeping the context that makes work over time coherent.

Skills here follow the portable [`SKILL.md`](https://code.claude.com/docs/en/skills) format:
each skill is a self-contained directory with a `SKILL.md` entry point plus any supporting
`references/`, `assets/`, or `scripts/`. That format is readable by **any AI agent** that
supports it (Claude Code, and others) and, just as importantly, by **humans** — a `SKILL.md`
is a plain, structured description of how to do something well. Nothing here is tied to a
single tool.

## Skills

| Skill | What it does |
|-------|--------------|
| [`knowledge-vault`](./knowledge-vault) | Manage an Obsidian vault (via the `obsidian` CLI) as shared long-term memory for agents and humans — plans, decisions, session notes, and foundational knowledge about people, teams, and projects. |

_New skills get added here as the hub grows — see [Adding a skill](#adding-a-skill)._

## Using these skills

The skills are the source of truth in this repo. How they get picked up depends on who's
using them:

- **Humans** — just read the `SKILL.md` (and its `references/`). It's written to be followed
  directly.
- **AI agents** — point the agent at a skill however it loads skills. For agents that
  discover skills from a directory (e.g. Claude Code reads `~/.claude/skills/`), symlink the
  skill so edits here take effect immediately:

  ```sh
  git clone git@github-personal:myugen/myugen-skills.git ~/dev/myugen/skills
  ln -s ~/dev/myugen/skills/knowledge-vault ~/.claude/skills/knowledge-vault
  ```

  To link every skill at once into that directory:

  ```sh
  for dir in ~/dev/myugen/skills/*/; do
    name=$(basename "$dir")
    [ -f "$dir/SKILL.md" ] && ln -sfn "$dir" ~/.claude/skills/"$name"
  done
  ```

## Adding a skill

1. Copy the starter: `cp -r templates/skill-template my-new-skill`.
2. Fill in `my-new-skill/SKILL.md` — the `name` and `description` frontmatter are what an
   agent uses to decide when to activate it, so make the `description` specific about both
   *what* it does and *when* to use it.
3. Move deep detail into `references/` and point to it from `SKILL.md`, keeping the main file
   lean and readable in one sitting.
4. Add a row to the [Skills](#skills) table above.

See [`AGENTS.md`](./AGENTS.md) for the full authoring conventions this hub follows.
