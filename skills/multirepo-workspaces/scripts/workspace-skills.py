#!/usr/bin/env python3
"""Preview, snapshot, and manage optional skills at a non-Git ticket workspace root."""

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tempfile
from pathlib import Path


NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
FIELDS = {"name", "path", "when"}
STATE = ".coordination/skills-state.json"
MANIFEST = ".coordination/SKILLS.yml"
GUIDANCE = ".coordination/SKILLS.md"
LIBRARY = ".claude/skills"


class SkillsError(ValueError):
    pass


def uncomment(value):
    single = double = escaped = False
    output = []
    for char in value:
        if escaped:
            output.append(char)
            escaped = False
            continue
        if char == "\\" and double:
            escaped = True
        elif char == "'" and not double:
            single = not single
        elif char == '"' and not single:
            double = not double
        elif char == "#" and not single and not double and (not output or output[-1].isspace()):
            break
        output.append(char)
    if single or double:
        raise SkillsError("unterminated quoted scalar")
    return "".join(output).rstrip()


def scalar(value):
    value = uncomment(value).strip()
    if not value:
        raise SkillsError("skill fields must be non-empty strings")
    if value.startswith('"'):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as error:
            raise SkillsError("invalid double-quoted scalar") from error
    elif value.startswith("'"):
        if not re.fullmatch(r"'(?:[^']|'')*'", value):
            raise SkillsError("invalid single-quoted scalar")
        parsed = value[1:-1].replace("''", "'")
    else:
        if (value[0] in "[]{}&*!|>,%@`" or re.search(r":(?:\s|$)", value)
                or re.match(r"[-?]\s", value) or value.lower() in {"null", "~", "true", "false", "yes", "no", "on", "off"}
                or re.fullmatch(r"[-+]?(?:[\d.][\w.+-]*|\.inf|\.nan)", value, re.IGNORECASE)):
            raise SkillsError("unsupported or ambiguous YAML scalar; use a quoted string")
        parsed = value
    if not isinstance(parsed, str) or not parsed.strip() or any(ord(char) < 32 for char in parsed):
        raise SkillsError("skill fields must be non-empty, single-line strings")
    return parsed


def definitions(entries):
    names = set()
    for entry in entries:
        if set(entry) != FIELDS:
            raise SkillsError("each skill requires exactly name, path, and when")
        name = entry["name"]
        if not NAME.fullmatch(name) or len(name) > 64 or name in {"synced", "anthropic-skills"}:
            raise SkillsError(f"unsupported skill name: {name}")
        if name in names:
            raise SkillsError(f"duplicate skill name: {name}")
        names.add(name)
        if not (entry["path"].startswith("~/") or os.path.isabs(entry["path"])):
            raise SkillsError(f"{name}: path must be absolute or start with ~/")
    return entries


