# obsidian CLI reference

Everything needed to operate this vault via the `obsidian` CLI — general syntax plus the
specific commands used here. Requires Obsidian to be running with the vault open; the CLI
talks to a live instance, not the files directly.

If a command isn't covered below, run `obsidian help` — it lists every available command and
is always up to date, so treat it as the source of truth over this document.

## Syntax

**Parameters** take a value with `=`. Quote values that contain spaces:

```
obsidian create name="My Note" content="Hello world"
```

**Flags** are boolean switches with no value:

```
obsidian create name="My Note" silent overwrite
```

For multiline content, use `\n` for newline and `\t` for tab within a quoted value.

## File targeting

Commands that act on a note accept `file=` or `path=`. Without either, the currently active
file in Obsidian is used — so always pass one explicitly in this vault, to avoid acting on
whatever the user happens to have open.

- `file=<name>` — resolves like a wikilink: name only, no folder or extension needed. Use this
  when the name is unique in the vault.
- `path=<path>` — exact path from the vault root, e.g. `AI/Decisions/DEC-0008 Choose Ticketing
  Vendor.md`. Use this on creation, and anywhere folder placement matters.

## Vault targeting

Without `vault=`, commands target whichever vault Obsidian most recently focused, or the vault
in the current working directory — **don't rely on this default**. This skill runs from
inside arbitrary project repos, where that default frequently points at the wrong vault (or
none), and there's no way to fix it from inside the repo without dirtying it with
vault-selection config that doesn't belong there.

Instead, resolve the vault from the user-level config at
`${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault/config.json` before doing anything else,
and pass it explicitly on every command:

```sh
VAULT=$(scripts/resolve-vault.sh)   # or apply the rule below by hand
obsidian vault="$VAULT" search query="test"
```

If that config file doesn't exist yet, stop and follow `references/setup.md` — don't guess a
vault name.

### Resolution rule (what `resolve-vault.sh` does)

1. If the `OBSIDIAN_VAULT` environment variable is set, use it — a one-off override that wins
   over everything else.
2. Otherwise, find the working root: `git rev-parse --show-toplevel` if inside a repo, else the
   current directory.
3. Look up `config.json`'s `repositories` map (path → vault name) for keys that are a prefix
   of that root. If more than one matches, the **longest** (most specific) one wins.
4. If nothing matches, fall back to `config.json`'s `defaultVault`.

The config file's full shape is documented in `references/setup.md`.

Every example below assumes you've already run `VAULT=$(scripts/resolve-vault.sh)` and carries
`vault="$VAULT"` accordingly — that's not optional decoration, it's the fix for the default
described above.

## Universal flags worth knowing

- `silent` — suppresses the note opening in the Obsidian UI after the command runs. Use this
  for every write in this vault, since an agent creating or editing several notes shouldn't
  pop each one open.
- `--copy` — copies a command's output to the clipboard instead of (or in addition to)
  printing it.
- `total` — on list-style commands, returns just a count.

## Commands used in this vault

### Search (read, before every write)

```
obsidian vault="$VAULT" search query="<term>"
```

Use before creating **any** note you create yourself — Person/Team/Project/Foundation as well
as Plan/Decision — to avoid duplicating one that already exists. Also use before answering
questions about a person/team/project/process — ground the answer in what's actually in the
vault rather than guessing.

Useful options and related commands:

- `path=<folder>` — limit the search to one folder, e.g. `path="AI/Decisions"` when you only
  care about existing decisions.
- `limit=<n>` — cap the number of results.
- `format=json` — structured output, easier to check "did anything come back" programmatically
  than parsing text.
- `total` — just the match count.
- `search:context query="<term>"` — same search, but returns matching lines with surrounding
  context instead of just filenames. Use this when a plain `search` returns several hits and
  you need to tell a real match from a coincidental word overlap, without opening every file.
- `files folder="<path>"` — lists filenames in a folder without searching content; useful when
  you know roughly where a note would live (e.g. `files folder="AI/Decisions"`) and just want to
  skim titles for a near-duplicate, or `files folder="AI/Sessions"` to find a specific session
  note by its `SESS-NNNN <repo> <date>` title.

**Worked example — match found, update instead of creating:**

```sh
obsidian vault="$VAULT" search query="Ticketing Vendor"
# → hits: "Projects/Ticketing Platform.md", one line mentioning a vendor decision

obsidian vault="$VAULT" search:context query="Ticketing Vendor"
# → confirms "Projects/Ticketing Platform.md" already has a "## Vendor decision" section —
#   this is the same topic, not a coincidence. Update it rather than creating a new note.

obsidian vault="$VAULT" read file="Ticketing Platform"
# → read the existing content before appending, so you don't restate what's already there

obsidian vault="$VAULT" append file="Ticketing Platform" content="..."
obsidian vault="$VAULT" property:set name="updated" value="2026-07-13" type=date file="Ticketing Platform"
```

### Create a note from a template

```
obsidian vault="$VAULT" create name="<name>" path="<folder>/<name>.md" template="<Type>" silent
```

