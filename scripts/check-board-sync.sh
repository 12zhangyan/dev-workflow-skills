#!/usr/bin/env bash
# 看板一致性校验：
#   1. project-html/ 与 skills/dev-doc/assets/board/ 的外壳文件必须字节一致（CLAUDE.md 约定）
#   2. board.js 与项目侧 data/changes.js 必须通过 node --check
#      （模板 data/changes.js 含 <占位符>，跳过语法检查）
# 本地直接运行：bash scripts/check-board-sync.sh；CI 见 .github/workflows/check.yml

set -u
cd "$(dirname "$0")/.."
fail=0

for f in index.html css/board.css js/board.js js/vendor/mermaid.min.js build.js; do
  if ! cmp -s "project-html/$f" "skills/dev-doc/assets/board/$f"; then
    echo "✗ 外壳不同步: $f（两份拷贝必须字节一致）"
    fail=1
  fi
done

for f in project-html/js/board.js project-html/build.js project-html/data/changes.js; do
  if ! node --check "$f" 2>&1; then
    echo "✗ 语法错误: $f"
    fail=1
  fi
done

if ! grep -q "BOARD_VERSION = [0-9]" project-html/js/board.js; then
  echo "✗ project-html/js/board.js 缺少 BOARD_VERSION 常量"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "✓ 看板同步与语法检查通过（$(grep -m1 -o 'BOARD_VERSION = [0-9]*' project-html/js/board.js)）"
fi
exit "$fail"
