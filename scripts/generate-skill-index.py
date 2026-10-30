#!/usr/bin/env python3
"""Generate the static HTTP skill catalog consumed by OpenCode."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


SKILL_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def frontmatter(skill_file: Path) -> list[str]:
    lines = skill_file.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0] != "---":
        raise ValueError(f"{skill_file}: missing YAML frontmatter")

    for index, line in enumerate(lines[1:], start=1):
        if line == "---":
            return lines[1:index]

    raise ValueError(f"{skill_file}: unterminated YAML frontmatter")


def frontmatter_value(lines: list[str], skill_file: Path, field: str) -> str:
    for line in lines:
        if line.startswith(f"{field}:"):
            value = line.partition(":")[2].strip().strip('"\'')
            if value:
                return value

    raise ValueError(f"{skill_file}: missing {field!r} frontmatter")


def skill_files(skill_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in skill_dir.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"{path}: symbolic links cannot be published in a static skill catalog")
        if path.is_file():
            files.append(path)
    return sorted(files, key=lambda path: path.relative_to(skill_dir).as_posix())


def version(files: list[Path], skill_dir: Path) -> str:
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.relative_to(skill_dir).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


def build_index(skills_dir: Path) -> dict[str, list[dict[str, object]]]:
    skills: list[dict[str, object]] = []
    for skill_file in sorted(skills_dir.glob("*/SKILL.md")):
        skill_dir = skill_file.parent
        metadata = frontmatter(skill_file)
        name = frontmatter_value(metadata, skill_file, "name")
        frontmatter_value(metadata, skill_file, "description")
        if name != skill_dir.name:
            raise ValueError(f"{skill_file}: frontmatter name must match {skill_dir.name!r}")
        if not SKILL_NAME.fullmatch(name) or len(name) > 64:
            raise ValueError(f"{skill_file}: invalid skill name {name!r}")

        files = skill_files(skill_dir)
        skills.append(
            {
                "name": name,
                "version": version(files, skill_dir),
                "files": [path.relative_to(skill_dir).as_posix() for path in files],
            }
        )
    return {"skills": skills}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the checked-in index is stale")
    args = parser.parse_args()

    repository = Path(__file__).resolve().parent.parent
    skills_dir = repository / "skills"
    output = skills_dir / "index.json"
    rendered = json.dumps(build_index(skills_dir), indent=2) + "\n"

    if args.check:
        if not output.is_file() or output.read_text(encoding="utf-8") != rendered:
            print(f"{output.relative_to(repository)} is stale; run scripts/generate-skill-index.py", file=sys.stderr)
            return 1
        return 0

    output.write_text(rendered, encoding="utf-8")
    print(f"wrote {output.relative_to(repository)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
