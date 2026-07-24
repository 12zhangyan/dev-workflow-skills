#!/usr/bin/env bash
set -euo pipefail

TARBALL="${DEV_WORKFLOW_SKILLS_TARBALL:-https://github.com/12zhangyan/dev-workflow-skills/archive/refs/heads/main.tar.gz}"
COMMAND="install"
MIGRATE_LEGACY="false"
TARGETS=()

for arg in "$@"; do
  case "$arg" in
    status) COMMAND="status" ;;
    --migrate-legacy) MIGRATE_LEGACY="true" ;;
    claude|cursor|codex) TARGETS+=("$arg") ;;
    *)
      echo "[ERROR] Unknown argument: $arg" >&2
      echo "Allowed: status claude cursor codex --migrate-legacy" >&2
      exit 1
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is required for safe installation and Codex BOM normalization." >&2
  exit 1
fi
if [ -z "${HOME:-}" ]; then
  echo "[ERROR] HOME is required." >&2
  exit 1
fi

echo "Preparing dev-workflow-skills ${COMMAND}..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if ! curl -fsSL "$TARBALL" | tar -xz -C "$TMP_DIR"; then
  echo "[ERROR] Failed to download ${TARBALL}" >&2
  exit 1
fi

CORE="$(find "$TMP_DIR" -maxdepth 3 -type f -path '*/scripts/install-core.js' | head -1)"
if [ -z "$CORE" ]; then
  echo "[ERROR] scripts/install-core.js not found in downloaded archive" >&2
  exit 1
fi
REPO_ROOT="$(cd "$(dirname "$CORE")/.." && pwd)"

ARGS=("$COMMAND" "--source" "$REPO_ROOT" "--home" "$HOME")
if [ "${#TARGETS[@]}" -gt 0 ]; then
  ARGS+=("--targets" "${TARGETS[@]}")
fi
if [ "$MIGRATE_LEGACY" = "true" ]; then
  ARGS+=("--migrate-legacy")
fi

node "$CORE" "${ARGS[@]}"
