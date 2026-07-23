# 开发工作流门禁协议

本协议供 `dev-doc`、`bug-fix`、`biz-flow`、`review-fix`、`review-check`、`review-repair`、`review-loop`、`code-reading` 引用。目标是让每个 skill 都能说清楚当前处于哪一阶段、产出了什么、下一步需要什么证据，以及遇到问题时应该停在哪里。

## 主链路

```text
需求/缺陷/业务流输入
→ Plan Gate：dev-doc / bug-fix / biz-flow 产出可执行文档
→ Implementation Gate：AI 或开发者按文档实现，并回填执行结果
→ VCS Gate：确认新增源码、测试、配置、OpenAPI、文档已进入 Git/SVN 可见范围
→ Verification Gate：运行有针对性的构建/测试/接口/数据核对
→ Review Gate：完整拆分链为 review-fix → review-check → review-fix/review-repair；单 AI 可用 review-loop 编排审查、修复、验证和二次复审
→ Understanding Gate：code-reading 生成代码地图，辅助人工 review
→ Submit Gate：人工签收，最终 status/diff/test/review/document 检查后提交
```

## 阶段门禁

| 阶段 | 进入条件 | 必须产出 | 不满足时 |
|------|----------|----------|----------|
| Plan Gate | 用户目标、入口或缺陷线索足够定位范围 | md 文档、看板条目、阻塞项/冲突/假设、下一步执行提示 | 有阻塞型冲突时只产出待确认文档，不给编码操作码 |
| Implementation Gate | Plan Gate 无阻塞项 | 执行结果对照表：Todo 完成情况、变更文件、未完成项、验证命令 | Todo 无法执行时回到文档补充，不静默扩大范围 |
| VCS Gate | 已有本地改动 | `git status --short` 或 `svn status` 摘要；新增源码/测试/配置/OpenAPI/docs 已纳入 VCS；声明 `VcsAddPolicy`、来源和冲突采用口径 | 未纳管时必须读取并纳入审查范围，可继续修复、验证和复审，但不得宣称 Review 通过或进入 Submit Gate；最终保留 `VCSGateBlocked` 与精确纳管清单 |
| Verification Gate | VCS Gate 已确认范围 | 测试/构建/接口/数据核对命令与结果；失败项与修复状态 | 验证失败先修复并重跑，不进入 Review |
| Review Gate | 有 dev-doc/bug 文档和实际 diff/patch/status | review task、review-check findings、review-fix/review-repair 结果，或 review-loop 的 SingleAgentReview 闭环结果；accepted findings 处理状态 | 没有实际实现证据时不生成“已审代码”结论 |
| Understanding Gate | Review 修复和验证已完成 | code-reading 代码地图、关键调用链/状态/事务/风险位置 | 材料不足时只输出阅读边界，不补写问题结论 |
| Submit Gate | 人工 review 通过 | 最终 status/diff/test/review/doc 检查清单与提交信息 | 任何 Critical/Important 未关闭、敏感信息或漏 add，停止提交 |

## 准确性不变量

这些规则优先于模板完整性；模板再完整，也不能牺牲证据准确性。

- 区分 `计划`、`实际改动`、`验证结果`：dev-doc/biz-flow/bug-fix 只代表计划或分析；只有 diff/status/文件内容能证明实现已发生。
- `changed` 文件列表必须来自 VCS status、diff、patch、用户给出的明确路径或实际读取到的文件；不能凭任务名猜文件。
- 验证结论必须写命令和结果；未运行时写 `未运行 + 原因`，不能写成通过。
- 构建/测试因 JDK、Node、Maven、npm、依赖下载或明确要求执行的外部测试所需网络不可用而无法启动时，标为 `environment-blocked`，写清工具链版本和失败命令；不要把环境问题当成业务代码缺陷。默认测试/CI 命令自身强依赖未提供的真实凭据或外部服务时，按下方“测试依赖分级”判为测试架构/CI 契约缺陷，不能归咎于当前环境。
- Review 任务包必须声明审查对象是 `方案` 还是 `实现代码`；没有实现证据时不得输出“已审代码”。
- Finding 必须带可复核证据：文件/行号、方法名、接口、日志、配置或文档章节；只有直觉时降级为材料不足或待确认。
- 修复结果必须逐条回填 accepted finding 的状态：`fixed / blocked / rejected / deferred-next-batch`，并保留原 finding ID。
- 测试结论必须证明目标逻辑：测试名、输入数据、被调用方法和断言对象要一致；只验证前置条件、临时目录或 mock 自身时，不能作为风险已解除的证据。
- 新增文件、生成文件、OpenAPI、配置、SQL/XML、测试文件都要进入 VCS Gate 检查；未纳管时必须读取内容并可继续修复、验证和复审，但不得形成 Review Gate 通过、`Fixed` 或 Submit Gate 通行结论。
- 发现任务越界、跨模块扩散或一次处理过多 findings 时，先拆批并标 `deferred-next-batch`，不要用一次大改掩盖边界。

