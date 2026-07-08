#!/usr/bin/env bash
# Print the next sequential ID for a given AI-artifact prefix (PLAN, DEC, SESS), by scanning
# the resolved vault's matching AI/ subfolder for the highest existing <PREFIX>-NNNN.
#
# Usage:
#   skills/knowledge-vault/scripts/next-id.sh SESS
#   -> SESS-0008
#
# Resolves the vault the same way resolve-vault.sh does ($OBSIDIAN_VAULT env var, or
# ~/.config/knowledge-vault/config.json). Requires the `obsidian` CLI to be reachable
# (Obsidian running) since it uses `obsidian vaults verbose` to find the vault's filesystem
# path.

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

VAULT_PATH="$(obsidian vaults verbose 2>/dev/null | awk -F'\t' -v v="$VAULT" '$1 == v { print $2 }')"

if [ -z "$VAULT_PATH" ]; then
  echo "error: vault '$VAULT' not found in \`obsidian vaults verbose\` output" >&2
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
