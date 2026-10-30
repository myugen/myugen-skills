#!/usr/bin/env bash
# Claude Stop adapter; successful tool activity, not old Git dirt, triggers capture feedback.
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$PLUGIN_ROOT/scripts/memory-hooks.py" Stop
exit 0
