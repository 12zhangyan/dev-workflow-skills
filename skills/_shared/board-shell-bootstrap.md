# 看板外壳定位、复制与版本检查

仅当 `yan-dev-doc`、incident、business 或 understanding/CodeMap 需要创建看板、比较外壳版本或升级外壳时读取。Entry 字段、迁移条件、`board-add.js` 和 `build.js` 顺序仍以调用 mode 为准。

## 执行约束

- 使用共享 Node adapter，不依赖 Bash、PowerShell、前一次终端调用的变量或固定宿主目录。
- 复制范围只有外壳、构建脚本和写入脚本。`data/changes.js` 仅在目标不存在时初始化；不得覆盖既有 `data/` 或 `data/details/`。
- `js/vendor/mermaid.min.js` 由 adapter 做二进制复制，禁止读取后用文本写入。
- Adapter 会先使用当前 skill 树的 yan-dev-doc 资产，再检查显式环境配置和 Claude Code、Cursor、Codex、通用安装根。

## 只读比较版本

```text
node <_shared/scripts/board-bootstrap.js 绝对路径> status <项目根目录>
```

- `BOARD_SHELL_CURRENT`：不复制外壳，直接进入 entry 写入。
- `BOARD_SHELL_UPGRADE_REQUIRED`：执行下一节 `sync`；是否运行 `board-add.js --migrate` 仍按调用 mode 的目标版本规则判断。
- `BOARD_TEMPLATE_ERROR`：显式停止看板写入，不手改 `data/changes.js` 绕过。

## 初始化或升级外壳

```text
node <_shared/scripts/board-bootstrap.js 绝对路径> sync <项目根目录>
```

`sync` 创建所需目录，复制 `index.html`、CSS、board.js、Mermaid vendor、`build.js`、`board-add.js`；只有 `project-html/data/changes.js` 不存在时才复制空模板，并始终保留已有详情 sidecar。成功输出 `BOARD_SHELL_SYNCED=<版本>`。
