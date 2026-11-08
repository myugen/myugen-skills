# change-maps

Visual maps of code changes. Each skill turns a change into an interactive page with diagrams,
so developers get its context without reading walls of text.

| Skill | What it does |
|-------|--------------|
| [`pr-flow-review`](./skills/pr-flow-review) | Reviews a pull request of any GitHub repository and publishes an artifact with one sequence diagram per touched flow, the touched components, the design it follows and every finding pinned on the diagram. It never posts on the PR. |

## Install

```
/plugin marketplace add myugen/myugen-skills
/plugin install change-maps@myugen-skills
```

Then:

```
/change-maps:pr-flow-review                                   # PR of the current branch
/change-maps:pr-flow-review library-api 412                   # project and PR number
/change-maps:pr-flow-review https://github.com/acme/library-api/pull/412
```

## Where the artifact goes

By default the page is published as a Claude artifact, or left as a local HTML file when the agent
cannot publish one. To publish to an Artifact Manager instead, and to set the default GitHub owner,
create `${XDG_CONFIG_HOME:-$HOME/.config}/change-maps/config.json`. See
[configuration](./skills/pr-flow-review/references/configuration.md).

## Requirements

- `gh`, authenticated with access to the repository of the PR, plus `git` and `jq`
- `python3`
- Google Chrome for the headless render check (set `CHROME_PATH` when it is not in the default
  location)
- for an Artifact Manager target: its MCP tools (`artifact_create_static`, `artifact_update_static`,
  `artifact_patch`, `artifact_get`) connected in the session
