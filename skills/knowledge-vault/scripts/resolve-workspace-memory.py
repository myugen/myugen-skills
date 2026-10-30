#!/usr/bin/env python3
"""Resolve the writable knowledge-vault memory declared by the current workspace."""

import argparse
import json
import os
import re
import sys
from pathlib import Path


NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
ENTRY_KEYS = {"name", "type", "path", "skill", "config"}


class MemoryError(ValueError):
    pass


def ancestors(path):
    current = path
    while True:
        yield current
        if current.parent == current:
            return
        current = current.parent


def discover_ticket(start):
    return next(
        (directory for directory in ancestors(start)
         if (directory / ".coordination" / "REPOSITORIES.yml").is_file()),
        None,
    )


def discover_hub(start):
    # Coordination metadata wins so a repository-local HUB.yml cannot hide the workspace hub.
    ticket = discover_ticket(start)
    if ticket:
        if ticket.parent.name == ".archive":
            candidate = ticket.parent.parent / "HUB.yml"
        else:
            candidate = ticket.parent / "HUB.yml"
        if not candidate.is_file() or not os.access(candidate, os.R_OK):
            return None, f"ticket marker resolves to missing or unreadable {candidate}"
        return candidate, None

    for directory in ancestors(start):
        candidate = directory / "HUB.yml"
        if candidate.is_file():
            if os.access(candidate, os.R_OK):
                return candidate, None
    return None, None


def strip_comment(value):
    single = False
    double = False
    escaped = False
    output = []
    for character in value:
        if escaped:
            output.append(character)
            escaped = False
            continue
        if character == "\\" and double:
            output.append(character)
            escaped = True
            continue
        if character == "'" and not double:
            single = not single
        elif character == '"' and not single:
            double = not double
        elif (
            character == "#"
            and not single
            and not double
            and (not output or output[-1].isspace())
        ):
            break
        output.append(character)
    if single or double:
        raise MemoryError("unterminated quoted scalar")
    return "".join(output).rstrip()


def scalar(value, context):
    value = strip_comment(value).strip()
    if not value:
        raise MemoryError(f"{context} must be a non-empty scalar")
    if value[0] == "'":
        if len(value) < 2 or value[-1] != "'":
            raise MemoryError(f"{context} has an unterminated quote")
        inner = value[1:-1]
        index = 0
        while index < len(inner):
            if inner[index] == "'":
                if index + 1 >= len(inner) or inner[index + 1] != "'":
                    raise MemoryError(f"{context} has invalid single-quote escaping")
                index += 2
                continue
            index += 1
        parsed = inner.replace("''", "'")
        if not parsed:
            raise MemoryError(f"{context} must be a non-empty string")
        return parsed
    if value[0] == '"':
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as error:
            raise MemoryError(f"{context} has an invalid quoted scalar") from error
        if not isinstance(parsed, str) or not parsed:
            raise MemoryError(f"{context} must be a non-empty string")
        return parsed
    if value[0] in "[]{}&*!|>,%@`":
        raise MemoryError(f"{context} uses unsupported YAML syntax")
    if re.match(r"[-?]\s", value):
        raise MemoryError(f"{context} uses an unsupported unquoted YAML indicator")
    if re.search(r":(?:\s|$)", value):
        raise MemoryError(f"{context} contains an unquoted YAML mapping separator")
    if value.lower() in {"null", "~", "true", "false"} or re.fullmatch(
        r"[-+]?(?:0x[\da-f_]+|0o[0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)"
        r"(?:[eE][-+]?\d[\d_]*)?|\.inf|\.nan)",
        value,
        re.IGNORECASE,
    ):
        raise MemoryError(f"{context} must be a string; quote ambiguous YAML scalars")
    return value


def key_value(content, context, allow_empty=False):
    if ":" not in content:
        raise MemoryError(f"{context} must be a key/value mapping")
    key, value = content.split(":", 1)
    key = key.strip()
    if not key or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", key):
        raise MemoryError(f"{context} has an invalid key")
    value = strip_comment(value).strip()
    if not value:
        if allow_empty:
            return key, None
        raise MemoryError(f"{context}.{key} must be a non-empty scalar")
    return key, scalar(value, f"{context}.{key}")


