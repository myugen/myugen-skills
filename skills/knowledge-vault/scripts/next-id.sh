#!/usr/bin/env bash
# Print the next sequential ID for a given AI-artifact prefix (PLAN, DEC, SESS), by scanning
# the resolved vault's matching AI/ subfolder for the highest existing <PREFIX>-NNNN.
#
# This does NOT reserve the ID — it's a point-in-time read with no lock, so two callers running
# close together can be handed the same next ID (documented in
# skills/knowledge-vault/references/naming-and-ids.md). Callers are responsible for tolerating
# that: `scripts/session-end.sh` handles it by reading back the path `obsidian create` actually
# used (it auto-suffixes on a name collision rather than erroring) instead of assuming the ID
# it was handed is unique.
#
# Usage:
#   skills/knowledge-vault/scripts/next-id.sh SESS
#   -> SESS-0008
#
# Resolves the vault the same way resolve-vault.sh does ($OBSIDIAN_VAULT env var, or
# ~/.config/knowledge-vault/config.json). Requires the `obsidian` CLI to be reachable
# (Obsidian running) since it uses `obsidian vault info=path` to find the selected vault's
# filesystem path.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PREFIX="${1:-}"
if [ -z "$PREFIX" ]; then
  echo "usage: next-id.sh <PREFIX>  (e.g. PLAN, DEC, SESS)" >&2
  exit 1
fi

case "$PREFIX" in
  PLAN) FOLDER="Plans" ;;
  DEC) FOLDER="Decisions" ;;
  SESS) FOLDER="Sessions" ;;
  *)
    echo "error: unknown prefix '$PREFIX' (expected PLAN, DEC, or SESS)" >&2
    exit 1
    ;;
esac

VAULT="$("$SCRIPT_DIR/resolve-vault.sh")"

if ! VAULT_PATH="$("$SCRIPT_DIR/run-with-timeout.sh" "${KV_TIMEOUT_SECONDS:-30}" \
  obsidian "vault=$VAULT" vault info=path)"; then
  echo "error: could not obtain the path for vault '$VAULT' with \`vault info=path\`" >&2
  exit 1
fi

if [ -z "$VAULT_PATH" ]; then
  echo "error: vault '$VAULT' returned no path from \`vault info=path\`" >&2
  exit 1
fi

TARGET_DIR="$VAULT_PATH/AI/$FOLDER"

HIGHEST=0
if [ -d "$TARGET_DIR" ]; then
  while IFS= read -r name; do
    num="${name#"$PREFIX"-}"
    num="${num%%[^0-9]*}"
    if [ -n "$num" ]; then
      num=$((10#$num))
      if [ "$num" -gt "$HIGHEST" ]; then
        HIGHEST=$num
      fi
    fi
  done < <(find "$TARGET_DIR" -maxdepth 1 -type f -name "${PREFIX}-*.md" -exec basename {} \; 2>/dev/null)
fi

NEXT=$((HIGHEST + 1))
printf '%s-%04d\n' "$PREFIX" "$NEXT"
