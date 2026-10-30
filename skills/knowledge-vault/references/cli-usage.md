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

For a short inline body, use `\n` for newline and `\t` for tab within a quoted value. For a
multiline body, use `scripts/append-file.sh` instead of assembling an escaped shell argument.

## File targeting

Commands that act on a note accept `file=` or `path=`. Without either, the currently active
file in Obsidian is used — so always pass one explicitly in this vault, to avoid acting on
whatever the user happens to have open.

- `file=<name>` — resolves a real filename/basename: no folder or extension is needed. It does
  **not** resolve a frontmatter alias or bare artifact ID, so `file="DEC-0008"` does not target
  `DEC-0008 Choose Ticketing Vendor.md`.
- `path=<path>` — exact path from the vault root, e.g. `AI/Decisions/DEC-0008 Choose Ticketing
  Vendor.md`. Use this on creation, and whenever `search` or `files` has already returned a
  path; it is the safest targeting form.

## Vault targeting

Without `vault=`, commands target whichever vault Obsidian most recently focused, or the vault
in the current working directory — **don't rely on this default**. This skill runs from
inside arbitrary project repos, where that default frequently points at the wrong vault (or
none), and there's no way to fix it from inside the repo without dirtying it with
vault-selection config that doesn't belong there.

Instead, resolve the vault from the current workspace or user-level fallback before doing
anything else, and pass it explicitly on every command:

```sh
VAULT=$(bash scripts/resolve-vault.sh)   # or apply the rule below by hand
obsidian vault="$VAULT" search query="test"
```

To obtain the filesystem path of the selected vault, ask that selected vault directly rather
than parsing `vaults verbose`:

```sh
obsidian vault="$VAULT" vault info=path
```

If resolution fails, stop and read the diagnostic. Do not guess a vault name or silently target
the CLI default.

### Resolution rule (what `resolve-vault.sh` does)

1. If the `OBSIDIAN_VAULT` environment variable is set, use it — a one-off override that wins
   over everything else.
2. Otherwise, discover the enclosing workspace in two passes. First walk ancestors for a ticket's
   `.coordination/REPOSITORIES.yml` and derive its active or archived hub. If none is found, walk
   ancestors for the nearest `HUB.yml`.
3. If that hub declares non-empty `memory`, require its first entry to be a valid local
   `knowledge-vault` primary and use `memory[0].config.vault`. A malformed explicit declaration
   fails closed: do not consult `config.json` or write anywhere. Later memory entries are read-only
   and are never vault fallbacks.
4. If workspace memory is absent or `memory: []`, find the working root with `git rev-parse
   --show-toplevel` when inside a repo, else use the current directory. Look up `config.json`'s
   `repositories` map (path → vault name) for keys that are a prefix
   of that root. If more than one matches, the **longest** (most specific) one wins.
5. If nothing matches, fall back to `config.json`'s `defaultVault`.

The fallback config's full shape is documented in `references/setup.md`; the workspace schema and
canonical YAML subset are documented in `../../multirepo-workspaces/references/hub-schema.md`.

For read-only discovery adapters, `scripts/resolve-workspace-memory.py --context [directory]`
adds the discovered `hub` file, `ticket_root`, canonical `ticket`/`control` fields, and validated
`entries` to its JSON result. Its default output stays unchanged. Invalid ticket/control metadata
produces `metadata_error` without guessing identifiers or epic paths; malformed memory still
fails closed. This is metadata discovery, not a full YAML parser or permission to write paths.

Automatic lifecycle adapters use `scripts/resolve-vault.sh --workspace-required`: only an explicit
valid primary in `HUB.yml` can select a vault. Missing/empty memory fails rather than consulting
the environment or user config. The default manual resolution above is unchanged;
`--workspace-owned` still gives declared workspace memory priority while retaining legacy
fallback when memory is absent.

Every example below assumes you've already run `VAULT=$(bash scripts/resolve-vault.sh)` and carries
`vault="$VAULT"` accordingly — that's not optional decoration, it's the fix for the default
described above.

## Universal flags worth knowing

- `silent` — suppresses the note opening in the Obsidian UI after the command runs. Use this
  for every write in this vault, since an agent creating or editing several notes shouldn't
  pop each one open.
- `--copy` — copies a command's output to the clipboard instead of (or in addition to)
  printing it.
- `total` — on list-style commands, returns just a count.

## Bounded CLI calls

An external CLI call can occasionally take longer than an agent's available execution window.
Use the bundled wrapper when a call needs a hard limit:

