# review-check Reference

> `yan-code-review mode=check` 的审查清单和输出格式。该 mode 只读，不修复。

---

## 审查清单

| 类别 | 必查问题 | 常见证据 |
|------|----------|----------|
| 需求一致性 | 实现是否偏离 yan-dev-doc / Review 任务包目标；是否漏掉范围内要求 | yan-dev-doc 目标、代码变更清单、接口约定 |
| 需求/实现冲突 | 用户口径、yan-dev-doc、现有状态机、字典、权限、数据归属、表复用、接口先后依赖是否矛盾 | 状态枚举、权限注解、Mapper 条件、历史逻辑、接口契约 |
| 业务正确性 | 状态、金额、数量、权限、库存、审批、幂等等核心规则是否正确 | Service 分支、枚举流转、Mapper 条件 |
| 边界与异常 | null、空集合、非法枚举、重复提交、超长、临界值、异常吞掉 | if/else、校验注解、catch 块、默认值 |
| 事务 | `@Transactional(rollbackFor = Exception.class)`、回滚边界、跨服务调用、分页清理 | 注解位置、异常类型、PageHelper 使用 |
| 并发 | 重复请求、竞态、锁粒度、批量更新一致性、幂等 key | Redis/DB 锁、唯一约束、状态更新条件 |
| 安全 | 越权、敏感日志、SQL/表达式注入、明文凭证、生产连接串 | Controller 权限、日志、XML SQL、配置文件 |
| 前端鉴权 | 路由守卫、token 刷新队列、登录跳转、管理员权限判断是否一致 | router、store、request.ts、用户角色字段 |
| SSE/流式 | EventSource token、error/done 事件、连接中断、重复消费、loading 收尾 | SSE Controller、JWT Filter、前端 addEventListener |
| 富文本/预览 | `v-html` 是否消毒、iframe 地址是否可信、生成内容是否越权访问 | sanitize、iframe src、静态资源 Controller |
| AI 文件沙箱 | 文件读写是否限制在应用目录；覆盖写是否需先读；生成/修改模式是否会误判半成品 | FileRead/Write/List Tool、PathResolver、部署逻辑 |
| 性能 | 循环内 DB/远程调用、N+1、全表扫描、大对象加载、缺少批量查询 | for 循环、Mapper 调用、分页、查询条件 |
| 兼容 | 接口签名、响应字段、枚举值、配置默认值、老数据兼容 | DTO、Controller、OpenAPI、配置读取 |
| 配置部署 | CORS、JWT、Redis、LLM profile、Docker、CI 是否和运行文档一致 | yml/env/Dockerfile/workflow/README |
| 测试 | 是否覆盖主流程、异常、边界、回归；测试是否真的调用目标逻辑并断言结果；测试属于 Hermetic、ServiceBacked、LiveExternal 还是 Mixed；默认 CI 是否错误依赖真实凭据/外部服务 | 测试类、注解/tag/profile、配置、CI workflow、断言对象、mvn/gradle 命令 |
| 提交完整性 | 新增/修改的源码、测试、配置、SQL/XML、前端资源是否已纳入 Git/SVN；是否存在本地测试能跑但提交后缺文件 | `git status --short`、`svn status`、diff 文件列表、测试类路径 |

---

## 输出格式

**Finding ID 规则（全链路可追溯的起点）**：每条 finding 必须带稳定 ID，`Critical → CR-n`、`Important → IM-n`、`Minor → MI-n`，n 在本级别内从 1 递增。这个 ID 会被 `review-fix` 汇总时原样保留、被 `review-repair` 修复时按 ID 回填状态，保证"发现→修复→关闭"一一对应。`openFindings` 里只写 ID 摘要（如 `CR-1, IM-2`），不复述问题正文。

