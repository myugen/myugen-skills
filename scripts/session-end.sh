#!/usr/bin/env bash
# SessionEnd hook: deterministically write a metadata-only session note (repo, branch, commit
# count, duration, turn count) to the vault — regardless of whether the model wrote anything
# to the vault itself this session. Pure side effect: SessionEnd cannot reach the model, and
# this script must not either (no prompt/response text is ever included).
#
# This is the ONLY place SESS- notes get created — the knowledge-vault skill instructs the
# model never to create one itself (see SKILL.md's "Session notes are automatic"), so a
# session should end up with exactly one SESS- note. Two safeguards enforce that here:
#   - idempotent by session_id: if a note already records this session_id (e.g. SessionEnd
#     fired twice for the same session), refresh it instead of creating a second one.
#   - collision-safe creation: next-id.sh doesn't reserve the ID it hands out (two sessions
#     ending at nearly the same instant can be handed the same NEXT_ID), and `obsidian create`
#     doesn't error on that — it silently auto-suffixes the filename. This script reads back
#     the path `create` actually used rather than assuming the one it asked for, so every
#     follow-up command targets the real file.
#
# Reads the SessionEnd event JSON from stdin. Always exits 0 — must never break session
# teardown; failures are swallowed to stderr for the debug log.

set -uo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KV_SCRIPTS="$PLUGIN_ROOT/skills/knowledge-vault/scripts"

INPUT="$(cat)"

read_field() {
  python3 -c "import json,sys; print(json.load(sys.stdin).get('$1',''))" 2>/dev/null <<< "$INPUT"
}

SESSION_ID="$(read_field session_id)"
TRANSCRIPT_PATH="$(read_field transcript_path)"
CWD="$(read_field cwd)"
[ -n "$CWD" ] || CWD="$(pwd)"

cleanup_state() {
  if [ -n "${CLAUDE_PLUGIN_DATA:-}" ] && [[ "$SESSION_ID" =~ ^[A-Za-z0-9_-]{1,160}$ ]]; then
    rm -f "$CLAUDE_PLUGIN_DATA/sessions/$SESSION_ID.json" 2>/dev/null
  fi
}
trap cleanup_state EXIT

# Respect the autoSession kill-switch.
CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault/config.json"
if [ -f "$CONFIG_FILE" ]; then
  AUTO_SESSION="$(python3 -c 'import json,sys
try:
    print(json.load(open(sys.argv[1])).get("autoSession", True))
except Exception:
    print(True)' "$CONFIG_FILE" 2>/dev/null)"
  if [ "$AUTO_SESSION" = "False" ]; then
    exit 0
  fi
fi

# Automatic persistence requires an explicit HUB.yml primary. Environment overrides and
# user-level fallback vaults remain available only for manual skill use.
VAULT="$(cd "$CWD" 2>/dev/null && "$KV_SCRIPTS/resolve-vault.sh" --workspace-required 2>/dev/null)"
[ -z "$VAULT" ] && exit 0

# Never launch Obsidian just to log — if it's not already running, skip silently.
pgrep -x Obsidian >/dev/null 2>&1 || exit 0

WORKSPACE_ROOT=""
TICKET_ROOT=""
IS_GIT_REPO=0
if (cd "$CWD" 2>/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1); then
  IS_GIT_REPO=1
  REPO_NAME="$(cd "$CWD" && basename "$(git rev-parse --show-toplevel)")"
  BRANCH="$(cd "$CWD" && git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  END_HEAD="$(cd "$CWD" && git rev-parse HEAD 2>/dev/null)"
else
  # Coordination roots are intentionally not repositories. Use declared workspace metadata,
  # never initialize Git or infer aggregate commit counts across child worktrees.
  MEMORY_JSON="$(python3 "$KV_SCRIPTS/resolve-workspace-memory.py" --context "$CWD" 2>/dev/null)"
  WORKSPACE_ROOT="$(printf '%s' "$MEMORY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("hub", ""))' 2>/dev/null)"
  TICKET_ROOT="$(printf '%s' "$MEMORY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ticket_root", ""))' 2>/dev/null)"
  [ -n "$WORKSPACE_ROOT" ] || exit 0
  COORDINATION_ROOT="${TICKET_ROOT:-$(dirname "$WORKSPACE_ROOT")}"
  REPO_NAME="$(basename "$COORDINATION_ROOT")"
  BRANCH="not-applicable (coordination workspace)"
  END_HEAD=""
fi
TODAY="$(date -u +%Y-%m-%d)"

# Load start-of-session state, if session-start.sh stashed one.
STARTED_AT=""
START_HEAD=""
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ] && [ -n "$SESSION_ID" ]; then
  STATE_FILE="$CLAUDE_PLUGIN_DATA/sessions/$SESSION_ID.json"
  if [[ "$SESSION_ID" =~ ^[A-Za-z0-9_-]{1,160}$ ]] && [ -f "$STATE_FILE" ]; then
    STARTED_AT="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('startedAt',''))" "$STATE_FILE" 2>/dev/null)"
    START_HEAD="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('startHead',''))" "$STATE_FILE" 2>/dev/null)"
  fi
fi

