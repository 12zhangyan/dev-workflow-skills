# Yan Code Review Package Task Template

## Review 任务包模板

````markdown
# <任务名> Review 任务包

> 日期：<YYYY-MM-DD>
> 来源：<yan-dev-doc / patch / code-reading / 上下文>
> 分支/路径：<branch 或 SVN path>
> 阶段：等待其他 AI Review
> ReviewScopeType：<PlanReview / ImplementationReview / FixHandoffReview>
> TestDependencyClass：<Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown / NotApplicable；说明默认命令边界>
> TestEvidenceStatus：<Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable；说明测试是否验证目标逻辑>

---

## 一、审查目标

请其他 AI 基于本任务包做 code review，目标是发现会导致线上缺陷、业务偏差、数据错误、回归、安全风险或维护风险的问题。

本次审查范围类型为 `ReviewScopeType`。若为 `PlanReview`，只能审方案与证据边界，不得输出“实现代码无问题”；若为 `ImplementationReview`，必须回到 diff/status/changed 文件核对实际改动；若为 `FixHandoffReview`，重点核对 accepted findings 是否能被定位、修复和验证。

本次重点确认：
- [ ] 实现是否符合需求/方案文档
- [ ] 关键业务分支、状态流转、异常处理是否正确
- [ ] 本次改动是否引入兼容性、事务、并发、性能、安全问题
- [ ] 测试是否能证明改动正确

---

## 二、证据包

| 类型 | 路径/内容 | 给其他 AI 的使用方式 |
|------|-----------|----------------------|
| 需求/方案文档 | <path 或无> | 对照目标、范围、技术方案 |
| 代码地图 | <path 或无> | 理解调用链、状态机、关键位置 |
| diff/patch | <path 或粘贴位置> | 审查实际改动 |
| VCS 状态 | <git status --short / svn status 摘要> | 检查新增源码、测试、配置是否已纳入版本控制 |
| 关键源码 | <文件路径列表> | 定位风险和证据 |
| 测试命令 | <mvn test / ./gradlew test / npm test / 待补充> | 判断验证方式，并标记 TestDependencyClass 与外部依赖 |

### 判断依据、冲突与待确认

| 类型 | 内容 | 依据 | 是否阻塞 | 处理口径 |
|------|------|------|----------|----------|
| assumption | <低风险假设> | <文档/代码/用户描述> | 否 | 审查时关注即可 |
| conflict | <需求与实现/状态/权限/数据归属冲突> | <证据> | 是/否 | 阻塞则先确认 |
| blocker | <缺失材料或必须确认的问题> | <证据缺口> | 是 | 不生成修复操作码 |
| openQuestion | <非阻塞待确认> | <上下文> | 否 | 作为 Notes |

---

## 三、统一 Review 清单

| 类别 | 检查点 |
|------|--------|
| 正确性 | 主流程是否符合 yan-dev-doc；返回值、状态流转、异常分支是否正确 |
| 需求冲突 | 用户口径、yan-dev-doc、现有状态机、字典、权限、数据归属、表复用是否互相矛盾 |
| 边界 | null、空集合、空字符串、非法枚举、超长、临界值 |
| 事务 | `@Transactional` 边界、跨服务调用、异常回滚、分页状态清理 |
| 并发 | 重复提交、幂等、锁粒度、批量更新、竞态条件 |
| 安全 | 权限校验、越权、敏感信息日志、SQL/表达式注入、明文凭证 |
| 前端鉴权 | 路由守卫、token 刷新队列、登录跳转、管理员权限判断 |
| SSE/流式 | EventSource token、error/done 事件、连接中断、重复消费、loading 收尾 |
| 富文本/预览 | `v-html` 消毒、iframe 地址、生成内容预览边界、静态资源访问 |
| AI 文件沙箱 | 文件读写路径限制、覆盖写前读取、生成/修改模式、部署回滚 |
| 性能 | 循环内远程/DB 调用、N+1 查询、全表扫描、缺索引风险 |
| 兼容 | 接口签名、返回结构、枚举值、配置默认值是否破坏调用方 |
| 配置部署 | CORS、JWT、Redis、LLM profile、Docker、CI 与运行文档是否一致 |
| 提交完整性 | 新增/修改的源码、测试、配置、SQL/XML、前端资源是否已纳入 Git/SVN；重点检查本地存在但未跟踪的测试文件 |
| 可维护性 | 命名、重复逻辑、异常被吞、魔法值、职责边界 |
| 测试 | 是否覆盖正常、异常、边界、回归；测试是否能证明修复有效 |

---

## 四、分发给 Codex 的审查提示

