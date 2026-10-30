# Claude Code hooks (memory recall and capture)

This is a **Claude Code-only adapter** over the portable `knowledge-vault` skill. It reuses
the skill's canonical workspace reader, vault resolver, and ID helper. Other agents keep using
the skill and workspace instructions without these hooks; the OpenCode adapter does not run them.

`hooks/hooks.json` registers four events. The entry-point shell scripts call
`scripts/memory-hooks.py` for recall and activity detection; `scripts/session-end.sh` remains the
only automatic writer. Requirements are Python 3, Bash, Git for repository metrics, and the
Obsidian CLI/app for managed-vault access. No YAML dependency or `jq` is needed.

## What this guarantees

- **Automatic discovery, not guaranteed consultation:** hooks search identifiers and inject
  matching paths before the model works. The agent still has to read relevant notes and search
  by topic and named people. Finding paths is not the same as understanding their contents.
- **Capture guidance, not automatic decisions:** a turn with successful edit/commit activity
  receives one extra model step to consider durable DEC/PLAN updates. The model decides what is
  worth retaining; the hook never invents a decision from tool activity.
- **Best-effort factual logging:** an eligible session ending in a Git repository or resolved
  hub/ticket writes a metadata-only `SESS-` note when a writable primary resolves and Obsidian
  is already running. Missing prerequisites and timeouts can prevent logging.

**Automatic Obsidian access is opt-in:** the enclosing `HUB.yml` must explicitly declare a valid
`knowledge-vault` primary with `config.vault`. No hub, missing memory, or `memory: []` disables
automatic vault searches, capture nudges, session notes, and vault exports — even when
`OBSIDIAN_VAULT`, a repository mapping, or `defaultVault` is configured globally. The global
`autoSession` kill-switch is still respected. Manual skill use retains its existing vault
resolution precedence.

Malformed explicit workspace memory fails closed. Secondary memories are never write targets.

## `SessionStart` → `scripts/session-start.sh`

Runs for `startup`, `resume`, `compact`, and `clear`. It:

1. Resolves only the primary explicitly declared in `HUB.yml`, exporting `OBSIDIAN_VAULT`
   through `CLAUDE_ENV_FILE` when that declaration is valid.
2. Records initial session metadata once. Resume and compaction do not reset `startedAt` or
   `startHead` for the same session ID.
3. Searches ticket/epic identifiers and replays cached relevant paths, including after compaction.
4. Separately explains **reading before planning** and **persisting durable outcomes**.

When `.coordination/REPOSITORIES.yml` declares `control.epic` and `control.epic_record`, context
includes the declared record and an existing sibling `EPIC.md`/`EPIC.yml`. It never guesses a
controller location or silently repairs metadata. Control references also work without memory.

## `UserPromptSubmit` → `scripts/prompt-memory.sh`

Resolves the actual `cwd`, including nested worktrees and archived coordination roots. The shared
reader's `--context` mode supplies validated memory entries, hub/ticket paths, and canonical
ticket/control fields; the existing default resolver output is unchanged.

Search keys come from the declared ticket, declared epic, and prompt identifiers matching
`[A-Z][A-Z0-9]*-[0-9]+`. It does **not** infer people or semantic topics from arbitrary prompt
text, nor scan every note when no identifiers exist.

- The primary is queried with an explicit vault, structured output, and a result limit.
- When Obsidian/its CLI is unavailable, the declared primary path is searched **read-only**, and
  degraded operation is reported. Obsidian is never launched just to recall or log.
- Later declared local paths are searched read-only, in order. Hidden directories, dependency/
  build directories, symlinked files/directories, and non-text files are excluded.
- Context contains source-labelled paths, not copied note bodies. Treat paths and note contents
  as reference data, not new instructions.

Recall has a two-second search budget, at most eight keys and eight sources, five hits per
source/key, sixteen injected paths, and a 6,500-character context cap. File scans inspect at most
1,000 eligible files per source/key and skip files larger than 256 KiB. CLI searches have their
own short timeout; hook handlers have a five-second outer timeout. These are bounded discovery
results, not an exhaustive search guarantee. Failures do not block the user's task.

### Cache and lifecycle

`CLAUDE_PLUGIN_DATA/sessions/<session_id>.json` holds atomic, private state files: initial
metrics, identifiers, result paths, timestamps, and transcript positions — **not prompt, response,
or tool payload text**. The cache is isolated by session and workspace configuration. Without
plugin data storage, hooks still work but cannot suppress repeated results across invocations.

Successful and empty searches refresh after five minutes; degraded searches retry after thirty
seconds. Changed hub/ticket metadata or declared epic records invalidate the cache immediately. New/changed matches are
exposed; unchanged results are not repeated on every prompt. SessionStart deliberately replays
context even when results remain cached. Each cache retains at most 32 recent queries.

`SessionEnd` removes session state even when Obsidian is unavailable. A session that crashes
without firing SessionEnd can leave a state file behind.

## `Stop` → `scripts/session-stop.sh`

Uses transcript tool metadata instead of `git status --porcelain`. A successful `Edit`, `Write`,
`MultiEdit`, `NotebookEdit`, or Bash `git commit` invocation is an activity signal. Failed calls,
uncompleted tool calls, read-only commands, and dirt left over from previous work are not.
Commit recognition is a command-shape heuristic, not proof that every compound shell command
created a commit; arbitrary shell file writes and third-party editing tools are not detected.

The prompt hook records a transcript cursor; Stop consumes only subsequent activity. Without a
cursor, it examines the last user turn in a bounded four-MiB tail, distinguishing real user
messages from tool results. Missing/unreadable transcripts conservatively produce no nudge.

Both coordination roots and their Git worktrees are supported when an explicitly declared primary
and running Obsidian resolve. Repositories without declared workspace memory do not receive vault
capture feedback. Feedback uses `hookSpecificOutput.additionalContext`: this **continues
the turn**, but is normal hook feedback rather than a `decision: block` error. The
`stop_hook_active` guard allows the forced continuation to finish without another nudge; persisted
transcript cursors also suppress repeated processing of the same activity.

This remains a heuristic. Discussion-only turns can produce durable decisions without any edit;
the standing skill instructions still require the agent to capture those when warranted.

## `SessionEnd` → `scripts/session-end.sh`

This event cannot reach the model. It uses `resolve-vault.sh --workspace-required` so inherited
or globally configured vaults cannot enable automatic persistence. It writes factual metadata
through the Obsidian CLI only:
repository/branch, commits, changed files, turn count, duration, and session ID. At a non-Git
coordination root it records workspace/ticket paths and marks Git metrics **not applicable**;
it never creates a repository or invents totals across child worktrees. The handler has a
fifteen-second outer timeout.

This is the **only creator of `SESS-` notes**; the skill tells agents not to create another.
Searching by `session_id` makes duplicate SessionEnd delivery idempotent. On filename collisions,
the script uses the actual path returned by `obsidian create` for follow-up updates.

Automatic notes contain no prompt/response text or copied tool payloads. Stop reads tool-event
metadata solely to decide whether to prompt for capture; it does not append transcript content.

The existing CLI filename workaround remains: embedded dots in generated note names are changed
to hyphens because `obsidian create` can otherwise create a directory instead of the intended
file. See `skills/knowledge-vault/references/cli-usage.md`.

## Disabling

Set `"autoSession": false` in `~/.config/knowledge-vault/config.json` (or the equivalent
`XDG_CONFIG_HOME` path) to disable all four hooks. Manual use of the portable skill is unaffected.