COMMIT_COUNT="not-applicable"
[ "$IS_GIT_REPO" = "1" ] && COMMIT_COUNT=0
if [ "$IS_GIT_REPO" = "1" ] && [ -n "$START_HEAD" ] && [ -n "$END_HEAD" ] && [ "$START_HEAD" != "$END_HEAD" ]; then
  COMMIT_COUNT="$(cd "$CWD" && git rev-list --count "$START_HEAD..$END_HEAD" 2>/dev/null || echo 0)"
fi

CHANGED_FILES="not-applicable"
[ "$IS_GIT_REPO" = "1" ] && CHANGED_FILES=0
if [ "$IS_GIT_REPO" = "1" ] && [ -n "$START_HEAD" ] && [ -n "$END_HEAD" ]; then
  CHANGED_FILES="$(cd "$CWD" && git diff --name-only "$START_HEAD" "$END_HEAD" 2>/dev/null | wc -l | tr -d ' ')"
fi

TURN_COUNT=0
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  TURN_COUNT="$(python3 - "$TRANSCRIPT_PATH" <<'PYEOF' 2>/dev/null
import json, sys
count = 0
try:
    with open(sys.argv[1]) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue
            if not isinstance(entry, dict) or entry.get('type') != 'user':
                continue
            message = entry.get('message', {})
            content = message.get('content', []) if isinstance(message, dict) else []
            if isinstance(content, str) or (isinstance(content, list) and any(
                isinstance(block, dict) and block.get('type') == 'text' for block in content
            )):
                count += 1
except Exception:
    pass
print(count)
PYEOF
)"
  [ -n "$TURN_COUNT" ] || TURN_COUNT=0
fi

ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Idempotency guard: if a SESS- note already records this exact session_id (e.g. SessionEnd
# fired more than once for the same session), don't write a second one — just refresh its
# `updated` date and stop. The note body always contains a literal "session_id: <id>" line, so
# a plain content search finds it. `search --format=json` returns a JSON array of matching
# paths (or the plain-text string "No matches found." when there's nothing).
if [ -n "$SESSION_ID" ]; then
  SEARCH_OUT="$(obsidian vault="$VAULT" search query="$SESSION_ID" path="AI/Sessions" format=json 2>/dev/null)"
  EXISTING_PATH="$(python3 -c "
import json, sys
try:
    matches = json.loads(sys.argv[1])
    print(matches[0] if isinstance(matches, list) and matches else '')
except Exception:
    print('')
" "$SEARCH_OUT" 2>/dev/null)"
  if [ -n "$EXISTING_PATH" ]; then
    obsidian vault="$VAULT" property:set name="updated" value="$TODAY" type=date path="$EXISTING_PATH" >/dev/null 2>&1
    exit 0
  fi
fi

NEXT_ID="$(OBSIDIAN_VAULT="$VAULT" "$KV_SCRIPTS/next-id.sh" SESS 2>/dev/null)"
[ -n "$NEXT_ID" ] || exit 0

# Sanitize the repo name for use in the note's filename: a dot anywhere before the final .md
# makes the `obsidian create` CLI create a directory instead of a file (confirmed by testing —
# it truncates the name at the first embedded dot). Repo directory names commonly contain dots
# (scratch dirs, dotted project names), so this isn't an edge case. The unsanitized name is
# still used as-is in the note's body text below.
SAFE_REPO_NAME="$(printf '%s' "$REPO_NAME" | tr '.' '-')"

TITLE="$NEXT_ID $SAFE_REPO_NAME $TODAY"
NOTE_PATH="AI/Sessions/$TITLE.md"

# `next-id.sh` reserves nothing — it just scans the folder (see its header comment) — so two
# sessions ending at nearly the same moment can compute the same NEXT_ID. `obsidian create`
# doesn't error or overwrite on a name collision, it auto-suffixes ("... 1.md", "... 2.md", …)
# and reports the path it actually used. Read that back instead of assuming $TITLE/$NOTE_PATH,
# so the property:set/append calls below always target the file that was really created.
CREATE_OUT="$(obsidian vault="$VAULT" create name="$TITLE" path="$NOTE_PATH" template="Session" silent 2>&1)"
[ $? -eq 0 ] || exit 0

ACTUAL_PATH="$(printf '%s\n' "$CREATE_OUT" | sed -n 's/^Created: //p' | head -n1)"
[ -n "$ACTUAL_PATH" ] || ACTUAL_PATH="$NOTE_PATH"

obsidian vault="$VAULT" property:set name="id" value="$NEXT_ID" path="$ACTUAL_PATH" >/dev/null 2>&1
obsidian vault="$VAULT" property:set name="date" value="$TODAY" type=date path="$ACTUAL_PATH" >/dev/null 2>&1

BODY="## What happened

- repo: $REPO_NAME
- branch: $BRANCH
- commits: $COMMIT_COUNT
- files changed: $CHANGED_FILES
- turns: $TURN_COUNT
- started: ${STARTED_AT:-unknown}
- ended: $ENDED_AT
- session_id: ${SESSION_ID:-unknown}

Recorded automatically by the knowledge-vault plugin hooks (metadata only — no prompt/response content)."

if [ -n "$WORKSPACE_ROOT" ]; then
  BODY="$BODY

- workspace hub: $WORKSPACE_ROOT
- ticket workspace: ${TICKET_ROOT:-not-applicable}"
fi

obsidian vault="$VAULT" append path="$ACTUAL_PATH" content="$BODY" >/dev/null 2>&1

exit 0
