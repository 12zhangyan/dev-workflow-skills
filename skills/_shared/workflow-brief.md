# Workflow Brief 轻量交接协议

本协议用于把一次任务从一个 skill 交给下一个 skill 或另一个 AI。目标是减少重复粘贴长文档、减少无效读取，并让下一步先读证据索引，再按需打开全文。

## 使用原则

- 每个会产生下一步动作的 skill，都应在完成输出里给一段 `【Workflow Brief】`。
- Brief 是索引，不是证据本身；涉及判断时仍要读取列出的源文档、diff、源码或测试输出。
- 优先写路径、ID、命令和结论，不粘贴整段源码、整份文档或长 diff。
- 下一位 AI 先读 Brief，再读 `source` / `artifacts` / `changed` 中列出的文件；只有发现冲突、缺证据或任务要求时，才扩展读取范围。
- 业务语义、权限、状态、接口契约、DB 结构、数据修复等不可逆或高风险事项，不能只靠 Brief 推断，必须回到原始证据。

## 标准格式

```text
【Workflow Brief】
stage: <PlanGate / ImplementationGate / VCSGate / VerificationGate / ReviewGate / ReviewRepair / UnderstandingGate / SubmitGate>
task: <任务名或一句话目标>
source: <本轮依据的原始输入，如 docs/...md、review-task、fix-handoff、findings 来源>
artifacts: <本轮生成或更新的文档、OpenAPI、看板、索引路径>
changed: <本轮涉及的源码/测试/配置/SQL/XML/OpenAPI 文件；没有写 无>
vcs: <git/svn status 摘要；未检查写 未检查 + 原因>
tests: <验证命令 + 结果；未运行写 未运行 + 原因>
api: <OpenAPI YAML/INDEX 路径；无接口变更写 无>
openFindings: <未关闭 finding/blocker/deferred-next-batch；没有写 无>
next: <下一步应运行的 skill 或人工动作>
tokenHint: <下一位 AI 的最小读取顺序，例如 先读本 Brief -> docs/... -> changed 文件>
```

## Brief 自身也要精简

Brief 是索引，不是第二份文档。避免它反噬 token 收益：

- 只填标准格式里的固定字段，一字段一行；整块控制在约 12 行内。
- 字段无内容写 `无` / `未运行 + 原因` / `未检查 + 原因`，不要留空、不要展开解释。
- 不在 Brief 里复述问题正文、方案细节或源码；`openFindings` 只写 ID 摘要（如 `CR-1, IM-2`），正文在 findings 里。
- `changed` / `artifacts` 只列路径，不加描述；`tokenHint` 给读取顺序，不复述内容。

## Token 节省规则

- 不把 `dev-doc`、`review-task`、`fix-handoff` 全文反复复制给后续 AI；复制 Brief + 路径即可。
- 不把完整 diff 粘贴给 review；提供 VCS 命令、关键文件列表和 review-task 路径，让 reviewer 在本地读取。
- Findings 回传时保留 ID、文件、问题、证据、修复建议和验证方式；无关叙述删掉。
- 修复后回填只写处理表、验证结果和 Brief；不要复述完整方案。
