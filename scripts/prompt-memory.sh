#!/usr/bin/env bash
# Claude UserPromptSubmit adapter: bounded read-only recall before the model sees the prompt.
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$PLUGIN_ROOT/scripts/memory-hooks.py" UserPromptSubmit
exit 0
