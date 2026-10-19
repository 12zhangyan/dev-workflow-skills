# Shared board publishing flow

仅在调用方已决定发布看板并写好面向同事的 entry 时加载。本文件只负责安全写入和构建，不规定业务叙述模板。

## 不变量

- 业务数据只通过 `project-html/board-add.js` 写入；禁止整体重写或手工插入 `data/changes.js`。
- entry 使用标准 JSON；字符串换行写 `\n`，Mermaid 也是普通字符串，不使用反引号。
- 看板是人类可读摘要，不复制完整执行文档、diff、Agent prompt、精确 Todo、堆栈或秘密。
- `board-add.js` 负责稳定身份匹配、幂等事件、保留治理状态、备份和记录数回归；失败时不得绕过。

## 输入格式

临时 JSON 必须是包装对象，裸 entry 会被拒绝（`输入缺少 entry/catalog 对象`）：

```json
{ "changelog": "<一句话>", "entry": { "title": "", "date": "YYYY-MM-DD", "docPath": "", "service": "", "module": "", "status": "", "kind": "bug|reading|biz（研发档案省略）" }, "detail": { } }
```

目录与接口元数据放在 `entry`；正文字段放在 `entry` 或 `detail` 均可，脚本自动合并拆分，同时提供时以 `detail` 的同名字段为准。看板只显示下列字段，其他字段名会保留但不显示，不要自造：

- 共用：`date` 是记录日期（与文档日期目录一致，事件发生时间写进正文）；`summary` 是一句话结论，显示在标题下方和搜索中；`status` 只用看板状态：`bug` 取 `未修复` / `修复中` / `已修复` / `已验证`，其他取 `待确认` / `草稿` / `进行中` / `已完成`。`background` 为字符串或段落数组；`openQuestions`、`assumptions`、`blockers`、`conflicts` 为字符串数组；`apis` 为 `[{method, url, desc, request?, response?}]`。
- `bug`：`severity`（短标签如 `P1`，显示为类型标签；无依据就省略，看板显示“缺陷”）、`symptom`、`reproSteps[]`、`trigger`、`expected`、`actual`、`impact`、`rootCause`、`fixPlan`、`verifySteps[]`。
- `reading`：`entry`（入口描述，位于外层 `entry` 对象内）、`goals[]`、`scopeIn[]`、`scopeOut[]`、`solution`、`dataFlowSummary`、`coreDesign`、`flowchart`（Mermaid）、`keyImpl[{title, desc}]`、`acceptance[]`。
- `biz`：`roles[{name, channel, scope, desc, entry}]`、`context[{field, source, usage, note}]`、`bizFlow` / `dataFlow` / `sequence` / `stateMachine`（Mermaid）、`dataChanges[{stage, operations[{target, action, fields, check}]}]`、`bizRules[{title, desc}]`、`validations[{stage, rule, failure, check}]`、`testPoints[]`、`dataObjects[{name, phase, action, note}]`。
- 研发档案的 `delivery.plan` 字段见 yan-dev-doc 的发布协议。

主体已证实、个别期望待确认时正常发布，待确认项写入 `openQuestions`；整体未证实时 `status` 写 `待确认`。续写时省略 `status` 保留原状态，显式提供则更新；普通列表用 `[]` 清空，审查 `events` 按 `eventId` 合并，空事件列表保留历史。

## 发布

1. 按 [board-shell-bootstrap.md](board-shell-bootstrap.md) 检查完整性与发布兼容性，按需初始化或修复外壳；永不覆盖已有 `data/`。模板不可用时报告 `BoardPublishSkipped`，不临时发明外壳。
2. 调用共享 `workflow-fs.js prepare-board-entry project-html/data`，创建包含 `{}` 的本次独占临时 JSON 并返回路径；这是已创建的文件，将调用方 entry 填写到该文件（编辑或覆盖本次占位内容，不用仅新建 / `wx` 模式），再运行：

   ```text
   node project-html/board-add.js "<本次返回的绝对路径>"
   ```

   每次发布单独分配输入，不复用固定文件或仅按 deliveryId 命名；同一档案也可能同时更新。遇到 `BOARD_WRITE_LOCKED` 保留本次输入，待持锁者结束后用原文件重试，不删除他人的锁。

   脚本失败时保留临时 JSON 和错误证据，报告 `BoardPublishBlocked`。成功时 `board-add.js` 自行删除本次分配的 `data/.entry-*/entry.json` 及其空目录；其他位置的输入文件不动，调用方也不另行删除。`data/changes.js.bak` 只保留上一次写入前的单份备份，每次成功写入都会替换。
3. 写入成功后运行 `node project-html/build.js`。只有明确需要单文件外发时才加 `--standalone "<docPath 或 slug>"`。构建失败报告 `BoardBuildBlocked`，不抹掉已成功写入的数据，也不宣称派生产物已生成。

首次自动初始化 `project-html/` 时明确告知用户新建了看板及其路径；首次创建或新增文件时只报告实际文件和 VCS 状态；是否 add 由项目规则与用户授权决定，不建议目录级兜底，不代用户执行。

## Review 生命周期

Review 在稳定 `deliveryId` 或 `sourceDocPath` 匹配到已有档案、且当前协调者拥有发布职责时更新同一档案：repair/loop/package 默认同步，check 需用户明确要求记录生命周期，用户明确不要看板时跳过。内部 reviewer/repair 零发布，协调者至多汇总写入一次；身份缺失或档案不存在时不得创建孤立 Review 条目。

Review entry 只需提供稳定身份、当前结论、有人类意义的摘要，以及有信息增益的 findings/验证/下一动作。保留 finding ID 和稳定 `eventId`；重跑更新同一事件。字段与状态按实际结果裁剪，不为填完整模板制造空数组或状态标签。

## 完成证据

报告 `board-add.js` 结果、实际 catalog/detail 路径、`build.js` 结果（含它重写的 `docs/INDEX.md`）、未生成内容和 VCS 边界。只有脚本真实成功才声称 Published；本来不发布看板的路径（ImpactAnalysis、未要求记录生命周期的 check、无匹配档案的 review）不输出看板状态占位；默认发布路径未发布时，由调用方报告 `BoardPublishSkipped`/`BoardPublishBlocked` 及原因。
