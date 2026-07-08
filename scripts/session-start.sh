#!/usr/bin/env bash
# SessionStart hook: resolve the vault for this session's working directory, export it so
# every `obsidian` command this session auto-targets the right vault, stash start-of-session
# state for session-end.sh, and inject standing capture instructions into the model's context.
#
# Reads the SessionStart event JSON from stdin. Always exits 0 — this hook must never block a
# session from starting, and its job is best-effort context, not a hard requirement.

set -uo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOLVE_VAULT="$PLUGIN_ROOT/skills/knowledge-vault/scripts/resolve-vault.sh"

INPUT="$(cat)"

CWD="$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))' 2>/dev/null)"
SESSION_ID="$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null)"

[ -n "$CWD" ] || CWD="$(pwd)"

# Respect the autoSession kill-switch (config.json: {"autoSession": false}).
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

VAULT="$(cd "$CWD" 2>/dev/null && "$RESOLVE_VAULT" 2>/dev/null)"

if [ -z "$VAULT" ]; then
  # No config yet — stay silent rather than nagging every session start.
  exit 0
fi

# Persist OBSIDIAN_VAULT for the rest of the session, so every `obsidian` call auto-targets it.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  printf 'export OBSIDIAN_VAULT=%q\n' "$VAULT" >> "$CLAUDE_ENV_FILE"
fi

REPO_NAME="$(cd "$CWD" 2>/dev/null && basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)"
BRANCH="$(cd "$CWD" 2>/dev/null && git rev-parse --abbrev-ref HEAD 2>/dev/null)"
IS_GIT_REPO=0
[ -n "$REPO_NAME" ] && IS_GIT_REPO=1

# Stash state for session-end.sh (best effort; only meaningful inside a git repo).
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ] && [ "$IS_GIT_REPO" = "1" ] && [ -n "$SESSION_ID" ]; then
  STATE_DIR="$CLAUDE_PLUGIN_DATA/sessions"
  mkdir -p "$STATE_DIR" 2>/dev/null
  START_HEAD="$(cd "$CWD" && git rev-parse HEAD 2>/dev/null)"
  STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  python3 - "$STATE_DIR/$SESSION_ID.json" "$STARTED_AT" "$START_HEAD" "$BRANCH" "$REPO_NAME" "$VAULT" "$CWD" <<'PYEOF' 2>/dev/null
import json, sys
out, started_at, start_head, branch, repo, vault, cwd = sys.argv[1:8]
data = {
    "startedAt": started_at,
    "startHead": start_head,
    "branch": branch,
    "repo": repo,
    "vault": vault,
    "cwd": cwd,
}
with open(out, "w") as f:
    json.dump(data, f)
PYEOF
fi

OBSIDIAN_RUNNING=0
pgrep -x Obsidian >/dev/null 2>&1 && OBSIDIAN_RUNNING=1

if [ "$IS_GIT_REPO" = "1" ]; then
  CONTEXT="This session works in the \`$REPO_NAME\` repo (branch \`$BRANCH\`), linked to Obsidian vault \`$VAULT\`. The knowledge-vault skill is available — capture decisions as DEC notes and plans as PLAN notes as they happen. A factual session note is recorded automatically when this session ends."
else
  CONTEXT="This session is linked to Obsidian vault \`$VAULT\`. The knowledge-vault skill is available for capturing decisions, plans, and durable knowledge as they come up."
fi

if [ "$OBSIDIAN_RUNNING" = "0" ]; then
  CONTEXT="$CONTEXT Note: Obsidian doesn't appear to be running right now, so vault writes will silently no-op until it's open."
fi

python3 - "$CONTEXT" <<'PYEOF'
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": sys.argv[1],
    }
}))
PYEOF

exit 0
