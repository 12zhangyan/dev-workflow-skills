#!/usr/bin/env bash
# 看板一致性校验兼容入口。
# 核心逻辑在 scripts/check-board-sync.js，便于 Windows PowerShell 直接运行：
#   node scripts/check-board-sync.js

set -u
cd "$(dirname "$0")/.."
node scripts/check-board-sync.js
