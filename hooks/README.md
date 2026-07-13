# Claude Code hooks (automatic vault capture)

This directory is a **Claude Code-only layer** on top of the agent-agnostic `knowledge-vault`
skill (`skills/knowledge-vault/`). The skill itself works with any agent that reads
`SKILL.md`, but skills are *model-invoked* — Claude decides whether to use one. In practice,
during heads-down coding sessions it often doesn't, so nothing gets captured: no session
record, no decisions, no plans.

Hooks fire **deterministically** on Claude Code lifecycle events regardless of the model's
discretion, so they're the only way to make part of this automatic. `hooks/hooks.json` wires
three events to the scripts in `scripts/`, which reuse the skill's own
`skills/knowledge-vault/scripts/resolve-vault.sh` and `next-id.sh` rather than duplicating
vault logic.

## What's deterministic vs. model-authored

Be precise about what this actually guarantees:

- **Fully deterministic:** a factual session note (repo, branch, commit count, files changed,
  duration, turn count) gets written at session end, no matter what the model did or didn't do.
  A shell script can't fail to do this out of distraction.
- **Reliably prompted, not guaranteed:** the *content* that matters most — decisions, plans,
  rationale — needs judgment a shell script can't fake. Hooks make Claude *aware* it should
  capture that (at session start) and *force one extra step* to do so before ending a turn with
  uncommitted changes (at stop), but the actual DEC/PLAN note is still written by the model via
  the skill. This is "reliably nudged," not "impossible to skip."

## The three hooks

### `SessionStart` → `scripts/session-start.sh`

Runs on session start/resume. Resolves the vault for the session's working directory,
exports `OBSIDIAN_VAULT` for the rest of the session (via `$CLAUDE_ENV_FILE`, so every
`obsidian` command auto-targets the right vault without re-resolving), stashes start-of-session
state (start commit, timestamp) for `session-end.sh`, and injects standing instructions into
Claude's context: which repo/branch/vault this session is linked to, and that decisions/plans
should be captured as they happen.

No-ops silently (exits 0, no output) if there's no vault config yet, `autoSession: false` is
set, or the directory isn't a git repo — never nags.

### `Stop` → `scripts/session-stop.sh`

Runs when Claude finishes responding to a turn. If the working tree actually changed this turn
(not just "a session is open") and the vault + Obsidian are both reachable, it forces one more
model step via `{"decision": "block", "hookSpecificOutput": {"additionalContext": "..."}}`
asking Claude to persist anything notable, then get out of the way.

**Loop safety:** guarded by the `stop_hook_active` field Claude Code sets on the input JSON
when a turn is already continuing because of a previous Stop-hook block — this hook always
allows the stop on that second pass, so it can never nudge twice in a row for the same turn.
Claude Code also has its own hard cap (8 consecutive blocks) as a backstop.

If this proves too aggressive in practice, the fix is to drop `"decision": "block"` and keep
only `hookSpecificOutput.additionalContext` (non-blocking feedback Claude can act on or not).

### `SessionEnd` → `scripts/session-end.sh`

Runs when a session terminates. This event **cannot reach the model at all** — it's pure side
effect, which is exactly why it's the right place for the deterministic part: it writes a
`SESS-NNNN` note via the `obsidian` CLI unconditionally (repo, branch, commit count computed
from the stashed start commit, files changed, turn count from the transcript, duration).

**Metadata only, by design** — no prompt or response text is ever read or written. This keeps
the automatic note safe to write even for sessions touching sensitive code, and keeps the
vault's session log skimmable rather than a transcript dump.

Never launches Obsidian just to log — if it's not already running, this no-ops.

**This is the only source of `SESS-` notes.** The `knowledge-vault` skill instructs the model
never to create a Session note itself (see `SKILL.md`'s "Session notes are automatic"), so a
session should always end with exactly one note. The script itself guards against the two ways
that could still slip:

- **Idempotent by `session_id`.** Before creating, it searches `AI/Sessions/` for a note whose
  body already contains this session's `session_id` (every note includes one). If found, it
  refreshes that note's `updated` date instead of writing a second one — covers `SessionEnd`
  firing more than once for the same session.
- **Collision-safe creation.** `next-id.sh` hands out the next ID by scanning the folder, with
  no locking — two sessions ending close together can be handed the same ID. `obsidian create`
  doesn't error on a resulting name collision, it silently auto-suffixes the file (`... 1.md`).
  The script reads back the path `create` actually reports and uses that for every follow-up
  `property:set`/`append`, instead of assuming the name it originally asked for.

Note that a `session_id` changes across some session boundaries (e.g. auto-compaction) even
when a human would call it "the same work session" — so this guards against literal double-fire
for one `session_id`, not against getting more than one note across a day of resumes. That's a
known, accepted shape of the log (one accurate note per Claude Code session), not a bug.

## Known CLI gotcha this code works around

The `obsidian create` CLI creates a **directory** instead of a file if the note's `name=`/
`path=` contains a dot before the final `.md` (confirmed by testing) — common repo directory
names (scratch dirs, dotted project names) would silently produce a broken note. `session-end.sh`
sanitizes the repo name (dots → hyphens) before using it in the note's filename; the
unsanitized name is still used in the note's body text. See the same note in
`skills/knowledge-vault/references/cli-usage.md`.

## Disabling

Set `"autoSession": false` in `~/.config/knowledge-vault/config.json` to turn off all three
hooks without removing the config or uninstalling the plugin. See
`skills/knowledge-vault/references/setup.md`.
