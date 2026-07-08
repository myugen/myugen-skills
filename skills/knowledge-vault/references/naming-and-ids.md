# Naming and ID conventions

## People / Teams / Projects / Foundation

Use a descriptive title matching how you'd naturally refer to the thing — this filename *is*
the link target, since these are linked by name rather than ID.

- `People/Jana Smith.md`
- `Teams/Ticketing Platform.md`
- `Projects/Vendor Migration.md`
- `Foundation/Incident Response Process.md`

Keep the title stable once created — renaming breaks every wikilink pointing to it if the
rename doesn't go through Obsidian itself (Obsidian updates links automatically on an in-app
rename; the CLI may not), so avoid renaming these once other notes link to them.

## AI artifacts (Plans / Decisions / Sessions)

These are numerous and referenced by ID more often than by title, so they get an ID prefix:

| Type     | Prefix  | Folder          |
|----------|---------|-----------------|
| Plan     | `PLAN-` | `AI/Plans/`     |
| Decision | `DEC-`  | `AI/Decisions/` |
| Session  | `SESS-` | `AI/Sessions/`  |

Filename format: `<PREFIX>-<NNNN> Short Title.md`, zero-padded to 4 digits, sequential per
prefix — e.g. `AI/Decisions/DEC-0007 Choose Ticketing Vendor.md`.

### Determining the next ID

1. List the target folder (e.g. `AI/Decisions/`) — a plain directory listing is fine here;
   it's a read with no conflict risk, so it doesn't need to go through the CLI.
2. Find the highest existing `<PREFIX>-<NNNN>` in use.
3. Increment by 1, zero-pad to 4 digits.
4. Do this immediately before creating the note, so the ID reflects the current state of the
   folder — don't pre-compute IDs ahead of time and hold onto them, since another note could
   be created in between.

### Making short links work

Set the ID alone as an `aliases` entry in frontmatter:

```yaml
aliases:
  - DEC-0007
```

This lets other notes link to it with the short form `[[DEC-0007]]` even though the actual
filename includes the full title. Obsidian resolves aliases to the real file automatically —
but only if `aliases` is an actual YAML list. Setting it via the CLI needs `type=list` or it
lands as a string and alias resolution silently fails:

```
obsidian vault="$VAULT" property:set name="aliases" value="DEC-0007" type=list file="<name>"
```

See `references/cli-usage.md` for the full `property:set` reference.

### Example

Creating the 8th decision on record:

1. List `AI/Decisions/` → highest existing is `DEC-0007` → next is `DEC-0008`.
2. Create `AI/Decisions/DEC-0008 Adopt New CRM.md` from the `Decision` template.
3. Set `id: DEC-0008` and `aliases: [DEC-0008]`.