- `template=` pulls the skeleton from the corresponding file in `Templates/` (installed from
  this skill's `assets/templates/`) — `Person`, `Team`, `Project`, `Foundation`, `Plan`,
  `Decision`, or `Session`.
- Always pass `path=` explicitly rather than relying on the default note location, so the note
  lands in the right folder.

**Avoid dots in `name=`/`path=` other than the final `.md`.** Confirmed by testing: an embedded
dot anywhere before the extension (e.g. a note titled `SESS-0002 my.repo 2026-07-08`) makes the
CLI create a **directory** named after the full intended filename, with the actual note placed
inside it truncated at the first dot — not the file you asked for. If a title is built from
something that might contain a dot (a repo/directory name, a version string, …), replace dots
with a safe character (e.g. `-`) before using it in `name=`/`path=`; dots are fine in the note's
body text, just not in the filename-facing value.

**`overwrite` does not overwrite.** Confirmed by testing: `create ... overwrite` against a
`name=`/`path=` that already exists does not replace the existing file — it silently
auto-suffixes the new file's name instead (`... 1.md`, `... 2.md`, …), the exact same behavior
as a plain `create` collision without the flag. You end up with both the original note and a
near-duplicate, not a replacement. There is currently no CLI command that reliably overwrites
an existing note's content — if a note's body needs correcting rather than appending to (see
"Append/prepend" below), edit it in the Obsidian app directly. If you do end up with a stray
auto-suffixed file from this, `delete` the wrong one and `rename` the right one back to the
intended name (in that order, since `file=` matches by exact name and a suffixed file won't
collide with the lookup).

### Fill in properties after creation

A template doesn't know values ahead of time, so it leaves most fields blank. Fill them in
right after creating the note:

```
obsidian vault="$VAULT" property:set name="<property>" value="<value>" file="<name>"
```

Repeat once per property. For AI artifacts, this always includes at minimum `id`, `aliases`,
and `status` right after creation — see `references/naming-and-ids.md` for how to compute the
ID.

**List-valued properties need `type=list`.** `aliases`, `related`, and `members` are lists in
the schema (see `references/schema.md`), but a plain `property:set` writes the value as a
literal string (e.g. `aliases: "[DEC-0008]"`), which silently breaks alias resolution and
backlinks. Pass `type=list` and a bare value (no brackets):

```
obsidian vault="$VAULT" property:set name="aliases" value="DEC-0008" type=list file="<name>"
```

Confirmed by testing: without `type=list` the property lands as a string; with it, it lands as
a proper YAML list entry.

Related commands for reading/removing a single property without reading the whole note:

```
obsidian vault="$VAULT" property:read name="<property>" file="<name>"
obsidian vault="$VAULT" property:remove name="<property>" file="<name>"
```

### Append/prepend to an existing note

```
obsidian vault="$VAULT" append file="<name>" content="<text>"
obsidian vault="$VAULT" prepend file="<name>" content="<text>"
```

Use these to add content to an existing note rather than creating a duplicate — `append` adds
to the end (the common case, e.g. a new entry on a Person/Team/Project note), `prepend` to the
start. **Both only add text — there is no CLI command to edit or replace existing body prose in
place.** If existing content is wrong rather than just incomplete, edit it in the Obsidian app
directly — `create ... overwrite` is *not* a substitute; see the `overwrite` gotcha above, it
doesn't actually overwrite.

### Read a note

```
obsidian vault="$VAULT" read file="<name>"
```

### Check backlinks

```
obsidian vault="$VAULT" backlinks file="<name>"
```

Useful before superseding or renaming something, to see what currently points to it.

### Tag overview

```
obsidian vault="$VAULT" tags sort=count counts
```

Useful occasionally to see which cross-cutting tags are actually in active use, and catch
near-duplicate tags (e.g. `q3-2026` vs `Q3-2026`) before they multiply.

### Locating the automatic Session note

Session notes (`SESS-`) are written by the `SessionEnd` hook, not by you (see `SKILL.md`'s
"Session notes are automatic" workflow) — but you may still need to find one, e.g. to append a
summary to a past session. Two ways to find it:

```sh
obsidian vault="$VAULT" files folder="AI/Sessions"
# titles are "SESS-NNNN <repo> <date>" — skim for the repo/date you're after

obsidian vault="$VAULT" search query="<session_id>"
# the note's body always includes "session_id: <id>" — exact-match search if you have the ID
```

Never create a new `SESS-` note yourself, even if you can't find the one you're looking for —
capture the substance as a Decision or Plan note instead.

## End-to-end example: logging a decision

```sh
VAULT=$(scripts/resolve-vault.sh)

obsidian vault="$VAULT" search query="Ticketing Vendor"
# → nothing found, safe to create

# list AI/Decisions/ → highest existing is DEC-0007, so next is DEC-0008

obsidian vault="$VAULT" create name="DEC-0008 Choose Ticketing Vendor" \
  path="AI/Decisions/DEC-0008 Choose Ticketing Vendor.md" \
  template="Decision" silent

obsidian vault="$VAULT" property:set name="id" value="DEC-0008" file="DEC-0008 Choose Ticketing Vendor"
obsidian vault="$VAULT" property:set name="aliases" value="DEC-0008" type=list file="DEC-0008 Choose Ticketing Vendor"
obsidian vault="$VAULT" property:set name="status" value="final" file="DEC-0008 Choose Ticketing Vendor"
obsidian vault="$VAULT" property:set name="implements" value="[[PLAN-0004]]" file="DEC-0008 Choose Ticketing Vendor"

# and link back from the plan it implements
obsidian vault="$VAULT" property:set name="resulted_in" value="[[DEC-0008]]" file="PLAN-0004 Ticketing Vendor Evaluation"
```

