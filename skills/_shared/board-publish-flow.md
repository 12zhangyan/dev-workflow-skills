# Shared board publishing flow

仅当调用方已经独立写好面向人类的看板 entry 后加载本文件。字段语义和 entry 示例由调用模式负责；本文件只定义三端通用的看板生命周期。

## 不变量

- 只通过 `project-html/board-add.js` 写业务数据；禁止用宿主文件能力整体重写 `data/changes.js`。
- 用 `workflow-fs.js exists` 确定文件状态，不根据读取报错或模型记忆猜测。
- entry 必须是标准 JSON：双引号字符串、内部换行写成 `\n`，不使用反引号。Mermaid 代码也是普通 JSON 字符串。
- `board-add.js` 负责按 `docPath` 去重、保留治理状态、备份和记录数回归；失败时不得手改数据文件绕过保护。
- 看板内容面向未参与当前任务的同事独立撰写，不复制 AI 执行文档段落；调用模式声明的 Agent 专属字段不得进入 entry。

## 1. 确保外壳存在且版本匹配

按 [board-shell-bootstrap.md](board-shell-bootstrap.md) 定位跨平台 helper 和模板，然后运行：

```text
node <helper> exists project-html/data/changes.js
```

- `MISSING`：若旧 `project-html/index.html` 内联 `const changes`，先按外壳引导原样迁移数组；否则复制空数据模板和外壳。两种情况都不在本步写业务 entry。
- `EXISTS`：按外壳引导只读比较版本；仅在 `BOARD_SHELL_UPGRADE_REQUIRED` 时升级外壳，永不覆盖 `data/`。升级旧富记录时运行 `node project-html/board-add.js --migrate`。
- 首次创建后运行 `node <helper> detect-vcs`，只提示相应 `svn add project-html --depth=infinity` 或 `git add project-html`，不得代用户执行。
- 模板和既有看板都不存在：返回 `BoardPublishSkipped`，说明需安装 `yan-dev-doc`；不得临时发明一套外壳。

## 2. 写入 entry

调用方用当前宿主的受控文件修改能力，将其模式定义的标准 JSON 写到 `project-html/data/_entry.json`，再运行：

```text
node project-html/board-add.js project-html/data/_entry.json
```

- 新文档使用“新增…” changelog；更新同一 `docPath` 时使用“更新…”。脚本命中既有条目时就地更新并保留原治理状态。
- 成功且打印记录数后删除 `_entry.json`；失败时保留它用于诊断。
- 语法错误、记录数下降或写入失败：返回 `BoardPublishBlocked`，保留原数据与错误证据，不得降级为手工插入。
- Node.js 不可用：返回 `BoardPublishBlocked` 并给出所需命令，不写看板。看板脚本是确定性安全边界，不能由模型模拟。

## 3. 构建派生产物

写入成功后运行：

```text
node project-html/build.js
```

它增量维护 `project-html/pages/`、`docs/INDEX.md`，并在首次构建时复制归档历史资料而不删除原件。只有用户明确要求单文件外发时才运行：

```text
node project-html/build.js --standalone "<docPath 或 slug>"
```

构建失败时返回 `BoardBuildBlocked`，保留已成功写入的 catalog/detail 和命令输出，不宣称详情页或索引已生成。

## 4. 完成证据

成功输出必须同时报告：

- `board-add.js` 的追加/更新结果与记录数变化；
- catalog `project-html/data/changes.js` 和 detail sidecar 已写入；
- `build.js` 是否成功，以及 `pages/`、`docs/INDEX.md` 的状态；
- VCS add 仅作为建议，未自动执行。
