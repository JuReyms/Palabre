#!/usr/bin/env python3
"""Sync docs/guide pages to the Nuxt Content tree used by Palabre-app.

Source pages already use the same Markdown/frontmatter format as the docs site.
This script only validates the required frontmatter and copies pages to their
numbered Nuxt Content destinations.
"""

from __future__ import annotations

import os
import re
import shutil
from pathlib import Path

FILE_MAP = {
    "docs/guide/get-started/introduction.md": "content/1.get-started/1.introduction.md",
    "docs/guide/get-started/installation.md": "content/1.get-started/2.installation.md",
    "docs/guide/get-started/configuration.md": "content/1.get-started/3.configuration.md",
    "docs/guide/get-started/first-debate.md": "content/1.get-started/4.first-debate.md",
    "docs/guide/agents/overview.md": "content/2.agents/1.overview.md",
    "docs/guide/agents/claude-code.md": "content/2.agents/2.claude-code.md",
    "docs/guide/agents/codex.md": "content/2.agents/3.codex.md",
    "docs/guide/agents/gemini.md": "content/2.agents/4.gemini.md",
    "docs/guide/agents/opencode.md": "content/2.agents/5.opencode.md",
    "docs/guide/agents/ollama.md": "content/2.agents/6.ollama.md",
    "docs/guide/usage/running-a-debate.md": "content/3.usage/1.running-a-debate.md",
    "docs/guide/usage/context-and-files.md": "content/3.usage/2.context-and-files.md",
    "docs/guide/usage/summaries.md": "content/3.usage/3.summaries.md",
    "docs/guide/usage/exports.md": "content/3.usage/4.exports.md",
    "docs/guide/configuration/overview.md": "content/4.configuration/1.overview.md",
    "docs/guide/configuration/defaults.md": "content/4.configuration/2.defaults.md",
    "docs/guide/configuration/local-vs-global.md": "content/4.configuration/3.local-vs-global.md",
    "docs/guide/configuration/advanced-json.md": "content/4.configuration/4.advanced-json.md",
    "docs/guide/reference/cli.md": "content/5.reference/1.cli.md",
    "docs/guide/reference/config-file.md": "content/5.reference/2.config-file.md",
    "docs/guide/reference/presets.md": "content/5.reference/3.presets.md",
    "docs/guide/troubleshooting.md": "content/6.troubleshooting.md",
    "docs/guide/roadmap.md": "content/7.roadmap.md",
}

FRONTMATTER_RE = re.compile(r"^---\n(?P<meta>.*?)\n---\n", re.DOTALL)


def validate_frontmatter(path: Path, text: str) -> None:
    match = FRONTMATTER_RE.match(text)
    if not match:
        raise SystemExit(f"Missing frontmatter: {path}")

    meta = match.group("meta")
    missing = [key for key in ("title:", "description:") if key not in meta]
    if missing:
        raise SystemExit(f"Missing {', '.join(missing)} in frontmatter: {path}")

    body = text[match.end():].lstrip()
    if body.startswith("# "):
        raise SystemExit(f"Remove top-level H1 from body, title is frontmatter: {path}")


def main() -> None:
    for src, dest in FILE_MAP.items():
        source = Path(src)
        if not source.exists():
            print(f"Skip: {src} not found")
            continue

        text = source.read_text(encoding="utf-8")
        validate_frontmatter(source, text)

        output = Path("dist") / dest
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, output)
        print(f"OK: {src} -> {dest}")


if __name__ == "__main__":
    main()
