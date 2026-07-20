# 看板外壳定位、复制与版本检查

仅当 `dev-doc`、`bug-fix` 或 `biz-flow` 需要创建看板、比较外壳版本或执行外壳升级时读取本文件。各 Skill 的 entry 字段、文案、`kind`、迁移条件、`board-add.js` 和 `build.js` 顺序仍以各自 `SKILL.md` 为准。

## 执行约束

- 下面两个命令块都自行定位模板目录，不依赖前一次 shell 调用留下的 `$src`。
- 复制范围只包含外壳、构建脚本和写入脚本。`data/changes.js` 仅在目标文件不存在时初始化；不得覆盖既有 `data/` 或 `data/details/`。
- `js/vendor/mermaid.min.js` 约 3 MB，只能用 `cp` 复制，禁止 Read+Write。

## 定位并复制或升级外壳

```bash
src=""
for candidate in \
  "$HOME/.codex/skills/dev-doc/assets/board" \
  "$HOME/.claude/skills/dev-doc/assets/board" \
  "$HOME/.cursor/skills/dev-doc/assets/board" \
  "$HOME/.agents/skills/dev-doc/assets/board"
do
  if [ -d "$candidate" ]; then src="$candidate"; break; fi
done
[ -n "$src" ] || { echo "BOARD_TEMPLATE_MISSING: dev-doc/assets/board not found"; exit 1; }
mkdir -p project-html/css project-html/js/vendor project-html/data/details
cp "$src/index.html" project-html/index.html
cp "$src/css/board.css" project-html/css/board.css
cp "$src/js/board.js" project-html/js/board.js
cp "$src/js/vendor/mermaid.min.js" project-html/js/vendor/mermaid.min.js
cp "$src/build.js" project-html/build.js
cp "$src/board-add.js" project-html/board-add.js
test -f project-html/data/changes.js || cp "$src/data/changes.js" project-html/data/changes.js
```

若模板确实安装在其他位置且 `cp` 无法定位，只能从 [dev-doc 看板资产](../dev-doc/assets/board/) 逐个读取并写入 `index.html`、CSS、JS、`build.js` 和 `board-add.js`；跳过 vendor，让看板使用 Mermaid CDN 回退。不得把路径未知解释为目标看板不存在，也不得覆盖数据文件。

## 只读比较版本

```bash
src=""
for candidate in \
  "$HOME/.codex/skills/dev-doc/assets/board" \
  "$HOME/.claude/skills/dev-doc/assets/board" \
  "$HOME/.cursor/skills/dev-doc/assets/board" \
  "$HOME/.agents/skills/dev-doc/assets/board"
do
  if [ -d "$candidate" ]; then src="$candidate"; break; fi
done
[ -n "$src" ] || { echo "BOARD_TEMPLATE_MISSING: dev-doc/assets/board not found"; exit 1; }
project_version=$(grep -m1 -E 'BOARD_VERSION[[:space:]]*=[[:space:]]*[0-9]+' project-html/js/board.js 2>/dev/null | sed -E 's/.*=[[:space:]]*([0-9]+).*/\1/')
template_version=$(grep -m1 -E 'BOARD_VERSION[[:space:]]*=[[:space:]]*[0-9]+' "$src/js/board.js" | sed -E 's/.*=[[:space:]]*([0-9]+).*/\1/')
[ -n "$template_version" ] || { echo "BOARD_TEMPLATE_VERSION_MISSING"; exit 1; }
echo "PROJECT_BOARD_VERSION=${project_version:-MISSING}"
echo "TEMPLATE_BOARD_VERSION=$template_version"
if [ -z "$project_version" ] || [ "$project_version" -lt "$template_version" ]; then
  echo "BOARD_SHELL_UPGRADE_REQUIRED"
else
  echo "BOARD_SHELL_CURRENT"
fi
```

- 输出 `BOARD_SHELL_UPGRADE_REQUIRED`：执行上一节复制命令；是否需要 `board-add.js --migrate` 仍按调用 Skill 的目标版本规则判断。
- 输出 `BOARD_SHELL_CURRENT`：不复制外壳，直接进入该 Skill 的 entry 写入步骤。
- 任一 `BOARD_TEMPLATE_*` 错误：显式报告并停止看板写入；不要手改 `data/changes.js` 绕过。
