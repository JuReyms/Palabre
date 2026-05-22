#!/usr/bin/env python3
"""Sync localized docs/guide pages to the Nuxt Content tree used by Palabre-app.

Source pages already use the same Markdown/frontmatter format as the docs site.
French pages live in docs/guide/fr/** and map to content/fr/**.
English pages live in docs/guide/en/** and map to content/en/**.
This script validates the required frontmatter and copies pages to their
numbered Nuxt Content destinations.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROUTE_MAP = {
    "get-started/introduction.md": "1.get-started/1.introduction.md",
    "get-started/installation.md": "1.get-started/2.installation.md",
    "get-started/configuration.md": "1.get-started/3.configuration.md",
    "get-started/first-debate.md": "1.get-started/4.first-debate.md",
    "get-started/vscode-extension.md": "1.get-started/5.vscode-extension.md",
    "agents/overview.md": "2.agents/1.overview.md",
    "agents/claude-code.md": "2.agents/2.claude-code.md",
    "agents/codex.md": "2.agents/3.codex.md",
    "agents/gemini.md": "2.agents/4.gemini.md",
    "agents/antigravity.md": "2.agents/5.antigravity.md",
    "agents/opencode.md": "2.agents/6.opencode.md",
    "agents/ollama.md": "2.agents/7.ollama.md",
    "usage/running-a-debate.md": "3.usage/1.running-a-debate.md",
    "usage/context-and-files.md": "3.usage/2.context-and-files.md",
    "usage/summaries.md": "3.usage/3.summaries.md",
    "usage/exports.md": "3.usage/4.exports.md",
    "configuration/overview.md": "4.configuration/1.overview.md",
    "configuration/defaults.md": "4.configuration/2.defaults.md",
    "configuration/local-vs-global.md": "4.configuration/3.local-vs-global.md",
    "configuration/advanced-json.md": "4.configuration/4.advanced-json.md",
    "reference/cli.md": "5.reference/1.cli.md",
    "reference/config-file.md": "5.reference/2.config-file.md",
    "reference/presets.md": "5.reference/3.presets.md",
    "troubleshooting.md": "6.troubleshooting.md",
    "roadmap.md": "7.roadmap.md",
}

LOCALES = ("fr", "en")
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


def sync_page(locale: str, route: str, numbered_route: str) -> None:
    source = Path("docs") / "guide" / locale / route
    if not source.exists():
        raise SystemExit(f"Missing localized source: {source}")

    text = source.read_text(encoding="utf-8")
    validate_frontmatter(source, text)

    output = Path("dist") / "content" / locale / numbered_route
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, output)
    print(f"OK: {source} -> {output.relative_to('dist')}")


def main() -> None:
    for locale in LOCALES:
        for route, numbered_route in ROUTE_MAP.items():
            sync_page(locale, route, numbered_route)


if __name__ == "__main__":
    main()