```text
审查结论：发现 <数量> 个需要处理的问题（Critical <n> / Important <n> / Minor <n>）。
你现在需要做什么：<最优先处理项；用户已要求修改时写 repair，要求多 AI/归档时写 package，否则写人工确认处理方式>
验证结果：<一句话说明测试是否运行及结果>

以下是技术回执（供后续 AI / 审计，可跳过）。

来源：Code Review
审查对象：<review-task/yan-dev-doc/patch/功能描述>
ReviewScopeType: <PlanReview / ImplementationReview / FixHandoffReview>
审查范围：<已读取的关键文件/文档>
结论状态：Findings
VerificationStatus: <已运行/未运行/未提供；命令、结果或未运行原因>
TestDependencyClass: <Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown / NotApplicable；说明默认命令边界>
TestEvidenceStatus: <Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable；说明测试是否验证目标逻辑>
BoardPublishStatus: <Published: deliveryId/sourceDocPath / Blocked: IdentityMissing|BuildFailure>

【Workflow Brief】
stage: ReviewGate
task: <任务名或审查对象>
source: <review-task/yan-dev-doc/patch/diff 路径>
artifacts: 本次只读审查输出；同一研发档案的 check 看板事件
changed: <审查到的源码/测试/配置/OpenAPI 文件>
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管范围>; untracked=<未纳管源码/测试/OpenAPI/docs 或 无；未检查写原因>
tests: class=<Hermetic/ServiceBacked/LiveExternal/Mixed/Unknown/NotApplicable>; command/result=<验证命令 + 结果；未提供写未提供；environment-blocked 写工具链版本>
api: spec=<OpenAPI YAML 路径或 无>; index=<API 索引路径或 无>; operationIds=<新增/变更接口 ID 或 无>
openFindings: <Critical/Important/Minor ID 摘要，如 CR-1, IM-2；没有写 无>
next: <按用户当前目标只选一项：package 汇总/归档；repair 直接修复；人工确认>
nextCommand: <与 next 对应的一条命令；不要同时给 package 和 repair>
tokenHint: 下一位 AI 先读本 Brief -> finding 指向文件 -> review-task 中证据包；只在冲突时扩展读取全文；首轮最多 5 个文件

Critical:
CR-1. Severity: Critical
   File/Line: <path:line 或 Class.method>
   Problem: <问题是什么>
   Evidence: <来自 diff/源码/文档的证据>
   Impact: <可能造成什么后果>
   Fix: <建议怎么修>
   Verify: <如何验证>

Important:
IM-1. Severity: Important
   File/Line:
   Problem:
   Evidence:
   Impact:
   Fix:
   Verify:

Minor:
MI-1. Severity: Minor
   File/Line:
   Problem:
   Evidence:
   Impact:
   Fix:
   Verify:

Notes:
- <证据不足、非阻塞建议或已检查但未发现问题的说明>

OpenQuestions:
- <材料不足或需要业务确认的问题；阻塞项标注 blocking>

下一步：<只保留与用户当前目标一致的一项：package / repair / 人工确认>

```

没有 findings 时：

