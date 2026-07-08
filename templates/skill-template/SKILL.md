---
name: skill-template
description: One or two sentences describing WHAT this skill does and WHEN it should be used. Be specific and include implicit triggers — phrasings someone might use without naming the skill. This line is what an agent reads to decide whether to use the skill, so it matters more than anything below.
---

# Skill Name

One-paragraph overview: what this skill is for and what makes it worth having as a skill
rather than an ad-hoc task.

## Prerequisites

Anything that must be true or installed before the skill works (a CLI, an app running,
credentials). Prefer telling Claude how to verify (`some-cli help`) over hardcoding details
that drift.

## Core workflows

### 1. <The main thing this skill does>

Step-by-step guidance. Keep it lean here; move exhaustive detail into `references/`.

### 2. <The next workflow>

...

## Reference files

- `references/<file>.md` — what it covers and when to read it.

<!--
Delete this comment before shipping. Reminders:
- Keep SKILL.md skimmable and human-readable; push depth into references/.
- Update the name/description frontmatter — the description drives activation.
- Keep it agent-agnostic; avoid tool-specific mechanics unless truly required.
- Add a row to the repo README's Skills table.
-->
