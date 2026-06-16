#!/usr/bin/env bash
set -euo pipefail

TARBALL="https://github.com/12zhangyan/dev-workflow-skills/archive/refs/heads/main.tar.gz"
SKILLS_DIR="${HOME}/.claude/skills"

echo "Installing dev-workflow-skills to ${SKILLS_DIR}..."
echo ""

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if ! curl -fsSL "$TARBALL" | tar -xz -C "$TMP_DIR"; then
  echo "  ✗ Failed to download ${TARBALL}" >&2
  exit 1
fi

SRC_DIR="$(find "$TMP_DIR" -maxdepth 2 -type d -name skills | head -1)"
if [ -z "$SRC_DIR" ]; then
  echo "  ✗ skills/ directory not found in downloaded archive" >&2
  exit 1
fi

mkdir -p "$SKILLS_DIR"
for skill in "$SRC_DIR"/*/; do
  name="$(basename "$skill")"
  rm -rf "${SKILLS_DIR:?}/${name}"
  cp -r "$skill" "${SKILLS_DIR}/${name}"
  echo "  ✓ ${name}"
done

echo ""
echo "Done! Restart Claude Code and try /dev-doc, /bug-fix, /code-reading or /biz-flow"