```text
如果当前环境已安装 dev-workflow-skills，请优先直接运行：
使用 yan-code-review skill，mode=check，审查 <当前 Review 任务包路径>

如果不能运行 skill，请按下面要求手工审查。

请作为代码审查者，基于以下材料做 review：
请独立完成本次审查；返回结果前不要读取或参考其他 reviewer 的 findings。
0. ReviewScopeType：<PlanReview / ImplementationReview / FixHandoffReview>；TestDependencyClass：<Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown / NotApplicable>；TestEvidenceStatus：<Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable>
1. 需求/方案文档：<yan-dev-doc路径或无>
2. 代码地图：<code-reading路径或无>
3. diff/patch：<patch路径或粘贴内容>
4. 重点源码：<文件路径列表>

审查重点：
- 实现是否符合需求和方案
- 需求/实现/状态机/权限/数据归属是否存在冲突；材料不足时输出"材料不足，无法下结论"，不要说无问题
- 是否存在正确性、边界、事务、并发、安全、性能、兼容性、测试覆盖问题
- 是否存在新增测试/源码/配置文件本地存在但未纳入 Git/SVN 的提交完整性问题
- 是否有会影响线上稳定性或数据正确性的风险

输出结构化 findings，只关注有证据的问题：
- Severity: Critical / Important / Minor
- File/Line: 文件路径和行号；没有行号则写方法名
- Problem: 问题是什么
- Evidence: 从 diff/源码/文档看到的证据
- Impact: 可能造成什么后果
- Fix: 建议怎么修
- Verify: 如何验证

不要输出泛泛建议，不要要求重构无关代码，不要回滚用户已有改动。材料不足时列出缺失材料和无法判断的结论边界。
```

---

## 五、分发给 Cursor 的审查提示

```text
如果 Cursor 已加载 dev-workflow-skills，请优先直接运行：
使用 yan-code-review skill，mode=check，审查 <当前 Review 任务包路径>

如果不能运行 skill，请按下面要求手工审查。

请在当前工程中按文件上下文审查本次改动。重点看：
- 独立完成本次审查；返回结果前不要读取或参考其他 reviewer 的 findings
- ReviewScopeType 是 PlanReview / ImplementationReview / FixHandoffReview 中哪一种；不要把方案审查写成实现审查
- TestEvidenceStatus 是否说明测试真的验证目标逻辑
- diff 是否符合 <yan-dev-doc路径或功能描述>
- 是否有空指针、边界、事务、并发、权限、性能和接口兼容风险
- 是否缺少测试或验证路径；新增测试文件是否已纳入版本控制

请按以下 JSON-like 列表输出：
[
  {
    "severity": "Critical|Important|Minor",
    "file": "...",
    "lineOrMethod": "...",
    "problem": "...",
    "evidence": "...",
    "impact": "...",
    "fix": "...",
    "verify": "..."
  }
]

只列可操作问题；没有证据的猜测请放到 notes，不要当 finding。
如果关键材料不足，请单独输出 `MaterialStatus: insufficient` 和缺失材料，不要输出"未发现问题"。
```

---

## 六、分发给 Claude 的审查提示

```text
如果 Claude 已加载 dev-workflow-skills，请优先直接运行：
使用 yan-code-review skill，mode=check，审查 <当前 Review 任务包路径>

如果不能运行 skill，请按下面要求手工审查。

请读取给定 patch / 文档 / 关键源码，做一次偏业务正确性的 code review。
请独立完成本次审查；返回结果前不要读取或参考其他 reviewer 的 findings。
先声明 ReviewScopeType 和 TestEvidenceStatus；没有实现证据时只审方案，不得说实现代码无问题。
请优先找：
1. 方案和实现不一致
2. 状态、金额、库存、权限、事务、异常处理错误
3. 循环内远程/DB 调用和批量处理问题
4. 测试没有覆盖但风险较高的分支
5. 新增测试/源码/配置文件未纳入 Git/SVN，导致本地通过但提交缺文件

输出按 Critical / Important / Minor 分组。每条必须包含证据、影响、修复建议、验证方式。
如果认为某条只是风格偏好，请明确标为 Minor 或 notes。
材料不足时先说明无法下结论的范围和缺失证据。
```

---

## 七、Review 结果回收格式

请把其他 AI 的结果贴回时尽量保持以下格式：

```text
来源：Codex / Cursor / Claude

Findings:
1. Severity:
   File/Line:
   Problem:
   Evidence:
   Impact:
   Fix:
   Verify:

Notes:
- <非阻塞建议或不确定观察>

OpenQuestions:
- <材料不足或需要业务确认的问题；如阻塞请写明 blocking>
```

````

---
