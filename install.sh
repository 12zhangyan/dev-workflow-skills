#!/usr/bin/env bash
set -euo pipefail

TARBALL="https://github.com/12zhangyan/dev-workflow-skills/archive/refs/heads/main.tar.gz"

if [ "$#" -eq 0 ]; then
  TARGETS="claude cursor codex"
else
  TARGETS="$*"
fi

echo "Installing dev-workflow-skills..."
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

install_target() {
  target="$1"
  case "$target" in
    claude) skills_dir="${HOME}/.claude/skills"; label="Claude Code" ;;
    cursor) skills_dir="${HOME}/.cursor/skills"; label="Cursor" ;;
    codex) skills_dir="${HOME}/.codex/skills"; label="Codex" ;;
    *)
      echo "  ✗ Unknown target: ${target} (allowed: claude cursor codex)" >&2
      return 1
      ;;
  esac

  echo "==> ${label}: ${skills_dir}"
  mkdir -p "$skills_dir"
  for skill in "$SRC_DIR"/*/; do
    name="$(basename "$skill")"
    rm -rf "${skills_dir:?}/${name}"
    cp -r "$skill" "${skills_dir}/${name}"
    echo "  ✓ ${name}"
  done
  echo ""
}

for target in $TARGETS; do
  install_target "$target"
done

echo ""
echo "Done! Restart Claude Code / Cursor / Codex to load the skills."
echo "Claude Code usually uses slash names like /dev-doc; Codex can use \$dev-doc or natural language such as '按 dev-doc 生成开发文档'."
