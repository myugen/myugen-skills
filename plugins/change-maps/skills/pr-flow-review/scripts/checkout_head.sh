#!/usr/bin/env bash
# Make the code at the PR head readable without touching the user's checkout.
#
# Usage: checkout_head.sh <workdir>            (after fetch_pr.sh wrote <workdir>/pr.json)
#        checkout_head.sh --cleanup <workdir>  (remove what the first call created)
#
# Where the code comes from, in order:
#   1. the current repository, when it is the PR's repository and HEAD is the PR head: used as is
#   2. the current repository, when it is the PR's repository: detached worktree in <workdir>/src
#   3. a sibling folder named like the PR's repository (e.g. ../<repo>): detached worktree
#   4. otherwise a partial clone in <workdir>/src
#
# Prints SRC=<path to read the code from>, MODE=<working-tree|worktree|clone> and, when the local
# branch is the PR branch but sits on another commit, a NOTE line.
set -euo pipefail

if [ "${1:-}" = "--cleanup" ]; then
  WD="${2:?usage: checkout_head.sh --cleanup <workdir>}"
  SRC="$WD/src"
  [ -e "$SRC" ] || { echo "nothing to clean"; exit 0; }
  if [ -f "$SRC/.git" ]; then
    MAIN=$(git -C "$SRC" rev-parse --path-format=absolute --git-common-dir)
    git -C "$MAIN/.." worktree remove --force "$SRC"
    echo "worktree removed"
  else
    rm -rf "$SRC"
    echo "clone removed"
  fi
  exit 0
fi

WD="${1:?usage: checkout_head.sh <workdir>}"
PR_JSON="$WD/pr.json"
[ -f "$PR_JSON" ] || { echo "missing $PR_JSON, run fetch_pr.sh first" >&2; exit 1; }
URL=$(jq -r .url "$PR_JSON")
SLUG=$(echo "$URL" | cut -d/ -f4-5 | tr '[:upper:]' '[:lower:]')
REPO=$(echo "$URL" | cut -d/ -f5)
NUM=$(jq -r .number "$PR_JSON")
HEAD_OID=$(jq -r .headRefOid "$PR_JSON")
HEAD_REF=$(jq -r .headRefName "$PR_JSON")
SRC="$WD/src"

slug_of() {
  git -C "$1" remote get-url origin 2>/dev/null \
    | sed -E 's#\.git$##; s#^git@github\.com:#https://github.com/#' \
    | cut -d/ -f4-5 | tr '[:upper:]' '[:lower:]'
}

TOP=$(git rev-parse --show-toplevel 2>/dev/null || true)
LOCAL=""
if [ -n "$TOP" ] && [ "$(slug_of "$TOP")" = "$SLUG" ]; then
  LOCAL="$TOP"
elif [ -n "$TOP" ] && [ -d "$(dirname "$TOP")/$REPO" ] && [ "$(slug_of "$(dirname "$TOP")/$REPO")" = "$SLUG" ]; then
  LOCAL="$(dirname "$TOP")/$REPO"
fi

if [ -n "$LOCAL" ]; then
  BRANCH=$(git -C "$LOCAL" branch --show-current)
  LOCAL_OID=$(git -C "$LOCAL" rev-parse HEAD)
  if [ "$BRANCH" = "$HEAD_REF" ] && [ "$LOCAL_OID" != "$HEAD_OID" ]; then
    echo "NOTE=local branch $BRANCH is at ${LOCAL_OID:0:10}, the PR head is ${HEAD_OID:0:10}"
  fi
  if [ "$LOCAL" = "$TOP" ] && [ "$LOCAL_OID" = "$HEAD_OID" ]; then
    echo "SRC=$TOP"
    echo "MODE=working-tree"
    exit 0
  fi
  [ -e "$SRC" ] && { echo "$SRC already exists, run --cleanup first" >&2; exit 1; }
  git -C "$LOCAL" fetch --quiet origin "pull/$NUM/head"
  git -C "$LOCAL" worktree add --quiet --detach "$SRC" FETCH_HEAD
  echo "SRC=$SRC"
  echo "MODE=worktree"
  exit 0
fi

[ -e "$SRC" ] && { echo "$SRC already exists, run --cleanup first" >&2; exit 1; }
gh repo clone "$(echo "$URL" | cut -d/ -f4-5)" "$SRC" -- --quiet --filter=blob:none --no-checkout
git -C "$SRC" fetch --quiet origin "pull/$NUM/head"
git -C "$SRC" checkout --quiet --detach FETCH_HEAD
echo "SRC=$SRC"
echo "MODE=clone"
