#!/usr/bin/env bash
# Claude SessionStart adapter; recall and lifecycle state share the portable vault resolver.
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$PLUGIN_ROOT/scripts/memory-hooks.py" SessionStart
exit 0