def read_selection(path, snapshot=False):
    """Read only the canonical skills block; never interpret unrelated hub YAML."""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    starts = []
    for index, raw in enumerate(lines):
        if re.match(r"^(?:skills\s*:|['\"]skills['\"]\s*:)", raw):
            if not raw.startswith("skills:"):
                raise SkillsError("use the canonical top-level skills: key")
            starts.append(index)
        elif re.match(r"^\s+skills\s*:", raw):
            raise SkillsError("skills must be a top-level key")
    if len(starts) > 1:
        raise SkillsError("skills is declared more than once")
    if not starts:
        if snapshot:
            raise SkillsError(f"missing skills selection: {path}")
        return []
    if snapshot:
        versions = [uncomment(line).strip() for line in lines if line.startswith("version:")]
        if versions != ["version: 1"]:
            raise SkillsError("workspace skills snapshot requires version: 1")
    start = starts[0]
    suffix = lines[start][len("skills:"):]
    if suffix and not suffix[0].isspace():
        raise SkillsError("skills: requires whitespace before an inline value")
    inline = uncomment(lines[start][len("skills:"):]).strip()
    if inline not in {"", "[]"}:
        raise SkillsError("skills must use a block list or []")
    entries = []
    for raw in lines[start + 1:]:
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if not raw[:1].isspace():
            break
        if inline or "\t" in raw:
            raise SkillsError("skills: [] cannot have children; tabs are unsupported")
        content = uncomment(raw).strip()
        indent = len(raw) - len(raw.lstrip(" "))
        if indent == 2 and content.startswith("- "):
            entries.append({})
            content = content[2:]
        elif indent != 4 or not entries:
            raise SkillsError("use two-space list and four-space field indentation for skills")
        key, separator, value = content.partition(":")
        if not separator or key not in FIELDS or key in entries[-1]:
            raise SkillsError(f"unsupported or duplicate skill field: {key}")
        entries[-1][key] = scalar(value)
    if not entries and not inline:
        raise SkillsError("an empty selection must be written as skills: []")
    return definitions(entries)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def tree(path):
    """Inventory regular files and empty directories, rejecting escaping links and special files."""
    if path.is_symlink() or not path.is_dir():
        raise SkillsError(f"expected a real skill directory: {path}")
    files, directories = {}, []
    for item in sorted(path.rglob("*")):
        relative = item.relative_to(path).as_posix()
        if ".git" in item.relative_to(path).parts:
            raise SkillsError(f"nested Git metadata is not a skill resource: {item}")
        if item.is_symlink():
            raise SkillsError(f"symlinks inside skill folders are unsupported: {item}")
        mode = item.stat().st_mode
        if stat.S_ISDIR(mode):
            directories.append(relative)
        elif stat.S_ISREG(mode):
            files[relative] = {"sha256": digest(item.read_bytes()), "executable": bool(mode & 0o111)}
        else:
            raise SkillsError(f"special files inside skill folders are unsupported: {item}")
    return {"files": files, "directories": directories}


def source(entry, workspace=None):
    path = Path(entry["path"]).expanduser().resolve()
    if workspace and (path.is_relative_to(workspace) or workspace.is_relative_to(path)):
        raise SkillsError(f"{entry['name']}: source must be separate from the ticket workspace")
    inventory = tree(path)
    text = (path / "SKILL.md").read_text(encoding="utf-8")
    header = re.match(r"\A---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)", text)
    names = re.findall(r"^name:[ \t]*(.+)$", header[1], re.MULTILINE) if header else []
    description = re.search(r"^description:[ \t]*\S", header[1], re.MULTILINE) if header else None
    if len(names) != 1 or scalar(names[0]) != entry["name"] or not description:
        raise SkillsError(f"{path}/SKILL.md must declare the matching name and a description")
    return path, inventory


def safe_root(workspace, allow_archive=False):
    original = workspace.expanduser().absolute()
    if original.is_symlink():
        raise SkillsError("workspace must not be a symlink")
    workspace = original.resolve()
    archived = workspace.parent.name == ".archive"
    if archived and not allow_archive:
        raise SkillsError("archived workspaces are read-only")
    if (workspace / ".git").exists() or (workspace / ".git").is_symlink():
        raise SkillsError("skills belong at the non-Git ticket root, not inside a repository")
    for relative in (".coordination", ".claude", LIBRARY):
        path = workspace / relative
        if path.is_symlink() or (path.exists() and not path.is_dir()):
            raise SkillsError(f"unsafe workspace directory: {path}")
    hub = workspace.parent.parent if archived else workspace.parent
    if not (workspace / ".coordination/REPOSITORIES.yml").is_file() or not (hub / "HUB.yml").is_file():
        raise SkillsError("expected a ticket coordination root directly beneath a hub")
    for relative in (MANIFEST, GUIDANCE, STATE):
        path = workspace / relative
        if path.is_symlink() or (path.exists() and not path.is_file()):
            raise SkillsError(f"unsafe workspace file: {path}")
    return workspace


def guidance(entries):
    lines = ["# Workspace Skills", "", "Use these optional skills in the main session when their criteria fit the task.",
             "Selection is not a requirement to invoke every skill on every task.", ""]
    if not entries:
        lines += ["No optional skills are selected for this workspace.", ""]
    for entry in entries:
        lines += [f"## {entry['name']}", "", f"When to use: {entry['when']}",
                  f"Load `{LIBRARY}/{entry['name']}/SKILL.md` through the agent's skill mechanism.", ""]
    lines += ["This is an independent snapshot, not a live inheritance of HUB.yml.",
              "Global, bundled, plugin, and repository-owned skills are outside this selection.",
              "Start at the ticket root; a worktree-started session may need the ticket added explicitly.", ""]
    return "\n".join(lines)


