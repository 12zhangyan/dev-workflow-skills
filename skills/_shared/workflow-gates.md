# 开发工作流门禁协议

本协议供 `dev-doc`、`bug-fix`、`biz-flow`、`review-fix`、`review-check`、`review-repair`、`code-reading` 引用。目标是让每个 skill 都能说清楚当前处于哪一阶段、产出了什么、下一步需要什么证据，以及遇到问题时应该停在哪里。

## 主链路

```text
需求/缺陷/业务流输入
→ Plan Gate：dev-doc / bug-fix / biz-flow 产出可执行文档
→ Implementation Gate：AI 或开发者按文档实现，并回填执行结果
→ VCS Gate：确认新增源码、测试、配置、OpenAPI、文档已进入 Git/SVN 可见范围
→ Verification Gate：运行有针对性的构建/测试/接口/数据核对
→ Review Gate：review-fix 生成任务包，review-check 输出 findings，review-fix 汇总修复或 review-repair 直接修复
→ Understanding Gate：code-reading 生成代码地图，辅助人工 review
→ Submit Gate：人工签收，最终 status/diff/test/review/document 检查后提交
```

## 阶段门禁

| 阶段 | 进入条件 | 必须产出 | 不满足时 |
|------|----------|----------|----------|
| Plan Gate | 用户目标、入口或缺陷线索足够定位范围 | md 文档、看板条目、阻塞项/冲突/假设、下一步执行提示 | 有阻塞型冲突时只产出待确认文档，不给编码操作码 |
| Implementation Gate | Plan Gate 无阻塞项 | 执行结果对照表：Todo 完成情况、变更文件、未完成项、验证命令 | Todo 无法执行时回到文档补充，不静默扩大范围 |
| VCS Gate | 已有本地改动 | `git status --short` 或 `svn status` 摘要；新增源码/测试/配置/OpenAPI/docs 已纳入 VCS | 先补 `git add` / `svn add`，否则不进入 Review |
| Verification Gate | VCS Gate 已确认范围 | 测试/构建/接口/数据核对命令与结果；失败项与修复状态 | 验证失败先修复并重跑，不进入 Review |
| Review Gate | 有 dev-doc/bug 文档和实际 diff/patch/status | review task、review-check findings、review-fix 修复交接或 review-repair 修复结果、accepted findings 处理状态 | 没有实际实现证据时不生成“已审代码”结论 |
| Understanding Gate | Review 修复和验证已完成 | code-reading 代码地图、关键调用链/状态/事务/风险位置 | 材料不足时只输出阅读边界，不补写问题结论 |
| Submit Gate | 人工 review 通过 | 最终 status/diff/test/review/doc 检查清单与提交信息 | 任何 Critical/Important 未关闭、敏感信息或漏 add，停止提交 |

## 统一完成输出

每个 skill 完成时都应尽量包含：

- 当前阶段：例如 `Plan Gate 已完成`、`Review Gate 待 findings 回收`。
- 产物路径：md、OpenAPI YAML、看板、单页、索引或 review task。
- 证据摘要：VCS 类型、变更范围、验证命令、材料不足边界。
- 下一步输入：下一位 agent 或用户需要复制的路径/命令/反馈。
- `【Workflow Brief】`：按 [workflow-brief.md](workflow-brief.md) 输出最小交接块，供下一位 AI 先读索引再读证据。
- 停止原因：存在 blocker、冲突、验证失败、材料不足或 DB/DDL 审批时明确写出。

## 下一步串联

各 skill 完成后"下一步跑什么 + 可复制命令"以 [workflow-chain.md](workflow-chain.md) 为单一权威来源；完成输出和 `Workflow Brief` 的 `next` 字段都据此填写，不要各处另写一套映射。

## 轻量交接与读取顺序

- 跨 skill 交接默认复制 `Workflow Brief + 产物路径 + findings ID`，不要重复粘贴完整长文档、完整 diff 或大段源码。
- 下一位 AI 的读取顺序应写进 `tokenHint`：先读 Brief，再读源文档或任务包，再读 changed 文件和验证输出。
- Brief 只能作为索引；如果发现业务语义、权限、状态、接口契约、DB 结构、数据修复、测试失败或证据冲突，必须回到原始文件核对，不能按 Brief 猜测。
- Review 任务包、修复交接、review-repair 回填都要保留 finding ID，保证从问题发现到修复关闭能一一追踪。

## 固定风险规则

- 数据库默认只读；新增库、表、字段、索引、约束或 DDL 只能输出 DBA 申请材料，不能要求 AI 直接执行。
- Review 前必须有实际代码证据：diff、patch、VCS status 或明确的变更文件。只有需求文档时只能审方案，不能宣称审过实现。
- 新增测试文件、OpenAPI YAML、配置、SQL/XML、前端资源、本地生成文档都属于提交完整性检查范围。
- 修复交接或 review-repair 直修后需要回填每条 accepted finding 的处理结果、验证结果和未采纳原因；Critical / Important 未关闭不得进入 Submit Gate。
- Codex 使用自然语言触发 skill；Claude Code 可以使用斜杠命令。文档中同时给两种写法时，要明确区分。
