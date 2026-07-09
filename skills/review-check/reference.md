# review-check Reference

> `/review-check` 的审查清单和输出格式。该 skill 只读，不修复。

---

## 审查清单

| 类别 | 必查问题 | 常见证据 |
|------|----------|----------|
| 需求一致性 | 实现是否偏离 dev-doc / Review 任务包目标；是否漏掉范围内要求 | dev-doc 目标、代码变更清单、接口约定 |
| 需求/实现冲突 | 用户口径、dev-doc、现有状态机、字典、权限、数据归属、表复用、接口先后依赖是否矛盾 | 状态枚举、权限注解、Mapper 条件、历史逻辑、接口契约 |
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
| 测试 | 是否覆盖主流程、异常、边界、回归；验证命令是否能证明风险已解除 | 测试类、用例数据、mvn/gradle 命令 |
| 提交完整性 | 新增/修改的源码、测试、配置、SQL/XML、前端资源是否已纳入 Git/SVN；是否存在本地测试能跑但提交后缺文件 | `git status --short`、`svn status`、diff 文件列表、测试类路径 |

---

## 输出格式

**Finding ID 规则（全链路可追溯的起点）**：每条 finding 必须带稳定 ID，`Critical → CR-n`、`Important → IM-n`、`Minor → MI-n`，n 在本级别内从 1 递增。这个 ID 会被 `review-fix` 汇总时原样保留、被 `review-repair` 修复时按 ID 回填状态，保证"发现→修复→关闭"一一对应。`openFindings` 里只写 ID 摘要（如 `CR-1, IM-2`），不复述问题正文。

```text
来源：Code Review
审查对象：<review-task/dev-doc/patch/功能描述>
审查范围：<已读取的关键文件/文档>
结论状态：Findings
VerificationStatus: <已运行/未运行/未提供；命令、结果或未运行原因>

【Workflow Brief】
stage: ReviewGate
task: <任务名或审查对象>
source: <review-task/dev-doc/patch/diff 路径>
artifacts: 本次只读审查输出；无文件写入
changed: <审查到的源码/测试/配置/OpenAPI 文件>
vcs: <git/svn status 摘要；未检查写原因>
tests: <验证命令 + 结果；未提供写 未提供>
api: <OpenAPI YAML/INDEX 路径；无接口变更写 无>
openFindings: <Critical/Important/Minor ID 摘要，如 CR-1, IM-2；没有写 无>
next: 将 findings 贴回 review-fix 汇总，或交给 review-repair 直接修复
tokenHint: 下一位 AI 先读本 Brief -> finding 指向文件 -> review-task 中证据包；只在冲突时扩展读取全文

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

可将以上 findings 原样贴回 /review-fix，用于生成修复交接文档。
如果希望直接修复，可将 findings 交给 /review-repair；它会修改代码并运行验证。

【Skill 反馈给 Codex】
- skill：review-check
- 本次场景：<一句话描述审查材料，如 review-task/dev-doc/patch/diff>
- 运行评价：<顺畅 / 有小问题 / 有阻塞>
- 建议：
  1. <无，或一条可落地的 skill 改进建议>
- 证据：
  - <本次多问/漏问/误判/模板不足的具体表现；没有则写 无>
```

没有 findings 时：

```text
来源：Code Review
审查对象：<...>
审查范围：<...>
结论状态：NoEvidenceIssue

【Workflow Brief】
stage: ReviewGate
task: <任务名或审查对象>
source: <review-task/dev-doc/patch/diff 路径>
artifacts: 本次只读审查输出；无文件写入
changed: <审查到的源码/测试/配置/OpenAPI 文件>
vcs: <git/svn status 摘要；未检查写原因>
tests: <验证命令 + 结果；未提供写 未提供>
api: <OpenAPI YAML/INDEX 路径；无接口变更写 无>
openFindings: 无
next: 可进入 code-reading / 人工 review；若后续改动扩大则重新 review-check
tokenHint: 下一位 AI 先读本 Brief -> review-task -> changed 文件；无须重复粘贴 findings

未发现有证据的阻塞问题。

已检查：
- 需求一致性：<说明>
- 业务正确性：<说明>
- 边界/事务/并发/安全/前端/SSE/AI 文件沙箱/性能/兼容/测试/提交完整性：<说明>

Notes:
- <仍建议人工关注的不确定点>

【Skill 反馈给 Codex】
- skill：review-check
- 本次场景：<一句话描述审查材料，如 review-task/dev-doc/patch/diff>
- 运行评价：<顺畅 / 有小问题 / 有阻塞>
- 建议：
  1. <无，或一条可落地的 skill 改进建议>
- 证据：
  - <本次多问/漏问/误判/模板不足的具体表现；没有则写 无>
```

材料不足时：

```text
来源：Code Review
审查对象：<...>
审查范围：<已读取的材料>
结论状态：InsufficientMaterial

【Workflow Brief】
stage: ReviewGate
task: <任务名或审查对象>
source: <已提供材料路径>
artifacts: 本次只读审查输出；无文件写入
changed: <已读取文件；未知写 未确认>
vcs: <git/svn status 摘要；未检查写原因>
tests: <验证命令 + 结果；未提供写 未提供>
api: <OpenAPI YAML/INDEX 路径；无接口变更写 无 / 未确认>
openFindings: blocking material gap
next: 补齐缺失材料后重新 review-check；不要进入 review-repair
tokenHint: 下一位 AI 先读本 Brief -> 缺失材料清单 -> 补齐后的 review-task，再重新审查

材料不足，无法对以下范围下结论：
- <范围 1，如状态流转正确性>
- <范围 2，如权限边界>

缺失材料：
- <缺失的 dev-doc / diff / 关键源码 / 字典 / 权限说明 / 测试结果>

已能确认：
- <基于现有材料可以确认的事实>

OpenQuestions:
- blocking: <必须补充的问题>

可将以上材料不足结论贴回 /review-fix，用于补齐证据包。

【Skill 反馈给 Codex】
- skill：review-check
- 本次场景：<一句话描述审查材料缺口>
- 运行评价：有阻塞
- 建议：
  1. <无，或一条可落地的 skill 改进建议>
- 证据：
  - <本次材料不足、漏读文件、模板不足或无法判断的具体表现；没有则写 无>
```

