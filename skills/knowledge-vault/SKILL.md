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
- **Resolve the vault before doing anything else** — never rely on the CLI's own default
  (whichever vault is currently focused, or the vault in the working directory), since this
  skill runs from inside arbitrary project repos where that default is often wrong. Instead:
  1. Read `${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault/config.json`. If it doesn't
     exist, stop and follow `references/setup.md` rather than guessing a vault.
  2. Resolve the vault name for the current working directory (`scripts/resolve-vault.sh`
     does this, or apply the rule by hand — see `references/cli-usage.md`).
  3. Pass that name as `vault="<name>"` on **every** `obsidian` command for the rest of the
     task.
- One-time setup (CLI pairing, the config file, and installing templates into the vault) is
  covered end-to-end in `references/setup.md` — run through it once per machine.

## Vault structure

```
Foundation/     durable reference knowledge — how things work, glossaries, recurring context
People/         one note per person
Teams/          one note per team
Projects/       one note per initiative/project
AI/
  ├─ Plans/       agent-authored plans
  ├─ Decisions/   intermediate and final decisions
  └─ Sessions/    factual session records — written automatically by the SessionEnd hook,
                  not by you (see "Session notes are automatic" below)
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
  `SESS-` — since these are numerous and referenced by ID more than by title. You assign
  `PLAN-`/`DEC-` IDs yourself when creating those notes; `SESS-` IDs are assigned by the
  `SessionEnd` hook, since you never create Session notes directly (see below).

Full mechanics for assigning and linking IDs (numbering, zero-padding, aliases) are in
`references/naming-and-ids.md` — read it before creating any note in `AI/`.

## Core workflows

### 1. Search before you write

**This applies to every note type you create yourself — Person, Team, Project, Foundation,
Plan, and Decision — not just the entity types.** Before creating any of these, search first to
confirm one doesn't already exist:

1. Search by the obvious term: `obsidian vault="$VAULT" search query="<term>"`. If you expect
   more than a couple of hits, `search:context` shows matching lines in context, which makes it
   easier to tell a real match from a coincidental word overlap.
2. For Plans/Decisions, also try the topic in different phrasings ("Ticketing Vendor" vs
   "Ticketing Platform vendor") — a differently-titled existing note about the same thing is a
   duplicate you'd otherwise miss. If in doubt, list the folder (`AI/Plans/`, `AI/Decisions/`)
   and skim titles rather than trusting a single query.
3. Treat any note that's clearly about the same real-world entity or the same decision/plan
   topic as a match, even if the title isn't identical — don't require an exact string match to
   count something as "already exists."

**If a match is found, update it in place — see "Updating an existing note" below — instead of
creating a new note.** The vault's value comes from having exactly one note per real-world
entity (and one Plan/Decision per topic) that accumulates context over time.

This applies to reading, too: before answering questions about a person, team, project, or
organization-specific process, search the vault first rather than relying on general knowledge or
what's earlier in the conversation. The vault is the source of truth.

### 2. Creating a Person / Team / Project / Foundation note

After confirming it doesn't already exist, create it from the matching template, then fill in
known properties and link outward wherever relevant — e.g. a Project note should link its
`owner` and `team` as wikilinks, not plain text, so backlinks work. See
`references/cli-usage.md` for the exact commands.

### 3. Creating an AI artifact (Plan / Decision)

Determine the next ID (`references/naming-and-ids.md`), create the note from the matching
template, then set `id`, `aliases`, `status`, and any known relationship fields. Cross-link
both directions where relevant:

- A Decision that implements a Plan sets `implements: "[[PLAN-0004]]"`; go back and set the
  Plan's `resulted_in: "[[DEC-0007]]"` too.

See `references/cli-usage.md` for a full worked example.

**Session notes (`SESS-`) are not part of this workflow — see "Session notes are automatic"
below.**

### 4. Session notes are automatic — don't create them yourself

Every session, the `SessionEnd` hook writes exactly one factual `SESS-NNNN` note (repo, branch,
commits, files changed, duration, `session_id`) regardless of what happened during the session.
Because of this, **you should never create a Session note yourself** — doing so produces a
second note for the same session instead of one.

If something from the session is worth adding beyond that automatic metadata (a summary, a
noteworthy tangent), don't create a new Session note — find the one this session already wrote
(or will write) and update it instead:

- During the session, there usually isn't one yet — the hook only runs at `SessionEnd`. In that
  case, capture the substance as a Decision or Plan note instead (that's what those types are
  for), and let the automatic Session note stand as the factual record.
- If you're revisiting a past session and want to enrich its note, find it by listing
  `AI/Sessions/` (titles are `SESS-NNNN <repo> <date>`) or by searching for the `session_id`
  recorded in its body, then `append` to it — see "Updating an existing note" below.

### 5. Updating an existing note

Once you've found a match (workflow 1) or want to enrich a note you didn't just create, this is
the procedure — for any note type:

1. **Read it** — `obsidian vault="$VAULT" read file="<name>"` — so you know what's already
   there and don't restate it.
2. **Add new information:**
   - New frontmatter value or changed status → `property:set` (remember `type=list` for
     list-valued properties like `aliases`/`related`/`members`).
   - New body content → `append` (or `prepend` for something that belongs at the top). These
     only add text; the CLI has no command to edit or replace existing body prose in place. If
     existing text is wrong (not just incomplete), edit it in the Obsidian app directly —
     `create ... overwrite` is not a substitute; despite the name it doesn't overwrite an
     existing note (see `references/cli-usage.md`).
3. **Bump `updated` to today** — see workflow 7 below. Do this for any substantive change from
   step 2; skip it if all you did was read.

See `references/cli-usage.md` for the exact commands and a worked "found a match → update"
example.

### 6. Superseding, not deleting

When a Plan or Decision is replaced rather than simply updated, don't overwrite or delete the
old note — it's part of the historical record. Instead:

- Set the old note's `status: superseded` and `superseded_by: "[[DEC-0009]]"`.
- Set the new note's `supersedes: "[[DEC-0007]]"`.

Status vocabulary is shared across Plans and Decisions: `draft → active/proposed →
final/completed`, with `superseded` or `abandoned` as terminal alternatives. Full definitions
are in `references/schema.md`.

### 7. Keep `updated` current

Any time you substantively edit an existing note (not just adding a backlink elsewhere), set
its `updated` property to today. `created` is set once and never changes.

### 8. Linking conventions

- Use wikilinks (`[[Name]]`) for anything that refers to a person, team, project, or another
  artifact — in frontmatter properties and in body text alike. This is what makes backlinks
  and the graph view useful.
- Use `tags` only for cross-cutting themes that don't warrant their own note (e.g. `q3-2026`,
  `vendor-eval`) — not for entities that already have or deserve a note.

## Reference files

- `references/setup.md` — one-time setup: enabling the CLI, verifying it, creating the vault
  config file, and installing templates. Start here on a new machine or if vault resolution
  is failing.
- `references/schema.md` — full frontmatter property table for every note type, plus the
  shared status vocabulary. Read before creating or editing any note.
- `references/naming-and-ids.md` — naming rules and ID-assignment mechanics. Read before
  creating any note in `AI/`.
- `references/cli-usage.md` — complete `obsidian` CLI reference for working with this vault:
  general syntax, vault resolution, targeting, and the specific commands and worked example
  used here. Read whenever you need the actual command syntax.
- `assets/config.example.json` — example vault-resolution config; copy to
  `~/.config/knowledge-vault/config.json` (see `references/setup.md`).
- `assets/templates/` — the seven template files (`Person.md`, `Team.md`, `Project.md`,
  `Foundation.md`, `Plan.md`, `Decision.md`, `Session.md`) to install into the vault's
  `Templates/` folder.
- `scripts/resolve-vault.sh` — prints the vault name to use for the current working
  directory, per the config file's rules.
