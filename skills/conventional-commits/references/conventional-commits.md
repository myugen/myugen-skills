# Conventional Commits reference

This skill follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
Use the repository's own commit policy when it is stricter.

## Header

```text
<type>[optional scope][!]: <description>
```

- `type` and `description` are required.
- `scope` is optional and identifies the affected area, such as `auth`, `api`, or `cli`.
- `!` immediately before `:` marks a breaking change.
- Write the description in lowercase imperative mood, without a trailing period. Keep it concise;
  72 characters is a useful subject-line limit, not a Conventional Commits requirement.

Examples:

```text
feat: add account export
fix(cli): preserve multiline input
docs: clarify local setup
refactor(api)!: remove the legacy response shape
```

## Recommended types

| Type | Use for |
|------|---------|
| `feat` | New user-visible capability |
| `fix` | Correcting broken behavior |
| `docs` | Documentation only |
| `refactor` | Internal restructuring without intended behavior change |
| `test` | Adding or correcting tests |
| `perf` | Performance improvement |
| `build` | Build system, dependencies, packaging, or release tooling |
| `ci` | Continuous-integration configuration or automation |
| `chore` | Maintenance that fits no other type |
| `revert` | Reverting a prior commit |

Choose the type for the dominant effect of the commit, not a secondary file it happens to touch.
For example, tests shipped with a user-visible capability normally belong in `feat`, not `test`.

## Body and footers

Add a body when the subject alone does not explain why the change exists, its constraints, or its
user impact. Leave one blank line between the header and body.

Footers use a token followed by `: ` or ` #`, after another blank line. Common examples are:

```text
Refs: AUTH-123
Closes: #42
Co-authored-by: Name <email@example.com>
```

Use a footer only when its tracker, issue, or attribution is known. Do not invent ticket IDs.

## Breaking changes

Mark a breaking change with `!`, a `BREAKING CHANGE:` footer, or both. The footer must describe
what breaks and the migration required:

```text
feat(api)!: require a project identifier

BREAKING CHANGE: clients must send project_id with every request.
```

Use `BREAKING CHANGE:` exactly, with a space before `CHANGE`. This is the special footer token
defined by the specification.

## Atomicity checklist

Before committing, confirm that:

1. Every staged file supports one message.
2. The type describes the primary change.
3. The scope is useful rather than speculative.
4. The body and footers contain only verified information.
5. The staged diff excludes unrelated user work and secrets.
