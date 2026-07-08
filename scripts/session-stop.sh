#!/usr/bin/env bash
# Stop hook: force one extra step to persist notable context (decisions/plans) to the vault
# before the turn ends, but only when there's a real signal something happened, and never
# twice in a row (guarded by stop_hook_active) — so this can't create an infinite loop.
#
# Reads the Stop event JSON from stdin. Exits 0 with no output to allow the stop; prints a
# {"decision":"block",...} JSON to force one more model step.

set -uo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOLVE_VAULT="$PLUGIN_ROOT/skills/knowledge-vault/scripts/resolve-vault.sh"

INPUT="$(cat)"

read_field() {
  python3 -c "import json,sys; print(json.load(sys.stdin).get('$1',''))" 2>/dev/null <<< "$INPUT"
}

STOP_HOOK_ACTIVE="$(read_field stop_hook_active)"
CWD="$(read_field cwd)"
[ -n "$CWD" ] || CWD="$(pwd)"

# Never block twice in a row — this run IS the forced continuation from a previous block.
if [ "$STOP_HOOK_ACTIVE" = "True" ]; then
  exit 0
fi

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

# Only nudge when there's a real git repo with actual uncommitted change this turn.
if ! (cd "$CWD" 2>/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1); then
  exit 0
fi

if [ -z "$(cd "$CWD" && git status --porcelain 2>/dev/null)" ]; then
  exit 0
fi

VAULT="$(cd "$CWD" 2>/dev/null && "$RESOLVE_VAULT" 2>/dev/null)"
[ -n "$VAULT" ] || exit 0

pgrep -x Obsidian >/dev/null 2>&1 || exit 0

# NOTE: "reason" is shown to the *user*, not Claude — it does not influence the model. The
# actionable instruction has to go in hookSpecificOutput.additionalContext, which Claude reads
# and can act on before stopping.
python3 <<'PYEOF'
import json
print(json.dumps({
    "decision": "block",
    "reason": "Checking whether anything from this turn should be persisted to the knowledge vault.",
    "hookSpecificOutput": {
        "hookEventName": "Stop",
        "additionalContext": (
            "Before finishing: if any decisions, plans, or durable context emerged this turn, "
            "persist them to the vault now via the knowledge-vault skill (DEC/PLAN notes as "
            "appropriate). If nothing from this turn is worth recording, just stop."
        ),
    },
}))
PYEOF