## 测试依赖分级与失败归因

验证命令必须记录 `TestDependencyClass`，它与 `TestEvidenceStatus` 相互独立：前者说明测试依赖什么，后者说明本次实际验证结果。

| 分类 | 判定 | 默认本地/CI 约束 |
|------|------|-----------------|
| `Hermetic` | 不访问网络、真实凭据或外部可变服务的单元测试/静态检查 | 默认 `test/verify` 必须可运行 |
| `ServiceBacked` | 依赖数据库、Redis、MQ 等基础服务 | 使用 Testcontainers、嵌入式组件、测试替身或 CI 明确声明的受控服务 |
| `LiveExternal` | 调用真实 AI、SaaS、云服务或第三方 API | 默认关闭；仅由独立 profile、tag 或显式 job 在受控凭据下开启 |
| `Mixed` | 同一命令混合以上多类测试 | 必须拆出各子集结果；默认命令混入 `LiveExternal` 视为 CI 契约风险 |

失败归因遵循以下规则：

1. 先读取测试注解/tag/profile、配置绑定和 CI workflow，再判定分类；不能只凭错误文本中的“缺少环境变量”下结论。
2. 默认 `test/verify` 因真实 API key、云账号或外部服务不可用而必然失败，且 CI 未显式提供对应 secret/service 时，记录 `TestEvidenceStatus=Failed` 并输出 `Important` 测试架构/CI 契约 finding；不得标为 `EnvironmentBlocked`。
3. 不得注入伪造 API key 来绕过启动检查，因为它可能触发真实外部调用并产生费用、数据泄露或不稳定结果。
4. `LiveExternal` 按设计跳过时，不影响已运行 `Hermetic` 子集的 `Passed`，但该结果不能证明真实集成行为；必须分别写出已验证和未验证范围。
5. 默认 CI 至少运行全部 `Hermetic` 和受控的 `ServiceBacked` 测试；`LiveExternal` 使用独立的手动、定时或 secret-protected job。
6. Windows PowerShell 调用 Maven Wrapper 时，把每个 `-Dkey=value` 作为完整参数引用，例如 `.\mvnw.cmd '-Dexpression=test.groups' help:evaluate`；参数解析失败先修正命令，不得误判为项目失败。
7. Surefire/JUnit/覆盖率报告可能残留自旧运行。引用报告前必须与本轮命令输出、文件更新时间或 `clean` 后结果核对；陈旧报告不能作为当前 finding 或失败证据。

## VCS 证据归属

Review、修复和提交完整性检查必须按变更文件所属工作副本取证，不能只使用当前目录向上的第一个或最外层 VCS 根：

