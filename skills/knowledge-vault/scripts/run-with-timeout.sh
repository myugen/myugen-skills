#!/usr/bin/env bash
# Run a command with a deadline on macOS or Linux without depending on timeout/gtimeout.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: run-with-timeout.sh <seconds> <command> [args...]" >&2
  exit 2
fi

DEADLINE="$1"
shift

exec python3 -c '
import os
import signal
import subprocess
import sys

try:
    deadline = float(sys.argv[1])
except ValueError:
    sys.stderr.write("error: timeout must be a number of seconds\n")
    sys.exit(2)

if deadline <= 0:
    sys.stderr.write("error: timeout must be greater than zero\n")
    sys.exit(2)

try:
    process = subprocess.Popen(sys.argv[2:], start_new_session=True)
except FileNotFoundError:
    sys.stderr.write(f"error: command not found: {sys.argv[2]}\n")
    sys.exit(127)

try:
    status = process.wait(timeout=deadline)
except subprocess.TimeoutExpired:
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()

    sys.exit(124)

sys.exit(status if status >= 0 else 128 - status)
' "$DEADLINE" "$@"
