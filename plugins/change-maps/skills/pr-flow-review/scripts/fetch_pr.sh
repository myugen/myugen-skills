#!/usr/bin/env bash
# Collect everything the review needs from GitHub into one folder and print a summary.
#
# Usage: fetch_pr.sh <pr-url> <out-dir>
#        fetch_pr.sh <project> <pr-number> <out-dir>   project: owner/repo, or a repo name under the
#                                                      default owner (defaultOwner in the config, else
#                                                      the owner of the current repository)
#        fetch_pr.sh <pr-number> <out-dir>             PR of the current repository
#        fetch_pr.sh <out-dir>                         PR of the current branch
#
# Writes:
#   pr.json            metadata, files, commits, checks
#   diff.patch         unified diff of the PR
#   threads.json       inline review threads with isResolved / isOutdated and every comment
#   conversation.json  review summaries and top-level PR comments
set -euo pipefail

USAGE="usage: fetch_pr.sh [<pr-url> | [<project>] <pr-number>] <out-dir>"
CONFIG="${CHANGE_MAPS_CONFIG:-${XDG_CONFIG_HOME:-$HOME/.config}/change-maps/config.json}"

default_owner() {
  local owner=""
  [ -f "$CONFIG" ] && owner=$(jq -r '.defaultOwner // empty' "$CONFIG")
  [ -n "$owner" ] || owner=$(gh repo view --json owner -q .owner.login 2>/dev/null || true)
  [ -n "$owner" ] || { echo "Cannot tell the owner of $1. Pass owner/repo, or set defaultOwner in $CONFIG." >&2; return 1; }
  echo "$owner"
}

case $# in
  1)
    OUT="$1"
    PR=$(gh pr view --json number -q .number) || { echo "No PR for the current branch. Pass a PR URL or <project> <pr-number>." >&2; exit 1; }
    ;;
  2)
    PR="$1"
    OUT="$2"
    ;;
  3)
    case "$1" in
      */*) export GH_REPO="$1" ;;
      *) OWNER=$(default_owner "$1"); export GH_REPO="$OWNER/$1" ;;
    esac
    PR="$2"
    OUT="$3"
    ;;
  *)
    echo "$USAGE" >&2
    exit 1
    ;;
esac
mkdir -p "$OUT"

gh pr view "$PR" --json number,title,url,body,author,headRefName,baseRefName,headRefOid,state,isDraft,reviewDecision,additions,deletions,changedFiles,files,commits,statusCheckRollup,reviewRequests > "$OUT/pr.json"
URL=$(jq -r .url "$OUT/pr.json")
OWNER=$(echo "$URL" | cut -d/ -f4)
NAME=$(echo "$URL" | cut -d/ -f5)
NUM=$(jq -r .number "$OUT/pr.json")

gh pr diff "$PR" > "$OUT/diff.patch"
gh pr view "$PR" --json reviews,comments > "$OUT/conversation.json"
gh api graphql -F owner="$OWNER" -F name="$NAME" -F number="$NUM" -f query='
query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      reviewThreads(first:100){
        nodes{
          isResolved isOutdated path line originalLine startLine
          comments(first:50){nodes{author{login} body createdAt url originalCommit{abbreviatedOid}}}
        }
      }
    }
  }
}' > "$OUT/threads.json"

python3 - "$OUT" <<'EOF'
import json, sys
from pathlib import Path
out = Path(sys.argv[1])
pr = json.loads((out / "pr.json").read_text())
th = json.loads((out / "threads.json").read_text())["data"]["repository"]["pullRequest"]["reviewThreads"]["nodes"]
conv = json.loads((out / "conversation.json").read_text())
checks = pr.get("statusCheckRollup") or []
concl = {}
for c in checks:
    k = (c.get("conclusion") or c.get("status") or c.get("state") or "?").lower()
    concl[k] = concl.get(k, 0) + 1
print(f"#{pr['number']} {pr['title']}")
print(f"{pr['url']}")
print(f"author {pr['author']['login']} · {pr['headRefName']} -> {pr['baseRefName']} · head {pr['headRefOid'][:10]} · {pr['state']}{' (draft)' if pr['isDraft'] else ''} · review {pr.get('reviewDecision') or '-'}")
print(f"{pr['changedFiles']} files · +{pr['additions']} / -{pr['deletions']} · {len(pr['commits'])} commits · checks {concl}")
print("\nFILES")
for f in sorted(pr["files"], key=lambda f: -(f["additions"] + f["deletions"])):
    print(f"  +{f['additions']:<4} -{f['deletions']:<4} {f['path']}")
print(f"\nINLINE THREADS ({len(th)})")
for t in th:
    cs = t["comments"]["nodes"]
    first = cs[0] if cs else {}
    state = "resolved" if t["isResolved"] else "open"
    if t["isOutdated"]:
        state += ", outdated"
    who = (first.get("author") or {}).get("login", "?")
    body = " ".join((first.get("body") or "").split())[:160]
    print(f"  [{state}] {t['path']}:{t['line'] or t['originalLine']} · {who} · {len(cs)} comment(s) · {first.get('originalCommit', {}).get('abbreviatedOid', '')}")
    print(f"      {body}")
print("\nREVIEWS")
for r in conv.get("reviews", []):
    body = " ".join((r.get("body") or "").split())[:160]
    print(f"  {r['author']['login']} {r['state']}" + (f": {body}" if body else ""))
print("\nPR COMMENTS")
for c in conv.get("comments", []):
    body = " ".join((c.get("body") or "").split())[:120]
    print(f"  {c['author']['login']}: {body}")
EOF
