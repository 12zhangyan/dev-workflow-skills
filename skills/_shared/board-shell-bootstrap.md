# 看板外壳定位、复制与版本检查

仅当 `yan-dev-doc`、incident、business 或 understanding/CodeMap 需要创建看板、比较外壳版本或升级外壳时读取。本流程完成外壳检查和旧数据迁移；Entry 字段由调用 mode 决定，随后按共享发布流程写入并构建。

## 执行约束

- 使用共享 Node adapter，不依赖 Bash、PowerShell、前一次终端调用的变量或固定宿主目录。
- 复制范围只有外壳、构建脚本和写入脚本。`data/changes.js` 仅在目标不存在时初始化；不得覆盖既有 `data/` 或 `data/details/`。
- `js/vendor/mermaid.min.js` 由 adapter 做二进制复制，禁止读取后用文本写入。
- Adapter 会先使用当前 skill 树的 yan-dev-doc 资产，再检查显式环境配置和 Claude Code、Cursor、Codex、通用安装根。

## 只读比较版本

```text
node <_shared/scripts/board-bootstrap.js 绝对路径> status <项目根目录>
```

- `BOARD_SHELL_CURRENT`：不复制外壳，继续下方数据格式检查。
- `BOARD_SHELL_UPGRADE_REQUIRED`：执行下一节 `sync`；外壳升级不迁移业务数据。
- `BOARD_TEMPLATE_ERROR`：显式停止看板写入，不手改 `data/changes.js` 绕过。

## 初始化或升级外壳

```text
node <_shared/scripts/board-bootstrap.js 绝对路径> sync <项目根目录>
```

`sync` 创建所需目录，复制 `index.html`、CSS、board.js、Mermaid vendor、`build.js`、`board-add.js`；只有 `project-html/data/changes.js` 不存在时才复制空模板，并始终保留已有详情 sidecar。成功输出 `BOARD_SHELL_SYNCED=<版本>`。

## 写入前检查数据格式

外壳可用后，无论本轮是否升级，都先运行 `node project-html/board-add.js --check-migration`。该命令只读：

- `BOARD_DATA_CURRENT`：继续 entry 写入。
- `BOARD_DATA_MIGRATION_REQUIRED`：旧目录仍含正文或缺少详情指针；在本次已授权的看板发布范围内运行 `node project-html/board-add.js --migrate`，再检查得到 `BOARD_DATA_CURRENT` 后继续。迁移保留原目录备份、记录和治理状态，不从 md 摘录正文。
- 检查或迁移失败：停止后续 entry 写入和构建，保留错误证据，不绕过校验或覆盖旧数据。