1. 从用户路径、Workflow Brief、dev-doc、review-task、patch 和当前 status/diff 得到候选变更文件。
2. 对每个候选文件，从文件所在目录逐级向上查找 `.svn` 或 `.git`（`.git` 可以是目录或 worktree 文件）；最先遇到的控制标记就是该文件的 `VCS_OWNER`。
3. 按 `VCS_OWNER` 分组读取 status 和实际 diff。外层 Git 显示 `?? <内层 SVN 目录>/` 时，只记录嵌套工作副本提示，不能替代内层 SVN 证据。
4. 命令失败时保留退出码和短错误摘要，写 `VCSStatusUnknown`；不得用空输出冒充 clean，也不得继续通过 VCS Gate。
5. 任一范围内 owner 存在未纳管源码、测试、配置、OpenAPI 或正式文档时，写 `VCSGateBlocked`。必须读取未跟踪内容并纳入完整范围；允许继续修复、验证和复审，但不得给出 Review Gate 已通过、`Fixed` 或可提交结论。
6. 执行前声明 `VcsAddPolicy`：适用的宿主仓库规则明确要求新建业务文件必须纳管时为 `host-required`，否则为 `user-authorize-only`。同时记录 `VcsAddPolicySource`；宿主规则与 skill 默认冲突时，在首次 VCS 操作前输出 `PolicyConflict` 和采用口径，不能事后补解释。
7. 两种策略都必须先输出逐文件最小清单。`host-required` 可依据明确宿主规则纳管本次范围内的新业务文件，不再追加业务确认，但仍遵循工具审批；`user-authorize-only` 只有用户看到清单并明确授权后才能纳管。禁止 `git add .`、目录级兜底或顺带纳管其他文件。执行后重新读取 status/diff，记录实际 staged/added 清单再继续；两种策略都不授权 commit/push。

Git 至少读取 `status --short`、`diff --name-status` 和范围内实际 `diff`；SVN 至少读取 `status`、`diff --summarize` 和范围内实际 `diff`。无法确定 owner 时写 `VCSOwnerUnknown`，不得猜用外层仓库。

## 统一完成输出

每个 skill 完成时都应尽量包含：

- 当前阶段：例如 `Plan Gate 已完成`、`Review Gate 待 findings 回收`。
- 产物路径：md、OpenAPI YAML、看板、单页、索引或 review task。
- 证据摘要：VCS 类型、变更范围、验证命令、材料不足边界。
- 下一步输入：下一位 agent 或用户需要复制的路径，以及可直接执行的 `nextCommand`。
- `【Workflow Brief】`：按 [workflow-brief.md](workflow-brief.md) 输出最小交接块，供下一位 AI 先读索引再读证据。
- 停止原因：存在 blocker、冲突、验证失败、材料不足或 DB/DDL 审批时明确写出。

## 下一步串联

各 skill 完成后"下一步跑什么 + 可复制命令"以 [workflow-chain.md](workflow-chain.md) 为单一权威来源；完成输出和 `Workflow Brief` 的 `next` 字段都据此填写，不要各处另写一套映射。

## 轻量交接与读取顺序

- 跨 skill 交接默认复制 `Workflow Brief + 产物路径 + findings ID`，不要重复粘贴完整长文档、完整 diff 或大段源码。
- 下一位 AI 的读取顺序应写进 `tokenHint`：先读 Brief，再读源文档或任务包，再读 changed 文件和验证输出；首轮最多读取 5 个文件，证据冲突时再扩展。
- Brief 只能作为索引；如果发现业务语义、权限、状态、接口契约、DB 结构、数据修复、测试失败或证据冲突，必须回到原始文件核对，不能按 Brief 猜测。
- Review 任务包、修复交接、review-repair 回填都要保留 finding ID，保证从问题发现到修复关闭能一一追踪。
- Brief 的 `vcs` 必须拆出 VCS owner、已纳管范围和未纳管文件；`api` 必须拆出 YAML、索引和 operationId，不能只写“已生成”。

## 固定风险规则

- 数据库默认只读；新增库、表、字段、索引、约束或 DDL 只能输出 DBA 申请材料，不能要求 AI 直接执行。
- Review 前必须有实际代码证据：diff、patch、VCS status 或明确的变更文件。只有需求文档时只能审方案，不能宣称审过实现。
- 新增测试文件、OpenAPI YAML、配置、SQL/XML、前端资源、本地生成文档都属于提交完整性检查范围。
- 修复交接或 review-repair 直修后需要回填每条 accepted finding 的处理结果、验证结果和未采纳原因；Critical / Important 未关闭不得进入 Submit Gate。
- review-loop 只代表单 AI 编排，必须标记 `SingleAgentReview`；最多自动修复两轮，不得冒充多 AI 独立审查或无限循环。
- Codex 使用自然语言触发 skill；Claude Code 可以使用斜杠命令。文档中同时给两种写法时，要明确区分。
