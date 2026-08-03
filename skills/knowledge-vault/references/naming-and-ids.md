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

**`SESS-` is the exception: you never assign this ID yourself.** The `SessionEnd` hook assigns
`SESS-` IDs and creates the note automatically at the end of every session (title format
`SESS-NNNN <repo> <date>`) — see `SKILL.md`'s "Session notes are automatic" workflow. Everything
below in this file (computing the next ID, the alias trick) applies to `PLAN-` and `DEC-` only.

### Determining the next ID

1. List the target folder through the CLI, e.g.
   `obsidian vault="$VAULT" files folder="AI/Decisions"`.
2. Find the highest existing `<PREFIX>-<NNNN>` in use.
3. Increment by 1, zero-pad to 4 digits.
4. Do this immediately before creating the note, so the ID reflects the current state of the
   folder — don't pre-compute IDs ahead of time and hold onto them, since another note could
   be created in between.

### Linking AI artifacts

Use the actual filename as the link target. You can display the stable ID as its label:

```markdown
[[DEC-0007 Choose Ticketing Vendor|DEC-0007]]
```

Do not use `[[DEC-0007]]` as a shortcut: the CLI does not resolve frontmatter aliases when
targeting `file=`, and bare-ID links remain unresolved in backlinks. `path=` is safest when you
have a path from `files` or `search`.

Aliases on existing notes can remain as human-facing metadata, but they are not a reliable
linking or CLI-targeting mechanism. See `references/cli-usage.md` for targeting details.

### Example

Creating the 8th decision on record:

1. List `AI/Decisions/` → highest existing is `DEC-0007` → next is `DEC-0008`.
2. Create `AI/Decisions/DEC-0008 Adopt New CRM.md` from the `Decision` template.
3. Set `id: DEC-0008`, then link it elsewhere as `[[DEC-0008 Adopt New CRM|DEC-0008]]`.
