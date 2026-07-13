# Note schema reference

Full property table per note type. All properties live in YAML frontmatter. Properties marked
"required" should be set at creation time; others can be filled in as they become known.

## Shared by every note type

| Property  | Required | Notes                                                             |
|-----------|----------|--------------------------------------------------------------------|
| `type`    | yes      | One of: `person`, `team`, `project`, `foundation`, `plan`, `decision`, `session` |
| `created` | yes      | ISO date, set once at creation, never changes                    |
| `updated` | yes      | ISO date, bumped on every substantive edit                        |
| `tags`    | no       | Cross-cutting themes only — not entity references (use wikilinks for those) |

## Person (`People/`)

| Property  | Required | Notes                                    |
|-----------|----------|-------------------------------------------|
| `role`    | yes      | Job title / function                      |
| `team`    | no       | Wikilink to their `Teams/` note           |
| `manager` | no       | Wikilink to their manager's `People/` note|
| `email`   | no       |                                            |

## Team (`Teams/`)

| Property  | Required | Notes                                          |
|-----------|----------|--------------------------------------------------|
| `mission` | yes      | One-line description of what the team owns       |
| `lead`    | no       | Wikilink to `People/` note                        |
| `members` | no       | List of wikilinks to `People/` notes              |

## Project (`Projects/`)

| Property  | Required | Notes                                                  |
|-----------|----------|----------------------------------------------------------|
| `status`  | yes      | `active` \| `paused` \| `completed` \| `archived`         |
| `owner`   | yes      | Wikilink to `People/` note                                |
| `team`    | no       | Wikilink to `Teams/` note                                 |
| `started` | no       | ISO date                                                  |

## Foundation (`Foundation/`)

| Property   | Required | Notes                                                      |
|------------|----------|---------------------------------------------------------------|
| `category` | yes      | Free-text grouping, e.g. `process`, `glossary`, `architecture`, `policy` |
| `source`   | no       | Where this knowledge came from (a person, doc, or URL)          |
| `reviewed` | no       | ISO date this was last verified accurate                        |

## Plan (`AI/Plans/`)

| Property         | Required | Notes                                                       |
|------------------|----------|-----------------------------------------------------------------|
| `id`             | yes      | `PLAN-NNNN`                                                     |
| `aliases`        | yes      | `[PLAN-NNNN]` so short-form wikilinks resolve                   |
| `status`         | yes      | See status vocabulary below                                     |
| `project`        | no       | Wikilink to `Projects/` note                                    |
| `author`         | no       | Agent name or human name                                        |
| `supersedes`     | no       | Wikilink to the `PLAN-NNNN` this replaces                        |
| `superseded_by`  | no       | Wikilink to the `PLAN-NNNN` that replaced this                   |
| `resulted_in`    | no       | Wikilink to a `DEC-NNNN`, once a decision is made from this plan |

## Decision (`AI/Decisions/`)

| Property                  | Required | Notes                                             |
|---------------------------|----------|-------------------------------------------------------|
| `id`                      | yes      | `DEC-NNNN`                                            |
| `aliases`                 | yes      | `[DEC-NNNN]`                                          |
| `status`                  | yes      | See status vocabulary below                           |
| `implements`              | no       | Wikilink to the `PLAN-NNNN` this decides on            |
| `decided_by`              | no       | Wikilink(s) to `People/` note(s)                       |
| `date_decided`            | no       | ISO date                                               |
| `supersedes`              | no       | Wikilink to the `DEC-NNNN` this replaces               |
| `superseded_by`           | no       | Wikilink to the `DEC-NNNN` that replaced this          |

## Session (`AI/Sessions/`)

**Written automatically by the `SessionEnd` hook — you don't create or set these properties
yourself.** Listed here for completeness (e.g. if you need to read or enrich one).

| Property   | Required | Notes                                                    |
|------------|----------|--------------------------------------------------------------|
| `id`       | yes      | `SESS-NNNN`                                                   |
| `aliases`  | yes      | `[SESS-NNNN]`                                                 |
| `date`     | yes      | ISO date                                                      |
| `project`  | no       | Wikilink to `Projects/` note                                  |
| `related`  | no       | List of wikilinks to any plans/decisions/foundation notes touched |

## Status vocabulary (Plans and Decisions)

Shared across both artifact types so filtering/querying stays consistent:

- `draft` — Plans: being worked out, not yet actionable. Decisions: not yet used for `proposed`.
- `proposed` — Decisions only: put forward, not yet finalized.
- `active` — Plans only: currently being executed.
- `final` — Decisions only: settled and in effect.
- `completed` — Plans only: executed and done.
- `superseded` — either type: replaced by a newer note (see `supersedes`/`superseded_by`).
- `abandoned` — either type: dropped without being superseded by a replacement.

## Linking rules of thumb

- Anything that has, or deserves, its own note gets linked with `[[wikilinks]]` — in both
  frontmatter and body text.
- `tags` are for themes and cross-cutting labels only (`q3-2026`, `vendor-eval`), never for
  entities that already have a note.
- Prefer linking over restating: if a Decision's rationale depends on facts already captured in
  a Foundation note, link to it rather than re-explaining it inline.

