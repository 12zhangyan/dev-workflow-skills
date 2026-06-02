#!/usr/bin/env bash
set -e

REPO="https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main"
SKILLS_DIR="${HOME}/.claude/skills"

FILES=(
  "dev-doc/SKILL.md"
  "dev-doc/reference.md"
  "dev-doc/examples.md"
  "code-reading/SKILL.md"
  "code-reading/reference.md"
)

echo "Installing dev-workflow-skills to ${SKILLS_DIR}..."
echo ""

for file in "${FILES[@]}"; do
  dir="${SKILLS_DIR}/$(dirname "$file")"
  mkdir -p "$dir"
  curl -fsSL "${REPO}/skills/${file}" -o "${SKILLS_DIR}/${file}"
  echo "  ✓ ${file}"
done

echo ""
echo "Done! Restart Claude Code and try /dev-doc or /code-reading"