```sh
scripts/run-with-timeout.sh 30 obsidian vault="$VAULT" wordcount path="AI/Plans/example.md"
```

It works on macOS and Linux without requiring `timeout` or `gtimeout`, passes through normal
stdout/stderr and exit codes, and returns `124` if the deadline expires. Isolated `wordcount`
calls completed successfully during verification; this is general defensive guidance, not a
claim that `wordcount` always hangs.

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

### List a folder

```
obsidian vault="$VAULT" files folder="AI/Decisions"
```

Lists filenames in a folder without searching content. Use it to skim artifact titles for a
near-duplicate, determine the next ID, or find a Session note by its `SESS-NNNN <repo> <date>`
title.

**Worked example — match found, update instead of creating:**

```sh
obsidian vault="$VAULT" search query="Ticketing Vendor"
# → hits: "Projects/Ticketing Platform.md", one line mentioning a vendor decision

obsidian vault="$VAULT" search:context query="Ticketing Vendor"
# → confirms "Projects/Ticketing Platform.md" already has a "## Vendor decision" section —
#   this is the same topic, not a coincidence. Update it rather than creating a new note.

obsidian vault="$VAULT" read path="Projects/Ticketing Platform.md"
# → read the existing content before appending, so you don't restate what's already there

obsidian vault="$VAULT" append path="Projects/Ticketing Platform.md" content="..."
obsidian vault="$VAULT" property:set name="updated" value="2026-07-13" type=date path="Projects/Ticketing Platform.md"
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

Repeat once per property. For AI artifacts, this always includes at minimum `id` and `status`
right after creation — see `references/naming-and-ids.md` for how to compute the ID.

**List-valued properties need `type=list`.** A plain `property:set` writes a literal string
instead of a YAML list. Pass `type=list` and a bare value (no brackets):

```
obsidian vault="$VAULT" property:set name="members" value="[[Jana Smith]]" type=list path="Teams/Platform.md"
```

Confirmed by testing: `type=list` creates a proper YAML list entry, but accepts only one value.
Another `property:set` for the same property **replaces** the prior item; comma-separated values
remain one quoted string. Do not use repeated calls or comma/bracket encoding for a multi-value
field. Keep the primary relationship in frontmatter and place further linked relationships in
the note body. If every value must be a YAML list entry, edit that property in Obsidian.

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

For a substantial body, put the content in a file and let the helper handle escaping:

```sh
scripts/append-file.sh "$VAULT" "AI/Decisions/DEC-0008 Choose Ticketing Vendor.md" decision-body.md
```

The helper requires an exact vault-relative path, preserves embedded newlines, tabs, and
backslashes, and bounds the underlying CLI call. It only appends; it cannot replace existing
prose.

### Read a note

```
obsidian vault="$VAULT" read file="<name>"
```

### Check backlinks

```
obsidian vault="$VAULT" backlinks file="<name>"
```

Useful before superseding or renaming something, to see what currently points to it.
`backlinks` includes resolved links in both body text and frontmatter. A bare-ID link such as
`[[DEC-0008]]` is unresolved, however, and is therefore not a backlink. Link AI artifacts with
their full filename target, optionally using an ID label: `[[DEC-0008 Choose Ticketing
Vendor|DEC-0008]]`.

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
VAULT=$(bash scripts/resolve-vault.sh)

obsidian vault="$VAULT" search query="Ticketing Vendor"
# → nothing found, safe to create

# list AI/Decisions/ → highest existing is DEC-0007, so next is DEC-0008

obsidian vault="$VAULT" create name="DEC-0008 Choose Ticketing Vendor" \
  path="AI/Decisions/DEC-0008 Choose Ticketing Vendor.md" \
  template="Decision" silent

obsidian vault="$VAULT" property:set name="id" value="DEC-0008" path="AI/Decisions/DEC-0008 Choose Ticketing Vendor.md"
obsidian vault="$VAULT" property:set name="status" value="final" path="AI/Decisions/DEC-0008 Choose Ticketing Vendor.md"
obsidian vault="$VAULT" property:set name="implements" value="[[PLAN-0004 Ticketing Vendor Evaluation]]" path="AI/Decisions/DEC-0008 Choose Ticketing Vendor.md"

# and link back from the plan it implements
obsidian vault="$VAULT" property:set name="resulted_in" value="[[DEC-0008 Choose Ticketing Vendor]]" path="AI/Plans/PLAN-0004 Ticketing Vendor Evaluation.md"
```
