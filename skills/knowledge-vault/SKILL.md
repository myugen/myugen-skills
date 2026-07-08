---
name: knowledge-vault
description: Manage the knowledge vault — an Obsidian vault, accessed via the obsidian CLI, used as a shared knowledge base for AI agents and humans working together. It stores AI-generated plans, decisions, and working-session notes alongside foundational knowledge about people, teams, and projects. Use this skill whenever the user or an agent needs to save, log, or update a plan, decision, or session note; create or look up a note about a person, team, or project; capture durable/foundational knowledge; link related notes together; or answer "what do we know about X" from the vault. Trigger this any time context is worth persisting for later — even if the user doesn't say "Obsidian" or "vault" explicitly, e.g. "remember that we decided...", "log this plan", "who owns the ticketing project".
---

# Knowledge Vault

This is a single Obsidian vault that acts as long-term memory shared between AI
agents and humans. Agents write plans, decisions, and session notes into it as they work;
both agents and humans read from it to stay grounded in real context (real people, real
teams, real decisions) instead of re-deriving or guessing at things that are already known.

Two things make this different from a normal file-write task:

1. **It's a shared, evolving knowledge graph, not a scratch folder.** Notes link to each
   other (people ↔ teams ↔ projects ↔ decisions), and those links are how future agents
   (and you) rediscover context. Favor linking over duplicating information.
2. **Writes go through the `obsidian` CLI, not raw file edits.** This keeps Obsidian's live
   index, backlinks, and any installed plugins in sync while the app is open.

## Prerequisites

- Obsidian must be running with the vault open (the CLI talks to a live instance).
- The `obsidian` CLI must be installed and paired. Run `obsidian help` if you're ever unsure
  a command exists — it's always up to date and is the source of truth over this skill.
- If more than one vault is open, target this one explicitly by prefixing commands with
  `vault="<name>"`. Fill in the actual vault name here once: `VAULT_NAME = <fill in>`.
- One-time setup: copy the files in this skill's `assets/templates/` into the vault's
  `Templates/` folder so `obsidian create ... template="Decision"` (etc.) works. Create that
  folder first if it doesn't exist yet.

## Vault structure

```
Foundation/     durable reference knowledge — how things work, glossaries, recurring context
People/         one note per person
Teams/          one note per team
Projects/       one note per initiative/project
AI/
  ├─ Plans/       agent-authored plans
  ├─ Decisions/   intermediate and final decisions
  └─ Sessions/    working notes / scratch reasoning worth keeping
Templates/      template files backing `obsidian create ... template=`
```

Folders carry the *type*. Everything else that matters (status, owner, links, tags) lives in
YAML frontmatter properties — see `references/schema.md` for the full property table per note
type. Read it before creating or editing a note if you're not already familiar with its schema.

## Note naming

- **People / Teams / Projects / Foundation**: descriptive title matching how you'd naturally
  refer to it — e.g. `People/Jana Smith.md`. These are linked by name, so the filename *is*
  the link target.
- **AI artifacts** (`Plans/`, `Decisions/`, `Sessions/`): ID-prefixed — `PLAN-`, `DEC-`,
  `SESS-` — since these are numerous and referenced by ID more than by title.

Full mechanics for assigning and linking IDs (numbering, zero-padding, aliases) are in
`references/naming-and-ids.md` — read it before creating any note in `AI/`.

## Core workflows

### 1. Search before you write

Before creating a Person, Team, Project, or Foundation note, search the vault for an existing
one first. If it already exists, update/append to it rather than creating a duplicate — the
vault's value comes from having exactly one note per real-world entity that accumulates
context over time.

This applies to reading, too: before answering questions about a person, team, project, or
organization-specific process, search the vault first rather than relying on general knowledge or
what's earlier in the conversation. The vault is the source of truth.

### 2. Creating a Person / Team / Project / Foundation note

After confirming it doesn't already exist, create it from the matching template, then fill in
known properties and link outward wherever relevant — e.g. a Project note should link its
`owner` and `team` as wikilinks, not plain text, so backlinks work. See
`references/cli-usage.md` for the exact commands.

### 3. Creating an AI artifact (Plan / Decision / Session)

Determine the next ID (`references/naming-and-ids.md`), create the note from the matching
template, then set `id`, `aliases`, `status`, and any known relationship fields. Cross-link
both directions where relevant:

- A Decision that implements a Plan sets `implements: "[[PLAN-0004]]"`; go back and set the
  Plan's `resulted_in: "[[DEC-0007]]"` too.
- A Session that touches other artifacts lists them in `related`.

See `references/cli-usage.md` for a full worked example.

### 4. Superseding, not deleting

When a Plan or Decision is replaced rather than simply updated, don't overwrite or delete the
old note — it's part of the historical record. Instead:

- Set the old note's `status: superseded` and `superseded_by: "[[DEC-0009]]"`.
- Set the new note's `supersedes: "[[DEC-0007]]"`.

Status vocabulary is shared across Plans and Decisions: `draft → active/proposed →
final/completed`, with `superseded` or `abandoned` as terminal alternatives. Full definitions
are in `references/schema.md`.

### 5. Keep `updated` current

Any time you substantively edit an existing note (not just adding a backlink elsewhere), set
its `updated` property to today. `created` is set once and never changes.

### 6. Linking conventions

- Use wikilinks (`[[Name]]`) for anything that refers to a person, team, project, or another
  artifact — in frontmatter properties and in body text alike. This is what makes backlinks
  and the graph view useful.
- Use `tags` only for cross-cutting themes that don't warrant their own note (e.g. `q3-2026`,
  `vendor-eval`) — not for entities that already have or deserve a note.

## Reference files

- `references/schema.md` — full frontmatter property table for every note type, plus the
  shared status vocabulary. Read before creating or editing any note.
- `references/naming-and-ids.md` — naming rules and ID-assignment mechanics. Read before
  creating any note in `AI/`.
- `references/cli-usage.md` — complete `obsidian` CLI reference for working with this vault:
  general syntax, targeting, and the specific commands and worked example used here. Read
  whenever you need the actual command syntax.
- `assets/templates/` — the seven template files (`Person.md`, `Team.md`, `Project.md`,
  `Foundation.md`, `Plan.md`, `Decision.md`, `Session.md`) to install into the vault's
  `Templates/` folder.