def memory_lines(text):
    lines = text.splitlines()
    start = None
    inline = None
    nested_mapping = False
    for index, raw in enumerate(lines):
        if not raw.strip():
            continue
        stripped = raw.strip()
        if raw[:1].isspace():
            indent = len(raw) - len(raw.lstrip(" "))
            malformed_memory_indent = "\t" in raw or indent % 2 != 0 or not nested_mapping
            if stripped.startswith("memory:") and malformed_memory_indent:
                raise MemoryError("the top-level memory key must not be indented")
            continue
        quoted_key = stripped.startswith(('"memory"', "'memory'"))
        if quoted_key and stripped[8:].lstrip().startswith(":"):
            raise MemoryError("the top-level memory key must be unquoted")
        if re.match(r"^memory\s+:", stripped):
            raise MemoryError("the top-level memory key must use canonical 'memory:' syntax")
        if not stripped.startswith("memory:"):
            nested_mapping = bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*:\s*(?:#.*)?", stripped))
            continue
        suffix = stripped[len("memory:") :]
        if suffix and not suffix[0].isspace():
            raise MemoryError("the top-level memory key requires whitespace before an inline value")
        content = strip_comment(raw).strip()
        if content == "memory:":
            if "\t" in raw:
                raise MemoryError("tabs are not supported")
            if start is not None:
                raise MemoryError("memory is declared more than once")
            start = index + 1
            inline = None
        elif content.startswith("memory:"):
            if "\t" in raw:
                raise MemoryError("tabs are not supported")
            if start is not None:
                raise MemoryError("memory is declared more than once")
            start = index + 1
            inline = content[len("memory:") :].strip()

    if start is None:
        return None
    if inline == "[]":
        for raw in lines[start:]:
            if not raw.strip() or raw.lstrip().startswith("#"):
                continue
            if raw[:1].isspace():
                raise MemoryError("memory: [] must not contain nested content")
            break
        return []
    if inline:
        raise MemoryError("memory must use the canonical block-list form or []")

    end = len(lines)
    for index in range(start, len(lines)):
        raw = lines[index]
        if raw.strip() and not raw[:1].isspace() and not raw.lstrip().startswith("#"):
            end = index
            break
    return lines[start:end]


def parse_entries(lines):
    entries = []
    current = None
    in_config = False

    for raw in lines:
        if "\t" in raw:
            raise MemoryError("tabs are not supported")
        content = strip_comment(raw).strip()
        if not content:
            continue
        indent = len(raw) - len(raw.lstrip(" "))

        if indent == 2 and content.startswith("- "):
            current = {}
            entries.append(current)
            in_config = False
            key, value = key_value(content[2:].strip(), "memory entry", allow_empty=True)
            if key not in ENTRY_KEYS:
                raise MemoryError(f"unsupported memory entry key: {key}")
            if key == "config":
                if value is not None:
                    raise MemoryError("memory entry.config must be a mapping")
                current[key] = {}
                in_config = True
            else:
                if value is None:
                    raise MemoryError(f"memory entry.{key} must be a non-empty scalar")
                current[key] = value
            continue

        if current is None:
            raise MemoryError("memory must contain a two-space-indented list")

        if indent == 4:
            key, value = key_value(content, "memory entry", allow_empty=True)
            if key not in ENTRY_KEYS:
                raise MemoryError(f"unsupported memory entry key: {key}")
            if key in current:
                raise MemoryError(f"duplicate memory entry key: {key}")
            if key == "config":
                if value is not None:
                    raise MemoryError("memory entry.config must be a mapping")
                current[key] = {}
                in_config = True
            else:
                if value is None:
                    raise MemoryError(f"memory entry.{key} must be a non-empty scalar")
                current[key] = value
                in_config = False
            continue

        if indent == 6 and in_config:
            key, value = key_value(content, "memory entry.config")
            if key in current["config"]:
                raise MemoryError(f"duplicate memory entry.config key: {key}")
            current["config"][key] = value
            continue

        raise MemoryError("memory uses unsupported indentation or YAML syntax")

    if not entries:
        raise MemoryError("memory must contain at least one entry or be []")
    return entries


def validate(entries):
    names = set()
    for index, entry in enumerate(entries):
        label = f"memory[{index}]"
        for required in ("name", "type", "path"):
            if required not in entry:
                raise MemoryError(f"{label}.{required} is required")
        if not NAME_RE.fullmatch(entry["name"]):
            raise MemoryError(f"{label}.name contains unsupported characters")
        if entry["name"] in names:
            raise MemoryError(f"{label}.name must be unique")
        names.add(entry["name"])
        if entry["type"] != "local":
            raise MemoryError(f"{label}.type must be local")
        if not (entry["path"].startswith("~/") or os.path.isabs(entry["path"])):
            raise MemoryError(f"{label}.path must be absolute or start with ~/")

        if index == 0:
            if entry.get("skill") != "knowledge-vault":
                raise MemoryError("memory[0].skill must be knowledge-vault")
            config = entry.get("config")
            if not isinstance(config, dict) or not config.get("vault"):
                raise MemoryError("memory[0].config.vault must be a non-empty scalar")
        elif "skill" in entry or "config" in entry:
            raise MemoryError(f"{label} must be skill-less and read-only")


def ticket_metadata(ticket):
    """Read only ticket/control fields from the generated canonical coordination format."""
    result = {}
    control = None
    in_control = False
    document = ticket / ".coordination" / "REPOSITORIES.yml"
    for raw in document.read_text(encoding="utf-8").splitlines():
        content = strip_comment(raw).strip()
        if not content:
            continue
        if not raw[:1].isspace():
            in_control = False
            if content.startswith("ticket:"):
                if "ticket" in result:
                    raise MemoryError("ticket is declared more than once")
                result["ticket"] = scalar(content.partition(":")[2], "ticket")
            elif content.startswith("control:"):
                if control is not None:
                    raise MemoryError("control is declared more than once")
                value = content.partition(":")[2].strip()
                if value not in ("", "{}"):
                    raise MemoryError("control must use the canonical mapping form")
                control = {}
                in_control = value == ""
            continue
        if in_control:
            if "\t" in raw or len(raw) - len(raw.lstrip(" ")) != 2:
                raise MemoryError("control must use two-space-indented scalar fields")
            key, value = key_value(content, "control")
            if key not in {"epic", "epic_record"} or key in control:
                raise MemoryError("unsupported or duplicate control field")
            control[key] = value
    if control:
        if set(control) != {"epic", "epic_record"}:
            raise MemoryError("control.epic and control.epic_record must be declared together")
        record = control["epic_record"]
        if not (record.startswith("~/") or os.path.isabs(record)):
            raise MemoryError("control.epic_record must be absolute or start with ~/")
        result["control"] = control
    return result


def resolve(start, include_context=False):
    hub, discovery_error = discover_hub(start)
    if discovery_error:
        return {"status": "malformed", "message": discovery_error}
    if hub is None:
        return {"status": "absent"}
    context = {}
    if include_context:
        context["hub"] = str(hub)
        ticket = discover_ticket(start)
        if ticket:
            context["ticket_root"] = str(ticket)
            try:
                context.update(ticket_metadata(ticket))
            except (MemoryError, OSError, UnicodeError) as error:
                context["metadata_error"] = str(error)
    try:
        text = hub.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        return {"status": "malformed", "message": f"cannot read {hub}: {error}"}

    try:
        lines = memory_lines(text)
        if lines is None or lines == []:
            return {"status": "absent", **context}
        entries = parse_entries(lines)
        validate(entries)
    except MemoryError as error:
        return {"status": "malformed", "message": f"{hub}: {error}"}

    primary = entries[0]
    result = {"status": "valid", "vault": primary["config"]["vault"], "path": primary["path"]}
    if include_context:
        result.update(context, entries=entries)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--context", action="store_true", help="include hub, ticket, control, and read-only memory entries")
    parser.add_argument("start", nargs="?", default=os.getcwd())
    args = parser.parse_args()
    start = Path(args.start).expanduser().resolve()
    print(json.dumps(resolve(start, include_context=args.context), separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
