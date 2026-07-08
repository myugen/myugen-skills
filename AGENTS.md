# Working in this repo

This is a **hub of personal skills** for organizational workflows. Each top-level directory
(other than `templates/`) is one skill. Skills follow the portable `SKILL.md` format and are
meant to be usable by **any AI agent** and readable by **humans** — nothing here should be
tied to one specific tool. When adding or editing skills, follow the conventions below so the
hub stays consistent.

## What a skill looks like

```
skill-name/
  SKILL.md            required — the entry point, read first
  references/         optional — deep detail, loaded on demand
  assets/             optional — templates, files the skill installs or copies
  scripts/            optional — helper scripts the skill runs
```

## SKILL.md conventions

- Start with YAML frontmatter containing `name` and `description`.
  - `name` matches the directory name (kebab-case).
  - `description` is the single most important line: it's how an agent decides when to use
    the skill. State **what it does** *and* **when to use it**, including implicit triggers
    (phrasings someone might use without naming the skill). Write it in the third person.
- Keep `SKILL.md` lean and skimmable — a human should be able to read it in one sitting. It
  orients the reader and covers the core workflows; push exhaustive detail (schemas, full CLI
  references, edge cases) into `references/` and link those files with a one-line note on
  when to read each.
- Prefer instructing the reader to verify against a live source of truth (a CLI's `help`, the
  actual files) over duplicating things that drift.
- Don't assume a particular agent or runtime. Describe the workflow and the tools it needs;
  avoid tool-specific mechanics unless the skill genuinely depends on them.

## Style

- Match the voice of existing skills (see `knowledge-vault/`): direct, second person,
  explains the *why* behind a convention when it isn't obvious.
- Favor pointing to authoritative commands/files over restating them.

## When you finish adding a skill

- Add a row to the Skills table in `README.md`.
- No build step — the `SKILL.md` files are the artifact. For agents that load skills from a
  directory, they're used via symlinks (see the README), so editing a file here takes effect
  immediately.