```text
审查结论：通过——在已检查范围内未发现需要修复的问题。
你现在需要做什么：<Review Gate 满足时写“人工复核并按项目流程提交范围内文件”；否则写唯一未完成动作>
验证结果：<例如“17 个测试全部通过”；未运行时说明原因，不能写通过>

检查范围：
- <面向人的文件/功能范围，最多 5 项>

已确认：
- <关键规则或回归点 1>
- <关键规则或回归点 2>

需要人工留意：
- <真正仍需人工确认的非阻塞项；没有写“无”>

以下是技术回执（供后续 AI / 审计，可跳过）。

来源：Code Review
审查对象：<...>
ReviewScopeType: <PlanReview / ImplementationReview / FixHandoffReview>
审查范围：<...>
结论状态：NoEvidenceIssue
VerificationStatus: <已运行/未运行/未提供；命令、结果或未运行原因>
TestDependencyClass: <Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown / NotApplicable；说明默认命令边界>
TestEvidenceStatus: <Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable；说明测试是否验证目标逻辑>
BoardPublishStatus: <Published: deliveryId/sourceDocPath / Blocked: IdentityMissing|BuildFailure>

【Workflow Brief】
stage: ReviewGate
task: <任务名或审查对象>
source: <review-task/yan-dev-doc/patch/diff 路径>
artifacts: 本次只读审查输出；同一研发档案的 check 看板事件
changed: <审查到的源码/测试/配置/OpenAPI 文件>
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管范围>; untracked=<未纳管源码/测试/OpenAPI/docs 或 无；未检查写原因>
tests: class=<Hermetic/ServiceBacked/LiveExternal/Mixed/Unknown/NotApplicable>; command/result=<验证命令 + 结果；未提供写未提供；environment-blocked 写工具链版本>
api: spec=<OpenAPI YAML 路径或 无>; index=<API 索引路径或 无>; operationIds=<新增/变更接口 ID 或 无>
openFindings: 无
next: 本次没有需要修复的 findings；<人工复核并提交 / 当前既定下一步>
nextCommand: <一条人工或 skill 命令；用户未要求归档时不要推荐 package>
tokenHint: 下一位 AI 先读本 Brief -> review-task -> changed 文件；无须重复粘贴 findings；首轮最多 5 个文件

本次没有需要修复的 findings，不进入 repair；未明确要求审查归档时不进入 package。

```

材料不足时：

```text
审查结论：暂时无法判断——关键材料不足。
你现在需要做什么：<只列最小缺失材料和补充方式>
验证结果：<未运行/未提供/environment-blocked 及原因>

以下是技术回执（供后续 AI / 审计，可跳过）。

来源：Code Review
审查对象：<...>
ReviewScopeType: <PlanReview / ImplementationReview / FixHandoffReview>
审查范围：<已读取的材料>
结论状态：InsufficientMaterial
VerificationStatus: <已运行/未运行/未提供；命令、结果或未运行原因>
TestDependencyClass: <Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown / NotApplicable；说明默认命令边界>
TestEvidenceStatus: <Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable；缺失或阻塞原因>
BoardPublishStatus: <Published: deliveryId/sourceDocPath / Blocked: IdentityMissing|BuildFailure>

【Workflow Brief】
stage: ReviewGate
task: <任务名或审查对象>
source: <已提供材料路径>
artifacts: 本次只读审查输出；能定位身份时写入同一研发档案的 InsufficientMaterial 事件
changed: <已读取文件；未知写 未确认>
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管范围>; untracked=<未纳管源码/测试/OpenAPI/docs 或 无；未检查写原因>
tests: class=<Hermetic/ServiceBacked/LiveExternal/Mixed/Unknown/NotApplicable>; command/result=<验证命令 + 结果；未提供写未提供；environment-blocked 写工具链版本>
api: spec=<OpenAPI YAML 路径或 无/未确认>; index=<API 索引路径或 无/未确认>; operationIds=<新增/变更接口 ID 或 无/未确认>
openFindings: 无（材料不足，未下结论）；阻塞：缺失材料待补齐
next: 补齐缺失材料后重新 review-check；不要进入 review-repair
nextCommand: 补齐缺失材料后，使用 yan-code-review skill，mode=check，基于 source 重新执行只读审查
tokenHint: 下一位 AI 先读本 Brief -> 缺失材料清单 -> 补齐后的 review-task，再重新审查；首轮最多 5 个文件

材料不足，无法对以下范围下结论：
- <范围 1，如状态流转正确性>
- <范围 2，如权限边界>

缺失材料：
- <缺失的 yan-dev-doc / diff / 关键源码 / 字典 / 权限说明 / 测试结果>

已能确认：
- <基于现有材料可以确认的事实>

OpenQuestions:
- blocking: <必须补充的问题>

下一步：补齐上述材料后重新运行 `yan-code-review mode=check`；不得进入 repair。

```
