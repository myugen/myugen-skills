#!/usr/bin/env python3
"""Read-only structural diagnostics for workspace control hubs."""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path


BOARD_LINK = re.compile(r"Tablero de [ée]pica:\s*(?P<path>\S+)", re.IGNORECASE)
TICKET_KEY = re.compile(r"\b[A-Z][A-Z0-9]+-\d+\b")
NON_TICKET_PREFIXES = {"DEC", "PLAN", "PR", "SESS"}


def expand(value: str) -> Path:
    return Path(value.strip("`<>()[]")).expanduser().resolve()


def scalar(path: Path, key: str) -> str | None:
    if not path.is_file():
        return None
    match = re.search(rf"^{re.escape(key)}:\s*(.+?)\s*$", path.read_text(encoding="utf-8"), re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip().strip("\"'")


def nested_scalar(path: Path, parent: str, key: str) -> str | None:
    if not path.is_file():
        return None
    lines = path.read_text(encoding="utf-8").splitlines()
    inside = False
    for line in lines:
        if line == f"{parent}:":
            inside = True
            continue
        if inside and line and not line.startswith((" ", "\t")):
            return None
        if inside:
            match = re.match(rf"\s+{re.escape(key)}:\s*(.+?)\s*$", line)
            if match:
                return match.group(1).strip().strip("\"'")
    return None


def issue(messages: list[tuple[str, str]], level: str, text: str) -> None:
    messages.append((level, text))


def diagnose_skills(workspace_hub: Path, messages: list[tuple[str, str]]) -> None:
    helper = Path(__file__).resolve().parents[2] / "multirepo-workspaces/scripts/workspace-skills.py"
    if not helper.is_file():
        issue(messages, "WARN", "workspace skill diagnostics unavailable; load the multirepo-workspaces helper")
        return
    # Reuse the portable owner/validator without creating __pycache__ during read-only diagnosis.
    spec = importlib.util.spec_from_file_location("workspace_skills", helper)
    module = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    try:
        defaults = module.read_selection(workspace_hub / "HUB.yml")
        issue(messages, "INFO", f"hub skill defaults: {len(defaults)}; existing tickets retain independent snapshots")
    except (ValueError, OSError, TypeError) as error:
        issue(messages, "WARN", f"new-workspace skill defaults invalid: {error}")
    for ticket in sorted(workspace_hub.iterdir()):
        if ticket.name.startswith(".") or not (ticket / ".coordination/REPOSITORIES.yml").is_file():
            continue
        try:
            result = module.inspect(ticket)
            if result["status"] == "legacy":
                issue(messages, "INFO", f"{ticket.name}: no workspace skill snapshot (legacy; not migrated)")
            else:
                issue(messages, "OK", f"{ticket.name}: {len(result['skills'])} selected workspace skills verified")
            for warning in result["warnings"]:
                issue(messages, "WARN", f"{ticket.name}: {warning}")
        except (ValueError, OSError, KeyError, TypeError) as error:
            issue(messages, "ERROR", f"{ticket.name}: workspace skills drift: {error}")


def ticket_directories(workspace_hub: Path) -> dict[str, Path]:
    return {
        entry.name: entry
        for entry in workspace_hub.iterdir()
        if entry.is_dir() and not entry.name.startswith(".")
    }


def legacy_epics(control_hub: Path) -> dict[str, set[str]]:
    epics: dict[str, set[str]] = {}
    epics_root = control_hub / "epics"
    if not epics_root.is_dir():
        return epics
    for epic_dir in epics_root.iterdir():
        board = epic_dir / "EPIC.md"
        if epic_dir.is_dir() and board.is_file():
            tickets: set[str] = set()
            for line in board.read_text(encoding="utf-8").splitlines():
                if not line.startswith("|"):
                    continue
                first_cell = line.split("|", 2)[1]
                match = TICKET_KEY.search(first_cell)
                if match and match.group(0).partition("-")[0] not in NON_TICKET_PREFIXES:
                    tickets.add(match.group(0))
            epics[epic_dir.name] = tickets
    return epics


def structured_epics(control_hub: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    epics_root = control_hub / "epics"
    if not epics_root.is_dir():
        return result
    for record in epics_root.glob("*/EPIC.yml"):
        key = nested_scalar(record, "epic", "key")
        if key:
            result[key] = record
    return result


def structured_items(record: Path) -> set[str]:
    """Extract top-level epic item keys without requiring a YAML dependency."""
    return {
        match.group(1).strip("\"'")
        for match in re.finditer(r"^  - key:\s*(\S+)\s*$", record.read_text(encoding="utf-8"), re.MULTILINE)
    }


def diagnose(workspace_hub: Path, control_hub: Path) -> list[tuple[str, str]]:
    messages: list[tuple[str, str]] = []
    workspace_manifest = workspace_hub / "HUB.yml"
    control_manifest = control_hub / "CONTROL.yml"

    if not workspace_hub.is_dir():
        issue(messages, "ERROR", f"workspace hub does not exist: {workspace_hub}")
        return messages
    if not control_hub.is_dir():
        issue(messages, "ERROR", f"control hub does not exist: {control_hub}")
        return messages
    diagnose_skills(workspace_hub, messages)
    if not workspace_manifest.is_file():
        issue(messages, "ERROR", f"missing workspace manifest: {workspace_manifest}")

    declared_control_root = nested_scalar(workspace_manifest, "control_hub", "root")
    if declared_control_root:
        if expand(declared_control_root) != control_hub:
            issue(messages, "ERROR", "HUB.yml control_hub.root does not match --control-hub")
    else:
        issue(messages, "WARN", "workspace hub has no control_hub.root; legacy or unlinked controller")

    if control_manifest.is_file():
        declared_workspace_hub = scalar(control_manifest, "workspace_hub")
        if declared_workspace_hub:
            if expand(declared_workspace_hub) != workspace_hub:
                issue(messages, "ERROR", "CONTROL.yml workspace_hub does not match --workspace-hub")
        else:
            issue(messages, "ERROR", "CONTROL.yml lacks workspace_hub")
    else:
        issue(messages, "WARN", "missing CONTROL.yml; treating controller as legacy Markdown hub")

    tickets = ticket_directories(workspace_hub)
    linked_tickets: dict[str, str] = {}
    for ticket, directory in tickets.items():
        repositories = directory / ".coordination" / "REPOSITORIES.yml"
        linked_epic = nested_scalar(repositories, "control", "epic")
        if linked_epic:
            linked_tickets[ticket] = linked_epic
            record = nested_scalar(repositories, "control", "epic_record")
            if not record:
                issue(messages, "ERROR", f"{ticket}: control.epic is set but control.epic_record is missing")
            elif not expand(record).is_file():
                issue(messages, "ERROR", f"{ticket}: epic_record does not exist: {record}")

        plan = directory / ".coordination" / "PLAN.md"
        if plan.is_file():
            for match in BOARD_LINK.finditer(plan.read_text(encoding="utf-8")):
                if not expand(match.group("path")).is_file():
                    issue(messages, "WARN", f"{ticket}: legacy epic board link is missing: {match.group('path')}")

    records = structured_epics(control_hub)
    for ticket, epic in linked_tickets.items():
        if epic not in records:
            issue(messages, "ERROR", f"{ticket}: linked epic {epic} has no structured EPIC.yml")
        elif ticket not in structured_items(records[epic]):
            issue(messages, "ERROR", f"{ticket}: linked epic {epic} does not list the ticket in EPIC.yml")

    legacy = legacy_epics(control_hub)
    for epic_dir, board_tickets in legacy.items():
        for ticket in sorted(board_tickets):
            if ticket not in tickets and not (workspace_hub / ".archive" / ticket).is_dir():
                issue(messages, "WARN", f"{epic_dir}: board references no active or archived workspace for {ticket}")
        if not (control_hub / "epics" / epic_dir / "EPIC.yml").is_file():
            issue(messages, "INFO", f"{epic_dir}: legacy board is a migration candidate; create EPIC.yml after review")

    for ticket, epic in linked_tickets.items():
        if not any(ticket in board_tickets for board_tickets in legacy.values()) and epic not in records:
            issue(messages, "WARN", f"{ticket}: linked to {epic} but no matching Markdown board was found")

    if not messages:
        issue(messages, "OK", "no structural control-hub issues found")
    return messages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace-hub", required=True, help="workspace hub path")
    parser.add_argument("--control-hub", required=True, help="external control hub path")
    args = parser.parse_args()

    messages = diagnose(expand(args.workspace_hub), expand(args.control_hub))
    for level, text in messages:
        print(f"{level}: {text}")
    return 1 if any(level == "ERROR" for level, _ in messages) else 0


if __name__ == "__main__":
    sys.exit(main())
