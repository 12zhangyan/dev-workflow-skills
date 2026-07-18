# review-loop Reference

## 模式选择

| 条件 | standard | quick |
|------|----------|-------|
| 中等/复杂、跨文件、需要证据包 | 默认 | 不适用 |
| 小范围、单模块、用户明确要求快速 | 可用 | 可用 |
| 接口契约、权限、状态、事务、DB、Critical | 必须 | 自动升级 |
| 产出 review-task | 是 | 否 |
| review-check / repair / verify / recheck | 全部执行 | 全部执行 |

## 停机矩阵

| 状态 | 是否修复 | 是否复审 | 最终结论 |
|------|----------|----------|----------|
| 只有方案，无实现证据 | 否；执行一次只读方案审查 | 否 | 无 findings：NoEvidenceIssue；有 findings：Blocked；材料不足：InsufficientMaterial |
| NoEvidenceIssue | 否 | 否 | NoEvidenceIssue |
| 有 accepted findings | 是 | 是 | Fixed / PartiallyFixed |
| 业务/API/权限/DB blocker | 暂停对应项 | 仅复审已修部分 | Blocked / PartiallyFixed |
| 验证失败或环境阻塞 | 不关闭相关 CR/IM | 可做只读复审 | 已修复：PartiallyFixed；未能修复：Blocked（验证状态另记 Failed / EnvironmentBlocked） |
| 两轮后仍有 CR/IM | 停止 | 已完成最终复审 | PartiallyFixed |
| 范围内关键文件未纳入 VCS | 只生成证据包和第一次只读 findings，不修复 | 否 | Blocked / VCSGateBlocked；输出最小纳管清单，纳管后带 finding ID 重跑 |
| 无 findings 但验证非 Passed | 否 | 否 | Blocked；补验证或修环境后重验 |

## 完成输出格式

```text
来源：review-loop 单 AI 编排
ReviewMode: <standard / quick>
ReviewAgentMode: SingleAgentReview
ReviewScopeType: <PlanReview / ImplementationReview>
VcsAddPolicy: <host-required / user-authorize-only>
VcsAddPolicySource: <适用仓库规则路径与条款 / review-loop-default>
PolicyConflict: <none / review-loop-default-no-add -> host-required；采用原因>
ReviewTaskTemplateSource: <review-fix / quick-in-memory>
LegacyReviewTaskInput: <无 / 用户显式提供的 docs/review-form/...>
CompatibilityFlags: <none / legacy-review-form-input>
修复结论：<NoEvidenceIssue / Fixed / PartiallyFixed / Blocked / InsufficientMaterial>
VerificationStatus: <已运行命令和结果 / 未运行及原因>
TestDependencyClass: <Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown / NotApplicable>
TestEvidenceStatus: <Passed / Failed / NotRun / EnvironmentBlocked / NotProvided>
TestSourcePathCheck: <NotApplicable / Checked / WindowsTestSourcePathMismatch；Windows Java testCompile 时写测试源根、真实文件路径与 javac/Maven 报错路径>
RepairCycles: <0 / 1 / 2>

阶段结果：
| 阶段 | 状态 | 产物/证据 |
|------|------|-----------|
| review-fix 证据包 | <generated / skipped-quick / blocked> | <review-task 路径或原因> |
| 第一次 review-check | <NoEvidenceIssue / Findings / InsufficientMaterial> | <finding ID> |
| review-repair | <fixed / partial / skipped / blocked> | <处理 ID> |
| Verification Gate | <Passed / Failed / EnvironmentBlocked / NotRun> | <命令摘要> |
| 二次 review-check | <NoEvidenceIssue / Findings / skipped> | <未关闭/新增 ID> |

finding 处理：
| ID | 级别 | 状态 | 文件/位置 | 处理说明 | 验证 |
|----|------|------|-----------|----------|------|
| <ID> | <Critical/Important/Minor> | <fixed/blocked/rejected/deferred-next-batch> | <path:line> | <说明> | <命令/结果> |

【Workflow Brief】
stage: <ReviewGate / ReviewRepair，按实际停止阶段填写>
task: <任务名>
source: <dev-doc / review-task / 当前 diff>
artifacts: <review-task；本次审查输出；无文件写入则写 无>
changed: <实际修改的源码/测试/配置；没有写 无>
vcs: owner=<按 VCS_OWNER 分组的 Git/SVN 根>; tracked=<已纳管范围>; untracked=<未纳管文件或 无；嵌套工作副本说明>
tests: class=<Hermetic/ServiceBacked/LiveExternal/Mixed/Unknown/NotApplicable>; command/result=<验证命令 + 结果；environment-blocked 写工具链版本>
api: spec=<OpenAPI YAML 路径或 无>; index=<API 索引路径或 无>; operationIds=<新增/变更接口 ID 或 无>
openFindings: <未关闭 ID；没有写 无>
next: <人工 review / 补 blocker / 修环境后重验 / 下一批 review-loop>
nextCommand: <无未关闭 CR/IM：使用 code-reading skill 基于 source 和当前实现生成代码地图；有 blocker：补齐 blocker 后重新运行 review-loop skill>
tokenHint: 下一位 AI 先读本 Brief -> 未关闭 finding -> 最新 diff -> 验证输出；不要重读已关闭 finding 全文；首轮最多 5 个文件

VCS 完整性：
- <status/diff 摘要>
- 纳管策略：<VcsAddPolicy + 来源；存在冲突时写采用口径及其优先级依据>
- add 前精确清单：<逐文件路径 / 无>；授权依据：<host-required 规则 / 用户本轮明确授权 / 未授权>
- 新增文件纳管：<无 / 需 git add / 需 svn add>
- 测试源路径核对：<NotApplicable / 已 walk-rglob 核对 / WindowsTestSourcePathMismatch + 证据>
- 自动提交：未执行

边界说明：
- 本次为 SingleAgentReview，不代表多 AI 独立交叉审查。
- <其余 blocker / 环境风险 / 未验证项>

【Skill 维护反馈】
- skill：review-loop
- 本次场景：<standard/quick + 输入形态>
- 运行评价：<顺畅 / 有小问题 / 有阻塞>
- 建议：
  1. <无，或一条可落地改进>
- 证据：
  - <具体表现；无则写 无>
```

## 结论口径

- `Fixed`：所有 accepted Critical/Important 已关闭，验证证明目标逻辑，二次复审没有新的阻塞问题。
- `PartiallyFixed`：至少一项已修，但仍有 blocker、deferred-next-batch、验证不足或未关闭 finding。
- `Blocked`：业务/权限/API/DB 或材料问题使修复无法开始。
- `NoEvidenceIssue`：材料足够，第一次审查未发现有证据问题；没有修代码。
- `InsufficientMaterial`：缺少实际 diff/源码/测试或关键契约，无法下实现结论。
