#!/usr/bin/env bash
# Append UTF-8 file content to an exact vault-relative note path.

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: append-file.sh <vault> <note-path> <content-file>" >&2
  exit 2
fi

VAULT="$1"
NOTE_PATH="$2"
CONTENT_FILE="$3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$CONTENT_FILE" ]; then
  echo "error: content file not found: $CONTENT_FILE" >&2
  exit 1
fi

CONTENT="$(python3 - "$CONTENT_FILE" <<'PY'
from pathlib import Path
import sys

content = Path(sys.argv[1]).read_text(encoding="utf-8")
if "\0" in content:
    sys.stderr.write("error: content file contains a NUL byte\n")
    sys.exit(1)

print(
    content.replace("\\", "\\\\").replace("\n", "\\n").replace("\t", "\\t"),
    end="",
)
PY
)"

"$SCRIPT_DIR/run-with-timeout.sh" "${KV_TIMEOUT_SECONDS:-30}" \
  obsidian "vault=$VAULT" append "path=$NOTE_PATH" "content=$CONTENT"
