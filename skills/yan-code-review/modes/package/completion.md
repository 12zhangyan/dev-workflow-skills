# Yan Code Review Package Completion

## 第一阶段完成后输出格式

```
✅ Review 任务包已生成：docs/review-fix/<日期>/<任务名>-review-task.md
🧭 工作流阶段：Review Gate 已创建，等待 review-check findings 回收

【Workflow Brief】
stage: ReviewGate
task: <任务名>
source: <yan-dev-doc/bug 文档/patch/diff/status；ReviewScopeType=<PlanReview / ImplementationReview / FixHandoffReview>>
artifacts: docs/review-fix/<日期>/<任务名>-review-task.md
changed: <任务包中列出的源码/测试/配置/OpenAPI 文件>
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管范围>; untracked=<未纳管源码/测试/OpenAPI/docs 或 无；未检查写原因>
tests: class=<Hermetic/ServiceBacked/LiveExternal/Mixed/Unknown/NotApplicable>; command/result=<已知验证命令 + 结果；没有写未运行原因；environment-blocked 写工具链版本>
api: spec=<OpenAPI YAML 路径或 无>; index=<API 索引路径或 无>; operationIds=<新增/变更接口 ID 或 无>
openFindings: 待 review-check 输出
next: 使用 yan-code-review skill，mode=check，审查 docs/review-fix/<日期>/<任务名>-review-task.md
nextCommand: 使用 yan-code-review skill，mode=check，审查 docs/review-fix/<日期>/<任务名>-review-task.md
tokenHint: reviewer 先读本 Brief -> review-task -> changed 文件 -> 必要 diff/测试输出；首轮最多 5 个文件

如果目标 AI 已安装本仓库 skill，直接让它运行：
使用 yan-code-review skill，mode=check，审查 docs/review-fix/<日期>/<任务名>-review-task.md

否则请把任务包里的提示分别交给 Codex / Cursor / Claude 做审查。
等它们返回 findings 后，把结果贴回来，我再继续汇总并生成修复交接文档。

```

## 第二阶段完成后输出格式

```
✅ Review 修复交接文档已生成：docs/review-fix/<日期>/<任务名>-fix-handoff.md
📋 已汇总 review 结果：Critical <n> / Important <n> / Minor <n> / Rejected <n>
🧭 工作流阶段：Review Gate 修复交接已完成；下一步回到 Verification Gate，修复并重跑验证

【Workflow Brief】
stage: ReviewGate
task: <任务名>
source: docs/review-fix/<日期>/<任务名>-review-task.md；<review-check findings 来源>；ReviewScopeType=<PlanReview / ImplementationReview / FixHandoffReview>
artifacts: docs/review-fix/<日期>/<任务名>-fix-handoff.md
changed: <findings 涉及的源码/测试/配置/OpenAPI 文件>
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管范围>; untracked=<未纳管源码/测试/OpenAPI/docs 或 无；未检查写原因>
tests: class=<Hermetic/ServiceBacked/LiveExternal/Mixed/Unknown/NotApplicable>; command/result=<已知验证命令 + 结果；没有写未运行原因；environment-blocked 写工具链版本>
api: spec=<OpenAPI YAML 路径或 无>; index=<API 索引路径或 无>; operationIds=<新增/变更接口 ID 或 无>
openFindings: <Critical/Important/Minor ID 摘要；Rejected 单独列出>
next: 使用 yan-code-review skill，mode=repair，根据 fix-handoff 直接修复，或人工按交接文档修复
nextCommand: 使用 yan-code-review skill，mode=repair，根据 docs/review-fix/<日期>/<任务名>-fix-handoff.md 直接修复并验证
tokenHint: 修复方先读本 Brief -> fix-handoff -> review-task 中证据包 -> finding 指向的 changed 文件；首轮最多 5 个文件

🤖 AI 修复操作码：
<可直接粘贴给 Codex / Cursor / Claude 的文本>

修复后回填：
- 已修复 finding：<CR/IM ID + 证据>
- 未采纳 finding：<原因>
- 验证命令与结果：<命令 + 结果>
- 是否需要二次 review-check：<是/否，原因>

```
