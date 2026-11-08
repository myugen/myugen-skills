# data.json format

`scripts/build_artifact.py` turns this file into the artifact. `assets/example-data.json` is a
complete example (a fictional PR of a library API, one diagram, two findings). Read it once before
writing your own, it answers most format questions faster than this page.

Fields ending in `_html` are inserted as HTML, so you can use `<code>`, `<b>`, `<a>`, tables and lists
in them. Every other text field is escaped. When the configuration sets
`artifactManager.allowedLinkHosts`, links may only point at those hosts, because that Artifact
Manager rejects a page with links anywhere else. The build checks it.

## Top level

| key | required | what |
|---|---|---|
| `lang` | no | `es` (default) or `en`. Sets the fixed UI text. Write your own text in the same language. |
| `title` | yes | Page and artifact title, e.g. `LIB-219 · Renew a loan once` |
| `description` | no | One sentence for the artifact card. |
| `headline` | yes | The `<h1>`. What the PR does, in plain words. |
| `kind` | no | Last word of the eyebrow. Default `revisión` / `review`. |
| `pr` | yes | `number`, `url` required. Optional `ticket`, `branch`, `commit`, `author`, `state`, `ci`, `snapshot` (date of the snapshot). |
| `lead_html` | no | Two to four sentences: why the PR exists and what changes for the caller. |
| `stats` | no | List of `{value, label}`. Typical: files and +/- lines, flows touched, new + modified components, queries added, findings open + resolved. |
| `flow_title` | no | Overrides the flow section title. |
| `flow_intro_html` | no | Sentence placed before the standard help text, e.g. which endpoint the diagram shows. |
| `diagrams` | yes | One or more sequence diagrams, see below. |
| `components` | no | Bands of touched components, see below. |
| `components_sub_html` | no | Overrides the components subtitle. |
| `sections_before_review` | no | Free sections between components and review, usually the design. |
| `review` | no | Review section texts, see below. |
| `findings` | no | Review findings, see below. |
| `sections_after_review` | no | Free sections after the review, usually tests and acceptance criteria. |

Free sections are `{id, title, nav?, sub_html?, html}`. `id` is the anchor, `nav` the short label in
the top navigation. Use the CSS classes `card`, `grid2` (two columns that stack on phones), `tw` (table
wrapper that scrolls), `note`, `mt` (top margin) and `pill new|mod|old`.

## Diagrams

```json
{
  "id": "renew",
  "title": "Loan renewal",
  "sub_html": "Only shown when there are several diagrams or a title is set.",
  "box_legend": "New path: only when the loan does not exist",
  "aria": "Optional accessible description",
  "lifelines": [ ... ],
  "messages": [ ... ],
  "activations": [ ... ]
}
```

Use one diagram per independent entry point (an endpoint, a subscriber, a job). Two flows that run
through the same request stay in one diagram, split with section rows.

### Lifelines

```json
{"id": "hdl", "name": "RenewLoanCommandHandler", "lines": ["RenewLoan", "CommandHandler"], "sub": "application", "st": "mod"}
```

- `st`: `new` (added by the PR), `mod` (changed by the PR), `old` (existing, unchanged), `ext` (another service or the caller).
- `lines`: how the name breaks inside the 104 px header. At most 3 lines of about 15 characters.
  Optional, the build splits CamelCase on its own, but set it when the split reads badly.
- `sub`: layer or role, about 16 characters at most (`api · loans`, `domain`, `DB`, `client`).
- Order them left to right as the call travels: caller, entry point, collaborators, storage and
  external services. Between 6 and 12 lifelines read well. Merge minor collaborators into one lifeline
  (`LoanRepository · HoldsFinder`) instead of adding columns.

### Messages

A step:

```json
{"id": "once", "from": "policy", "to": "policy", "label": "loan.renewals < 1", "code": "renewed → 409", "st": "new", "detail": "...", "src": "renewal_policy.py:18-21"}
```

