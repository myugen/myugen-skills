# Setup

One-time setup to get the `obsidian` CLI and this skill's config working. Run through this
whenever the health-check in `SKILL.md`/`cli-usage.md` fails, or when setting this skill up on
a new machine.

## 1. Requirements

- Obsidian desktop app, installed via the **1.12.7+ installer** (the CLI ships bundled with
  the app from that version on — it isn't a separate package-manager install).
- The vault you want to use already created and opened at least once in the app.

## 2. Enable the CLI

In Obsidian: **Settings → General → Command line interface**, then follow the prompt to
register the CLI (this adds it to your `PATH`). Restart your terminal afterward so the new
`PATH` takes effect.

## 3. Verify the CLI is working

```
obsidian version
obsidian vaults verbose
```

- `obsidian version` confirms the CLI is installed and can reach Obsidian (Obsidian must be
  running — the first command launches it if it isn't).
- `obsidian vaults verbose` lists every vault Obsidian knows about, by name, with its path.
  Note the exact name of the vault you'll use — that's the value that goes in `config.json`
  and every `vault=` parameter. No plugin or API key is required; the CLI talks to the app
  directly.

## 4. Create the config file

This skill resolves which vault to use from a small JSON file kept **outside any project
repo**, so nothing about vault selection ever gets committed to code you work on:

```
${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault/config.json
```

Create the directory and copy the example shipped with this skill:

```sh
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault"
cp assets/config.example.json "${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault/config.json"
```

Then edit it:

```json
{
  "defaultVault": "Personal Knowledge",
  "repositories": {
    "/Users/you/dev/myugen": "Myugen",
    "/Users/you/dev/acme": "Acme Org"
  },
  "autoSession": true
}
```

- `defaultVault` (required) — the vault name (exactly as shown by `obsidian vaults`) used when
  nothing more specific matches. Set this even if you only ever use one vault.
- `repositories` (optional) — maps a directory path to a vault name, so work done inside that
  directory (or any of its subdirectories) targets that vault instead of the default. Keys can
  be a repo root or any ancestor directory. When more than one key matches, the longest
  (most specific) one wins.
- `autoSession` (optional, default `true`) — kill-switch for the Claude Code plugin's automatic
  hooks (session-start context, the stop-time capture nudge, and the auto-written session
  note). Set to `false` to disable all three without deleting this file. Only relevant if
  you're using the plugin's hooks — see `hooks/README.md` at the repo root; it doesn't affect
  manual use of the skill itself.

See `references/cli-usage.md` for exactly how this file is read at the start of every vault
operation.

## 5. Install the note templates

The vault's `Templates/` folder needs this skill's templates so `obsidian create ...
template="Decision"` (etc.) works:

1. Copy every file from this skill's `assets/templates/` into the vault's `Templates/` folder
   (create that folder first if it doesn't exist).
2. In Obsidian, enable the core **Templates** plugin (Settings → Core plugins) and set its
   "Template folder location" to `Templates/`. This is what makes `{{date}}` and `{{title}}`
   in the template files resolve when a note is created.

## 6. Health-check

Run this before the first write in a fresh environment:

```sh
scripts/resolve-vault.sh                                   # prints the resolved vault name
obsidian vault="$(scripts/resolve-vault.sh)" vault info=name  # confirms it's reachable
obsidian vault="$(scripts/resolve-vault.sh)" search query="test"
```

If `resolve-vault.sh` exits non-zero, re-check step 4 (the config file). If `vault info=name`
fails or returns the wrong vault, re-check the exact name against `obsidian vaults verbose`.
