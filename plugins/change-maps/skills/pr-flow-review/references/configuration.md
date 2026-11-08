# Configuration

The skills of the `change-maps` plugin read one optional JSON file, kept outside any repository:

```
${XDG_CONFIG_HOME:-$HOME/.config}/change-maps/config.json
```

Set `CHANGE_MAPS_CONFIG` to read another file instead, for example in a test.

Without the file everything still works. Artifacts go to the default target (a Claude artifact, or
the local HTML file for agents that cannot publish one), and `<project> <pr-number>` looks for the
project under the owner of the current repository.

## Create it

```sh
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/change-maps"
cp assets/config.example.json "${XDG_CONFIG_HOME:-$HOME/.config}/change-maps/config.json"
```

Then edit it:

```json
{
  "defaultOwner": "acme",
  "artifactManager": {
    "url": "https://artifacts.example.com",
    "skill": "artifact-tools:artifact-management",
    "allowedLinkHosts": ["github.com/acme", "docs.google.com"]
  }
}
```

- `defaultOwner` (optional): the GitHub owner used for `<project> <pr-number>`. Without it, the
  owner of the repository of the current directory.
- `artifactManager` (optional): publish to this Artifact Manager instead of the default target.
  Leave the block out to keep the default.
  - `url` (required in the block): the Artifact Manager's base URL. The links of the published
    artifacts start with it, which is how you check that the `artifact_*` tools of the session talk
    to this manager.
  - `skill` (optional): a skill to load before the first artifact call, when the Artifact Manager
    ships one with the general rules of its tools.
  - `allowedLinkHosts` (optional): the hosts, or a host plus a path prefix such as `github.com/acme`,
    that links in the page may point at. Some Artifact Managers reject a whole page that links
    anywhere else, so the build stops early and lists the offending links.

The build prints the target it read, and writes it to `out/publish/manifest.json` under `target`.