def manifest(entries):
    lines = ["version: 1", "", "skills:" if entries else "skills: []"]
    for entry in entries:
        for index, field in enumerate(("name", "path", "when")):
            prefix = "  - " if index == 0 else "    "
            lines.append(f"{prefix}{field}: {json.dumps(entry[field], ensure_ascii=False)}")
    return "\n".join(lines) + "\n"


def managed_state(workspace):
    path = workspace / STATE
    if not path.exists():
        if (workspace / MANIFEST).exists() or (workspace / GUIDANCE).exists():
            raise SkillsError("snapshot or guidance exists without ownership state; do not adopt or overwrite it")
        return None
    state = json.loads(path.read_text(encoding="utf-8"))
    if state.get("version") != 1 or not isinstance(state.get("skills"), dict):
        raise SkillsError("unsupported skills ownership state")
    entries = definitions(state.get("entries", []))
    if {entry["name"] for entry in entries} != set(state["skills"]):
        raise SkillsError("skills ownership state disagrees with its entries")
    if not (workspace / MANIFEST).is_file():
        raise SkillsError("managed skills snapshot is missing")
    if digest((workspace / GUIDANCE).read_bytes()) != state.get("guidance"):
        raise SkillsError("generated SKILLS.md has changed; preserve edits and reconcile explicitly")
    for name, inventory in state["skills"].items():
        if tree(workspace / LIBRARY / name) != inventory:
            raise SkillsError(f"managed skill {name} has changed; preserve edits and reconcile explicitly")
    return state


def global_skills():
    home = Path.home()
    roots = [home / ".claude/skills", home / ".agents/skills",
             Path(os.environ.get("XDG_CONFIG_HOME", home / ".config")) / "opencode/skills"]
    result = set()
    for root in roots:
        if root.is_dir():
            result.update(child.name for child in root.iterdir() if (child / "SKILL.md").is_file())
    return sorted(result)


def warnings(workspace, entries, owned=()):
    selected = {entry["name"] for entry in entries}
    result = []
    for name in global_skills():
        if name in selected:
            result.append(f"global skill {name} may shadow this workspace's copy; global configuration was not changed")
        else:
            result.append(f"global skill {name} is outside this selection and may remain available")
    library = workspace / LIBRARY
    if library.is_dir():
        for child in sorted(library.iterdir()):
            if child.name not in selected and child.name not in owned:
                result.append(f"unmanaged workspace skill content: {child}")
    for relative in ("AGENTS.md", "CLAUDE.md", ".coordination/AGENTS.md", ".coordination/CLAUDE.md"):
        path = workspace / relative
        if path.is_file() and re.search(r"(?:Every task requires|Verify the official|For every task, use).*show-me", path.read_text(encoding="utf-8")):
            result.append(f"legacy show-me requirement in {relative}; migrate instructions explicitly")
    return result


def inspect(workspace):
    workspace = safe_root(workspace, allow_archive=True)
    state = managed_state(workspace)
    if not state:
        return {"status": "legacy", "skills": [], "warnings": warnings(workspace, [])}
    entries = read_selection(workspace / MANIFEST, snapshot=True)
    if entries != state["entries"]:
        raise SkillsError("selection changed; preview and apply sync before using the workspace skills")
    if (workspace / GUIDANCE).read_text(encoding="utf-8") != guidance(entries):
        raise SkillsError("workspace skill guidance disagrees with the snapshot")
    return {"status": "valid", "skills": entries, "warnings": warnings(workspace, entries)}


