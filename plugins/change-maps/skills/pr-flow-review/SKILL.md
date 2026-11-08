---
name: pr-flow-review
description: Review a pull request and publish an interactive artifact that maps the flows and components it touches, explains the design it follows, and pins every review finding (ours and the reviewers' threads) onto a sequence diagram, so developers get the context of a change without reading walls of text. Use it whenever the user asks for an artifact, diagram or visual map of a PR, wants to know which flows or components a PR touches, or asks to review a PR and place the findings on the flows, e.g. "crea un artefacto de la PR", "qué flujos toca esta PR", "haz la misma estrategia con esta PR", "revisa la PR y asocia los findings a los flujos", even when they do not say "diagram". Works with any GitHub repository, from a PR URL, a project and PR number, or the current branch. It does not post anything on the PR.
argument-hint: "[(<project> <pr-number>)|pr-url]"
---

# PR flow review

The result is an interactive HTML artifact and a short report in the chat. The artifact has:

- a header with the PR, the ticket, the state and a few numbers
- one sequence diagram per touched flow. Each lifeline is marked new, modified, existing or external,
  and each step new, changed or existing. Clicking a step shows what it does and where the code is.
- the touched components, grouped by layer
- the design the PR follows and its contract with consumers
- the review: each finding with its severity, its state and a "show in diagram" button that greys
  out everything except the components and steps it belongs to
- the tests and how they cover the acceptance criteria

The point is that the author and the other reviewers see where each comment sits in the flow, and
which parts of the flow the PR did not change. Keep that in mind when choosing what goes into the
diagram: it must show the path the findings live on, not every class the diff touches.

Nothing is posted on the PR. Posting comments, approving or pushing are separate steps that need the
user's explicit go-ahead, and on a PR the user does not own, never push anything.

The artifact goes to a Claude artifact by default, or to an Artifact Manager when the user configured
one. The optional configuration is described in `references/configuration.md`.

## Workflow

Work in `<scratchpad>/<repo>-pr-<N>/` (the session's scratchpad directory, or a temp directory when
there is none). `SK` below is this skill's directory.

### 1. Collect the PR

The PR can live in any GitHub repository the user can read, not only the one open in the session.
The argument can be:

- a PR URL
- `<project> <pr-number>`, where `<project>` is `owner/repo`, or a repository name under the default
  owner (`defaultOwner` in the configuration, else the owner of the current repository)
- a bare `<pr-number>`, for the repository of the current directory
- nothing, for the PR of the current branch. Say which PR you picked in your first message, so the
  user can stop you if it is the wrong one. If the branch has no PR, ask which one to review.

```bash
$SK/scripts/fetch_pr.sh <the same arguments> <workdir>
$SK/scripts/checkout_head.sh <workdir>
```

`fetch_pr.sh` prints the summary (files by size, inline threads with their state, reviews, PR
comments) and saves `pr.json`, `diff.patch`, `threads.json` and `conversation.json` in the workdir.
Read the PR body too: it usually states the goal, the acceptance criteria and the manual test.

`checkout_head.sh` makes the code at the PR head readable without touching the user's checkout, and
prints `SRC=` with the folder to read it from. It uses the working tree when the current directory is
the PR's repository at the PR head. Otherwise it makes a detached worktree from the current
repository or from a sibling folder named like the repository (`../library-api`), and when there is
no local copy it makes a partial clone. Read all the code from `SRC`.

When it prints `NOTE=`, the local branch of the PR sits on another commit (unpushed commits, or
commits not pulled yet). Review the PR head and say in the report that the local branch differs.

Run `checkout_head.sh --cleanup <workdir>` when the review is done.

### 2. Map the flows

For each entry point the diff reaches (endpoint, subscriber, command handler, job, admin action),
follow the path from the caller to storage or to the external services, and back to the response.
Read the changed files whole, plus as much unchanged code around them as you need to explain the
behaviour: auth and permission checks, validators, finders and repositories, exception handlers,
dependency injection, serializers. When the PR changes a contract (a serializer field, an event,
a response code), find its consumers and count them.

Use CodeGraph when `SRC` is the working tree and the repository has a `.codegraph/` index. A worktree
or a clone has no index, so use grep there.

For every step note the caller, the callee, a short label, the outcome codes, whether the step is
new, changed or existing, one or two sentences of detail and the `file:line` at the head. Also note
what the reader will want as numbers or tables: queries added, consumers, responses before and after.

Choose the diagrams. One per independent entry point. Two flows through the same request share one
diagram split with section rows. Aim for 6 to 12 lifelines and up to about 20 steps. Merge minor
collaborators into one lifeline rather than adding columns.

### 3. Review

Review the diff in full by default. Trim the volume only when the PR's author risks being
overwhelmed, and ask the user when unsure.

- Use the repository's review conventions, they are the reference over the existing code. Look in
  `SRC` for `CLAUDE.md`, `AGENTS.md`, contributing guides and the skills in `.claude/skills/`. When
  `SRC` is the session's repository its skills are already listed: load the review one and the ones
  for the area the PR touches. In a worktree or clone of another project, read the relevant
  `SKILL.md` files directly.
- Findings go only on lines the PR adds or modifies. A problem in code the PR does not change goes in
  the "outside the diff" note, not in the findings.
- Check every finding against the code at the head and write the concrete scenario: the input or
  state, then the wrong outcome. Drop what you cannot make concrete.
- Go through every existing thread in `threads.json`. Decide whether it is open, answered or resolved,
  and whether a later commit already fixed it (read the line at the head, not the thread's diff hunk).
  Add the relevant ones as findings, naming who raised them and where they stand. If you agree with an
  open thread, say so in its finding instead of adding a duplicate of your own.
- Severities: `alta`, `media`, `baja`, `nit`, `conocido` (pre-existing or already known) and `ok`
  (resolved).
- Keep a list of what you checked and found correct. It tells the reader what the review covered.

### 4. Write the data file

Write `<workdir>/data.json` in the format of `references/data-schema.md`. `assets/example-data.json`
is a complete example, read it once before writing.

Anchor every finding to the lifelines and steps it belongs to. Give the steps you anchor to an `id`,
so reordering steps later does not break the anchors.

Write in the language of the conversation and set `lang` to match. Keep identifiers, paths and codes
untranslated in `<code>`. Use plain, short sentences. No em dashes, no semicolons, no slogan-like
phrases. Do not dramatise a finding or build suspense: state the fact, then the evidence. When the
PR's author was not part of a spec or design document, explain the expected behaviour in your own
words instead of citing the document.

### 5. Build and check

```bash
python3 $SK/scripts/build_artifact.py <workdir>/data.json --out-dir <workdir>/out
python3 $SK/scripts/check_render.py <workdir>/out/artifact.html
```

The build validates the data (unknown lifelines, steps or findings, wrong states) and stops with a
list of problems. It also prints the publish target read from the configuration, and when the
configured Artifact Manager restricts links, it stops on any link to another host. The check renders
the page in headless Chrome and reports JavaScript errors, labels that run into the badge column,
header text wider than its box and horizontal scroll on a phone. Fix each one in the data (shorter
label with the rest in `detail`, explicit `lines` for a lifeline, shorter `sub`) and run both again
until the check is clean.

Then look at the three screenshots it saves next to `artifact.html` (`shot-desktop.png`,
`shot-finding.png` with the first finding active, `shot-mobile.png`). The check only measures
overflow. Whether the diagram tells the story you meant is something you have to see.

### 6. Publish

Follow `references/publishing.md` for the target the build printed:

- default: publish `out/artifact.html` as a Claude artifact when the agent has a tool for it,
  otherwise give the user the absolute path of `out/artifact.html`
- Artifact Manager: load the configured skill if there is one, then publish in stages with its
  `artifact_*` tools, using the pieces in `out/publish/`

To refresh an artifact made earlier, publish a new version of the same artifact so its link stays
the same.

### 7. Report

Answer in the user's language, briefly:

- the artifact link and its version, or the path of the local file
- the flows it covers, one line each
- a table of findings: id, title, state, `file:line`
- what is outside the diff, if anything
- that the local branch differs from the PR head, when `checkout_head.sh` said so
- that nothing was posted on the PR

Then offer the next step: drafting the comments for the findings worth posting. Draft them in the
user's communication style and show them before posting, and post only on an explicit yes.
