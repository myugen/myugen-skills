---
name: conventional-commits
description: Creates focused Git commits that follow the Conventional Commits 1.0.0 format. Use it when asked to "commit these changes", "prepare a commit", "write a conventional commit", "haz un commit", "prepara el commit", or otherwise turn completed work into a local commit.
---

# Conventional Commits

Create one clear, reviewable commit for each logical change. A good commit message describes
what changed in a standard form; a good commit also contains only the files that support that
message. Never use the message format to hide unrelated work.

## Before You Commit

1. Read repository-local instructions such as `AGENTS.md`, `CONTRIBUTING.md`, and any commit
   policy before deciding on the message or staging files.
2. Inspect both staged and unstaged work:

   ```sh
   git status --short
   git diff --stat
   git diff --cached --stat
   ```

3. Read the relevant diffs and tests. Treat pre-existing staged changes as user work: never
   reset, restore, or unstage them. If they do not exactly match the requested commit, ask how
   to separate them.
4. Split independent changes into separate commits. If the intended grouping is unclear, show
   the proposed groups and ask before staging.

## Create The Commit

1. Choose the message using the format in [the reference](references/conventional-commits.md).
   Use a scope only when it identifies a meaningful area of the change.
2. Stage only the reviewed files for this commit, naming every path explicitly:

   ```sh
   git add -- path/to/file path/to/other-file
   ```

   Do not use `git add .` or `git add -A`. Recheck the staged diff before committing.
3. Run the relevant validation for the staged change. Do not claim tests passed unless they ran
   successfully.
4. Create the commit. Keep the subject in the first `-m`; use separate `-m` arguments for a
   body and each footer when they add useful context:

   ```sh
   git commit -m "feat(auth): add token refresh" \
     -m "Refresh expired access tokens without requiring a new sign-in." \
     -m "Refs: AUTH-123"
   ```
5. Verify the result and report it accurately:

   ```sh
   git show --stat --oneline HEAD
   git status --short
   ```

## Safety Rules

- Do not amend, push, force-push, reset, clean, restore, or discard changes unless the user
  explicitly asks for that operation.
- Never add credentials, generated secrets, or unrelated changes to make a commit look clean.
- Preserve user changes already staged or unstaged. Ask rather than guessing their intent.
- A request to commit does not imply permission to push.

## Reference

- [references/conventional-commits.md](references/conventional-commits.md) — message grammar,
  type guide, breaking-change syntax, footers, and examples. Read it before composing a message
  when the type, scope, or footer is not obvious.
