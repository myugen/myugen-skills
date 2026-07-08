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

Use before creating any Person/Team/Project/Foundation note, to avoid duplicating an existing
one. Also use before answering questions about a person/team/project/process — ground the
answer in what's actually in the vault rather than guessing.

### Create a note from a template

```
obsidian vault="$VAULT" create name="<name>" path="<folder>/<name>.md" template="<Type>" silent
```

- `template=` pulls the skeleton from the corresponding file in `Templates/` (installed from
  this skill's `assets/templates/`) — `Person`, `Team`, `Project`, `Foundation`, `Plan`,
  `Decision`, or `Session`.
- Always pass `path=` explicitly rather than relying on the default note location, so the note
  lands in the right folder.

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

### Append to an existing note

```
obsidian vault="$VAULT" append file="<name>" content="<text>"
```

Use this to add a new entry to an existing Person, Team, or Project note rather than creating
a duplicate.

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