- `st`: `new`, `mod` or `old`, the colour of the step number.
- `label`: the call or the payload, short. Long explanations go in `detail`.
- `code`: optional outcome shown in red after an arrow, e.g. `403`, `409 · renewal_limit`, `missing → step 11`.
- `ret: true` draws a dashed return arrow (responses to the caller).
- `from` equal to `to` draws a self call (raise, internal step).
- `detail`: one or two sentences shown when the step is clicked. What happens and why it matters.
- `src`: `file.py:lines` at the PR head, joined with ` · ` when there are several.
- `id`: optional stable name. Findings and activations can point at it instead of the step number,
  so inserting a step later does not break their anchors.

A section row, which splits the diagram into phases:

```json
{"section": "RENEWAL RULES"}
{"section": "Only when the loan does not exist", "box": "hdl"}
```

With `box`, the rows up to the next section are framed in a dashed box that starts at that lifeline.
Use it for a conditional path the PR adds, and describe it in `box_legend`.

Steps are numbered in order, starting at 1, skipping section rows.

### Activations

```json
{"lifeline": "hdl", "from": 3, "to": "event"}
```

A grey bar on the lifeline from one step to another, step numbers or ids. Add them for the two or
three components that hold control across many steps. They are optional.

Labels must end before the badge column on the right edge of the diagram. `check_render.py`
reports the ones that do not.

## Components

```json
[{"band": "Application and domain", "items": [
  {"name": "RenewalPolicy", "st": "new", "desc_html": "Holds both renewal rules.", "findings": ["E1"]}
]}]
```

One band per layer or flow. `st` is `new`, `mod`, `old`, `ext` or `ghost` (dashed, for something the
PR should have and does not). `findings` adds the finding tags to the box. Include the unchanged
components the findings or the flow depend on, and the consumers of a changed contract.

## Review

```json
{"sub_html": "Static review of the diff against <code>main</code>...",
 "checked": ["The migration adds <code>renewals</code> with default 0...", "..."],
 "outside_diff_html": "<code>HoldsFinder</code> counts expired holds as active...",
 "extra_html": "optional extra cards"}
```

- `sub_html`: how the review was done (static or with tests run, against which base) and its result
  in one sentence.
- `checked`: things you verified and found correct. They show the reader what the review covered.
- `outside_diff_html`: problems seen in code the PR does not change. They are not findings.

## Findings

```json
{
  "id": "E1",
  "sev": "media",
  "status": "Open",
  "title": "Two parallel renewals can both pass the once-only check",
  "where": "renewal_policy.py:18",
  "url": "https://github.com/acme/library-api/pull/412#discussion_r1001",
  "state_html": "Raised by Alex Doe. Still open, no answer yet.",
  "what_html": "...",
  "impact_html": "...",
  "fix_html": "...",
  "anchors": [{"diagram": "renew", "lifelines": ["hdl", "policy", "repo"], "steps": ["load", "once", "save"]}]
}
```

- `id`: short and stable. `E1, E2...` works for any origin. Some prefer `R1...` for our own findings
  and the reviewer's initial for threads, any scheme is fine if it stays short (badges are 26 px wide).
- `sev`: `alta`, `media`, `baja`, `nit`, `conocido` (pre-existing or already known) or `ok` (resolved).
- `status`: the chip text. Default is the severity label. Use it for the thread state (`Open`,
  `Resolved`, `New`) when that is what the reader cares about.
- `where`: `file:line` at the PR head. Must be a line the PR adds or modifies.
- `url`: optional link to the review thread.
- `state_html`: who raised it and where it stands (open, answered, fixed in which commit, agreed).
- `what_html`: the fact, with the code that causes it.
- `impact_html`: a concrete scenario: input or state, then the wrong outcome.
- `fix_html`: the proposal, or what the fix commit did.
- `anchors`: the lifelines and steps the finding belongs to. With a single diagram `diagram` can be
  left out, and `lifelines` / `steps` can sit directly on the finding.

Every finding should have at least one anchor. Clicking it greys out the rest of the diagram, which is
how the reader sees where the comment lands. A finding about tests only can anchor on the step the
missing test should cover.
