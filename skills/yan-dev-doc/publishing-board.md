# HTML 看板发布流程

仅在用户明确要求登记/更新/发布看板，或项目级规则明确要求时读取。仓库里已有 `project-html/` 不是进入条件。

## 边界

- md 面向 Agent 执行；看板 entry 是独立撰写、面向同事的人类方案，不截取 md 段落。
- 修改目录和详情一律走 `node project-html/board-add.js project-html/data/_entry.json`。
- 禁止用宿主文件能力整体重写 `data/changes.js`。
- `changeList`、`todos`、`stackTrace`、`codeLocation` 不得进入看板。

## 1. 初始化或升级外壳

运行：

```text
node <helper> file-state project-html/data/changes.js
node <_shared/scripts/board-bootstrap.js> status <项目根目录>
```

- `MISSING`：先迁移旧单文件看板中的 `changes` / `htmlChangelog`；否则运行 adapter 的 `sync` 初始化空目录。
- `EXISTS_READABLE`：`BOARD_SHELL_UPGRADE_REQUIRED` 时运行 `sync`；它只复制外壳，不覆盖 `data/`。
- `EXISTS_UNREADABLE_OR_UNKNOWN` 或 `BOARD_TEMPLATE_ERROR`：停止发布，不手改数据绕过。

升级到 v23+ 时运行 `node project-html/board-add.js --migrate` 拆分旧富记录。详细 adapter 契约见 [共享看板外壳引导](../_shared/board-shell-bootstrap.md)。

## 2. 编写人类方案 entry

结构字段直接来自方案：

- `service`、`module`、`title`、`date`、`type`、`complexity`、`status:"草稿"`；
- `branch`、`docPath`；
- 仅接口新增/契约变更时写 `apiSpecPath`、`apiIndexPath` 和 `apis[]`。

叙述字段必须重新面向人类写：

- `background`：业务痛点和触发原因；
- `goals`、`scopeIn`、`scopeOut`：业务和方案边界；
- `solution`：整体数据流和实现方式；
- `coreDesign`：真正存在的技术取舍；
- `keyImpl`：3–6 个“问题 → 做法 → 原因”决策点；
- `flowchart`：无代码围栏的 Mermaid。

使用当前宿主文件能力把标准 JSON 写入 `project-html/data/_entry.json`。字符串双引号，换行写 `\n`，不使用反引号；空字段省略。

```json
{
  "changelog": "新增文档：<title>",
  "entry": {
    "service": "<service>",
    "module": "<module>",
    "title": "<title>",
    "date": "<date>",
    "type": "<type>",
    "complexity": "<complexity>",
    "status": "草稿",
    "branch": "<branch>",
    "docPath": "<docPath>",
    "background": "<background>",
    "goals": ["<goal>"],
    "scopeIn": ["<scope>"],
    "scopeOut": ["<non-goal>"],
    "apis": [],
    "solution": "<solution>",
    "keyImpl": [{"title": "<decision>", "desc": "<problem -> choice -> reason>"}],
    "flowchart": "<mermaid>"
  }
}
```

## 3. 确定性写入和构建

1. 运行 `node project-html/board-add.js project-html/data/_entry.json`。
2. 成功后删除临时 JSON；失败时保留用于诊断，不手改 `changes.js`。
3. 运行 `node project-html/build.js`，生成轻量详情页和 `docs/INDEX.md`。
4. 只有明确需要单文件外发时运行 `node project-html/build.js --standalone "<docPath 或 slug>"`。

`board-add.js` 负责按 `docPath` 去重、保留治理字段、备份、拆分详情和记录数回归。脚本失败时原数据必须保持不变。

## 4. 完成条件

- entry 是独立的人类方案，不是 md 摘录；
- `data/changes.js` 未被整体重写；
- `board-add.js` 与 `build.js` 均成功；
- 输出 `BoardPublishStatus: Published` 和目录/详情/索引路径；
- 新建看板时只提示精确 VCS 纳管命令，不代用户执行。
