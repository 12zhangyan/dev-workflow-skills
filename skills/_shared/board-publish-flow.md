# Shared board publishing flow

仅在调用方已决定发布看板并写好面向同事的 entry 时加载。本文件只负责安全写入和构建，不规定业务叙述模板。

## 不变量

- 业务数据只通过 `project-html/board-add.js` 写入；禁止整体重写或手工插入 `data/changes.js`。
- entry 使用标准 JSON；字符串换行写 `\n`，Mermaid 也是普通字符串，不使用反引号。
- 看板是人类可读摘要，不复制完整执行文档、diff、Agent prompt、精确 Todo、堆栈或秘密。
- `board-add.js` 负责稳定身份匹配、幂等事件、保留治理状态、备份和记录数回归；失败时不得绕过。

## 发布

1. 按 [board-shell-bootstrap.md](board-shell-bootstrap.md) 检查并按需初始化或升级外壳；永不覆盖已有 `data/`。模板不可用时报告 `BoardPublishSkipped`，不临时发明外壳。
2. 将调用方 entry 写入 `project-html/data/_entry.json`，运行：

   ```text
   node project-html/board-add.js project-html/data/_entry.json
   ```

   脚本失败时保留临时 JSON 和错误证据，报告 `BoardPublishBlocked`。成功后是否清理临时文件遵循用户授权和项目规则，不自动删除。
3. 写入成功后运行 `node project-html/build.js`。只有明确需要单文件外发时才加 `--standalone "<docPath 或 slug>"`。构建失败报告 `BoardBuildBlocked`，不抹掉已成功写入的数据，也不宣称派生产物已生成。

首次创建或新增文件时只报告实际文件和 VCS 状态；是否 add 由项目规则与用户授权决定，不建议目录级兜底，不代用户执行。

## Review 生命周期

Review 仅在稳定 `deliveryId` 或 `sourceDocPath`、明确同步意图、当前协调者拥有发布职责三者同时成立时更新同一档案。内部 reviewer/repair 零发布，协调者至多汇总写入一次；身份缺失时不得创建孤立 Review 条目。

Review entry 只需提供稳定身份、当前结论、有人类意义的摘要，以及有信息增益的 findings/验证/下一动作。保留 finding ID 和稳定 `eventId`；重跑更新同一事件。字段与状态按实际结果裁剪，不为填完整模板制造空数组或状态标签。

## 完成证据

报告 `board-add.js` 结果、实际 catalog/detail 路径、`build.js` 结果、未生成内容和 VCS 边界。只有脚本真实成功才声称 Published；没有调用本流程时不输出看板状态占位。
