#!/usr/bin/env bash
# Resolve which Obsidian vault to use for the current working directory.
#
# Reads ${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault/config.json and applies:
#   1. If $OBSIDIAN_VAULT is set, use it (explicit override, escape hatch).
#   2. Otherwise, find the working root: `git rev-parse --show-toplevel` if inside a repo,
#      else the current directory.
#   3. Among the config's "repositories" keys that are a prefix of that root, pick the
#      longest match and use its vault.
#   4. Otherwise, fall back to "defaultVault".
#
# Prints the resolved vault name on stdout. Exits non-zero with a message on stderr if the
# config file is missing or "defaultVault" is unset and nothing matched — see
# references/setup.md before retrying.
#
# Usage:
#   VAULT=$(scripts/resolve-vault.sh)
#   obsidian vault="$VAULT" search query="test"

set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/knowledge-vault"
CONFIG_FILE="$CONFIG_DIR/config.json"

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
