# Publishing

`build_artifact.py` reads the configuration (see `configuration.md`), prints the publish target and
writes it to `out/publish/manifest.json` under `target`. Publish to that target.

## Default target: a Claude artifact or the local file

Without `artifactManager` in the configuration:

- When the agent has a tool to publish artifacts, such as the `Artifact` tool of Claude Code, publish
  `out/artifact.html` with it in one call. The page is self-contained, with its styles and scripts
  inline. Follow the tool's own instructions, and use the data's `title` and `description`. To
  refresh it later, publish again to the same artifact so the link stays the same.
- Otherwise do not publish anything. Give the user the absolute path of `out/artifact.html`, which
  opens in any browser.

## Artifact Manager

With `artifactManager.url` set, publish through the Artifact Manager's MCP tools:
`artifact_create_static`, `artifact_update_static`, `artifact_patch` and `artifact_get`. When
`artifactManager.skill` names a skill, load it before the first call, it holds the general rules of
those tools. When the tools are not available in the session, stop and tell the user, do not fall
back to another target on your own.

### Why it is staged

Sending the whole page (about 40 KB with scripts) in one `artifact_create_static` call failed in
practice: the call was rejected and the artifact could not be read back afterwards. What works is a
small create, then the page without scripts through `artifact_update_static` (about 25 KB), then each
script through `artifact_patch` (under 8 KB each). `build_artifact.py` prepares exactly those pieces
in `out/publish/`, listed in order in `manifest.json`.

### New artifact

1. `artifact_create_static` with `title` and `description` from `manifest.json` and a minimal page:
   `<!doctype html><html><head><meta charset="utf-8"><title>…</title></head><body><p>…</p></body></html>`.
   Keep the returned `artifact_id`. The version is 1.
2. `artifact_update_static` with `artifact_id`, `expected_version: 1` and `html` = the contents of
   `publish/static.html`. Version 2.
3. For each entry of `manifest.patches`, in order: `artifact_patch` with
   `edits: [{"old": <marker>, "new": <contents of the patch file>}]` and the version returned by the
   previous call. One patch per call keeps every request small.
4. `artifact_get` with `find: "<!--PRFR"` and `context_lines: 0`. It must find nothing. A leftover
   marker means a patch did not apply.

Give the user the preview link the tools return. It must start with `artifactManager.url`. If it
does not, the session's `artifact_*` tools belong to another manager: say so. The artifact is
private to its creator. Sharing it is the user's decision, do not pass `access`.

Read the file contents with your file reading tool or `cat` and paste them verbatim into the call.
Do not retype or summarise them, the patches carry JSON that must stay exact.

### Updating an artifact made earlier

Rebuild, then read the current version with `artifact_get` and `include_html: false`, and repeat
steps 2 to 4 with that version. The link stays the same and the Artifact Manager keeps the earlier
versions.

### When a call is rejected

- `artifact_update_static` rejected: rebuild with `--split-sections`, which moves every section after
  the flow into its own patch, and retry with the smaller `static.html`.
- `artifact_patch` rejected for size: rebuild with a lower `--chunk`, e.g. `--chunk 5000`.
- Version conflict: read the version with `artifact_get` (`include_html: false`) and continue from it.
  Do not restart from step 1, that would create a second artifact.
- A create whose outcome is unknown returns an `artifact_id`. Repeat the call with that id and the
  same content instead of creating another one.

## Checking it in the browser (optional)

When browser tools are available, open the link, click the first finding chip and take a
screenshot. The diagram should grey out everything except that finding's components and steps.
Close the tab when done.