def atomic_write(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(data.encode("utf-8"))
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def change(workspace, action, apply=False, entry=None, name=None):
    workspace = safe_root(workspace)
    state = managed_state(workspace)
    if action != "init" and not state:
        raise SkillsError("initialize workspace skills explicitly before changing them")
    if state:
        entries = read_selection(workspace / MANIFEST, snapshot=True)
        if action != "sync" and entries != state["entries"]:
            raise SkillsError("selection changed; sync it explicitly first")
    else:
        entries = read_selection(workspace.parent / "HUB.yml")
    if action == "add":
        definitions([entry])
        if any(item["name"] == entry["name"] for item in entries):
            raise SkillsError("skill already selected; edit SKILLS.yml and sync to change its configuration")
        entries = [*entries, entry]
    elif action == "remove":
        entries = [item for item in entries if item["name"] != name]
    old = {item["name"]: item for item in state["entries"]} if state else {}
    selected = {item["name"] for item in entries}
    removed = sorted(set(old) - selected)
    copies = {}
    for item in entries:
        name = item["name"]
        if name in old and old[name]["path"] == item["path"]:
            continue  # Snapshot contents never refresh implicitly from a mutable source path.
        destination = workspace / LIBRARY / name
        if name not in old and (destination.exists() or destination.is_symlink()):
            raise SkillsError(f"refusing to overwrite unmanaged skill: {destination}")
        copies[name] = source(item, workspace)
    rendered = guidance(entries)
    unchanged = bool(state and entries == state["entries"] and (workspace / GUIDANCE).read_text(encoding="utf-8") == rendered)
    result = {"status": "unchanged" if unchanged else "planned", "skills": entries,
              "copy": sorted(copies), "remove": removed, "warnings": warnings(workspace, entries, old)}
    if not apply or unchanged:
        return result
    # All ownership, source, and destination checks precede the first write. An unexpected I/O
    # failure leaves reported partial state; never remove worktrees or user files as rollback.
    inventories = dict(state["skills"]) if state else {}
    (workspace / LIBRARY).mkdir(parents=True, exist_ok=True)
    for name, (path, expected) in copies.items():
        with tempfile.TemporaryDirectory(prefix=".skills-stage-", dir=workspace / ".coordination") as temporary:
            staged = Path(temporary) / name
            shutil.copytree(path, staged, symlinks=True)
            if tree(staged) != expected:
                raise SkillsError(f"source changed during copy: {name}; workspace may be partial")
            destination = workspace / LIBRARY / name
            if name in old:
                shutil.rmtree(destination)
            staged.replace(destination)
            inventories[name] = expected
    for name in removed:
        shutil.rmtree(workspace / LIBRARY / name)
        inventories.pop(name)
    atomic_write(workspace / MANIFEST, manifest(entries))
    atomic_write(workspace / GUIDANCE, rendered)
    atomic_write(workspace / STATE, json.dumps({"version": 1, "entries": entries, "skills": inventories,
                                               "guidance": digest(rendered.encode("utf-8"))}, indent=2) + "\n")
    return {**result, "status": "applied", "warnings": warnings(workspace, entries)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("validate", "init", "status", "sync", "add", "remove"))
    parser.add_argument("--hub", type=Path)
    parser.add_argument("--workspace", type=Path)
    parser.add_argument("--name")
    parser.add_argument("--path")
    parser.add_argument("--when")
    parser.add_argument("--apply", action="store_true", help="apply the previewed change after user confirmation")
    args = parser.parse_args()
    try:
        if args.action == "validate":
            if not args.hub or args.apply:
                raise SkillsError("validate requires --hub and is read-only")
            entries = read_selection(args.hub.expanduser().resolve() / "HUB.yml")
            for entry in entries:
                source(entry)
            result = {"status": "valid", "skills": entries}
        else:
            if not args.workspace:
                raise SkillsError("--workspace is required")
            if args.action == "status":
                if args.apply:
                    raise SkillsError("status is read-only")
                result = inspect(args.workspace)
            else:
                entry = None
                if args.action == "add":
                    if not all((args.name, args.path, args.when)):
                        raise SkillsError("add requires --name, --path, and --when")
                    entry = {"name": args.name, "path": args.path, "when": args.when}
                    entry = {key: scalar(json.dumps(value)) for key, value in entry.items()}
                if args.action == "remove" and not args.name:
                    raise SkillsError("remove requires --name")
                result = change(args.workspace, args.action, args.apply, entry, args.name)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (SkillsError, OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "error", "message": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
