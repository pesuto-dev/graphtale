#!/usr/bin/env bash
# Copy (not move) local skills into fixtures/user-skills for viewer/parser tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/fixtures/user-skills"
mkdir -p "$DEST/claude" "$DEST/agents"

rsync -a --delete --copy-links \
  --exclude '.DS_Store' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.git' \
  "$HOME/.claude/skills/" "$DEST/claude/"

if [[ -d "$HOME/.agents/skills" ]]; then
  rsync -a --delete --copy-links \
    --exclude '.DS_Store' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.git' \
    "$HOME/.agents/skills/" "$DEST/agents/"
fi

export DEST
python3 <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["DEST"])
manifest = []
for bucket in sorted(p for p in root.iterdir() if p.is_dir() and p.name in ("claude", "agents")):
    for skill in sorted(p for p in bucket.iterdir() if p.is_dir()):
        files = [str(p.relative_to(skill)) for p in skill.rglob("*") if p.is_file()]
        manifest.append(
            {
                "bucket": bucket.name,
                "name": skill.name,
                "has_skill_md": (skill / "SKILL.md").exists(),
                "file_count": len(files),
                "has_workflow": any("workflow" in f.lower() for f in files),
                "has_scripts": any(f.startswith(("scripts/", "bin/")) for f in files),
                "has_refs": any(f.startswith(("references/", "prompts/")) for f in files),
                "has_schemas": any(f.startswith("schemas/") for f in files),
                "files": sorted(files)[:60],
            }
        )
(root / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"Synced {len(manifest)} skills → {root}")
PY
