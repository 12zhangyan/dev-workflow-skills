#!/usr/bin/env bash
set -euo pipefail

COMMAND="install"
MIGRATE_LEGACY="false"
DRY_RUN="false"
BACKUP=""
SKILL=""
KEEP=""
REF="${DEV_WORKFLOW_SKILLS_REF:-main}"
SHA256="${DEV_WORKFLOW_SKILLS_SHA256:-}"
TARGETS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    status) COMMAND="status" ;;
    doctor) COMMAND="doctor" ;;
    backups) COMMAND="backups" ;;
    restore) COMMAND="restore" ;;
    backup-prune) COMMAND="backup-prune" ;;
    --migrate-legacy) MIGRATE_LEGACY="true" ;;
    --dry-run) DRY_RUN="true" ;;
    --backup|--skill|--keep|--ref|--sha256)
      OPTION="$1"
      shift
      if [ "$#" -eq 0 ]; then
        echo "[ERROR] ${OPTION} requires a value" >&2
        exit 1
      fi
      case "$OPTION" in
        --backup) BACKUP="$1" ;;
        --skill) SKILL="$1" ;;
        --keep) KEEP="$1" ;;
        --ref) REF="$1" ;;
        --sha256) SHA256="$1" ;;
      esac
      ;;
    claude|cursor|codex) TARGETS+=("$1") ;;
    *)
      echo "[ERROR] Unknown argument: $1" >&2
      echo "Allowed: status doctor backups restore backup-prune claude cursor codex" >&2
      echo "Options: --dry-run --backup ID --skill NAME --keep N --ref REF --sha256 HASH" >&2
      exit 1
      ;;
  esac
  shift
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

TARBALL="${DEV_WORKFLOW_SKILLS_TARBALL:-https://github.com/12zhangyan/dev-workflow-skills/archive/${REF}.tar.gz}"
ARCHIVE="$TMP_DIR/dev-workflow-skills.tar.gz"
if ! curl -fsSL "$TARBALL" -o "$ARCHIVE"; then
  echo "[ERROR] Failed to download ${TARBALL}" >&2
  exit 1
fi
if [ -n "$SHA256" ] && ! node -e '
  const crypto = require("crypto");
  const fs = require("fs");
  const actual = crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex");
  if (actual.toLowerCase() !== process.argv[2].toLowerCase()) {
    process.stderr.write(`[ERROR] SHA-256 mismatch: expected ${process.argv[2]}, got ${actual}\n`);
    process.exit(1);
  }
' "$ARCHIVE" "$SHA256"; then
  exit 1
fi
if ! tar -xzf "$ARCHIVE" -C "$TMP_DIR"; then
  echo "[ERROR] Failed to extract ${TARBALL}" >&2
  exit 1
fi

CORE="$(find "$TMP_DIR" -maxdepth 3 -type f -path '*/scripts/install-core.js' | head -1)"
if [ -z "$CORE" ]; then
  echo "[ERROR] scripts/install-core.js not found in downloaded archive" >&2
  exit 1
fi
REPO_ROOT="$(cd "$(dirname "$CORE")/.." && pwd)"

ARGS=("$COMMAND" "--source" "$REPO_ROOT" "--home" "$HOME" "--version" "$REF")
if [ "${#TARGETS[@]}" -gt 0 ]; then
  ARGS+=("--targets" "${TARGETS[@]}")
fi
if [ "$MIGRATE_LEGACY" = "true" ]; then
  ARGS+=("--migrate-legacy")
fi
if [ "$DRY_RUN" = "true" ]; then
  ARGS+=("--dry-run")
fi
if [ -n "$BACKUP" ]; then
  ARGS+=("--backup" "$BACKUP")
fi
if [ -n "$SKILL" ]; then
  ARGS+=("--skill" "$SKILL")
fi
if [ -n "$KEEP" ]; then
  ARGS+=("--keep" "$KEEP")
fi

node "$CORE" "${ARGS[@]}"
