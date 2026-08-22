#!/usr/bin/env bash
# Resolve which Obsidian vault to use for the current working directory.
#
# Applies this precedence:
#   1. $OBSIDIAN_VAULT (explicit override).
#   2. A valid primary knowledge-vault memory in the enclosing workspace's HUB.yml.
#   3. The longest matching repository prefix in the user-level config.json.
#   4. config.json's defaultVault.
# A malformed explicit workspace memory fails closed and never reaches the user-level fallback.
#
# Prints the resolved vault name on stdout. Exits non-zero with a message on stderr if the
# workspace declaration is malformed, or no fallback config can resolve a vault.
#
# Usage:
#   VAULT=$(scripts/resolve-vault.sh)
#   obsidian vault="$VAULT" search query="test"
#   scripts/resolve-vault.sh --workspace-owned  # lifecycle hooks: explicit workspace owns writes

set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault"
CONFIG_FILE="$CONFIG_DIR/config.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WORKSPACE_OWNED=0
case "${1:-}" in
  "") ;;
  --workspace-owned) WORKSPACE_OWNED=1 ;;
  *)
    echo "usage: resolve-vault.sh [--workspace-owned]" >&2
    exit 2
    ;;
esac

if [ "$WORKSPACE_OWNED" = "0" ] && [ -n "${OBSIDIAN_VAULT:-}" ]; then
  printf '%s\n' "$OBSIDIAN_VAULT"
  exit 0
fi

# Workspace memory is authoritative when present. A malformed declaration fails closed instead of
# silently routing writes to the user-level fallback vault.
MEMORY_JSON="$(python3 "$SCRIPT_DIR/resolve-workspace-memory.py" "$(pwd -P)")" || {
  echo "error: workspace memory resolver failed" >&2
  exit 1
}

MEMORY_STATUS="$(printf '%s' "$MEMORY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" || {
  echo "error: workspace memory resolver returned invalid output" >&2
  exit 1
}

case "$MEMORY_STATUS" in
  valid)
    printf '%s' "$MEMORY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["vault"])'
    exit 0
    ;;
  malformed)
    MESSAGE="$(printf '%s' "$MEMORY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("message", "invalid declaration"))')"
    echo "error: workspace memory is unusable: $MESSAGE" >&2
    exit 1
    ;;
  absent)
    ;;
  *)
    echo "error: workspace memory resolver returned unknown status '$MEMORY_STATUS'" >&2
    exit 1
    ;;
esac

# Hooks preserve legacy override behavior only when the workspace has not declared memory.
if [ -n "${OBSIDIAN_VAULT:-}" ]; then
  printf '%s\n' "$OBSIDIAN_VAULT"
  exit 0
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "error: no config found at $CONFIG_FILE" >&2
  echo "See skills/knowledge-vault/references/setup.md to create one." >&2
  exit 1
fi

WORKING_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

python3 - "$CONFIG_FILE" "$WORKING_ROOT" <<'PY'
import json
import sys

config_path, working_root = sys.argv[1], sys.argv[2]

with open(config_path) as f:
    config = json.load(f)

default_vault = config.get("defaultVault")
repositories = config.get("repositories", {})

best_match = None
best_len = -1
for repo_path, vault in repositories.items():
    normalized = repo_path.rstrip("/")
    if working_root == normalized or working_root.startswith(normalized + "/"):
        if len(normalized) > best_len:
            best_match, best_len = vault, len(normalized)

resolved = best_match or default_vault

if not resolved:
    sys.stderr.write(
        "error: no repository match and no defaultVault set in "
        + config_path
        + "\n"
    )
    sys.exit(1)

print(resolved)
PY
