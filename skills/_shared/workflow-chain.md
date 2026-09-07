# Review 证据语义

本文件只统一跨 reviewer、repair 和交接需要共享的标识与证据含义，不规定执行顺序、角色数、修复轮次或输出模板。

需求澄清、测试策略和 reviewer 选择由 Agent 自主判断，不要求探测或调用外部方法论 Skill。

## Finding ID

同一问题从发现到关闭复用稳定 ID。推荐前缀为 `CR-n / IM-n / MI-n`；误报或无证据项可记 `RJ-n`，需外部裁决的 blocker 可记 `BK-n`。多 reviewer 聚合时分配 canonical ID 并保留来源别名，不能用多数意见替代证据。

repair 对每个输入 ID 给出事实性结果和依据；状态词按场景选择，不能为套枚举改变事实。没有原始 finding 不凭空修复，同一 ID 不能在复审时悄悄更换根因。

## Review 与验证

普通答复明确审查对象即可；机器交接需要时可用 `ReviewScopeType` 区分 `PlanReview / ImplementationReview / FixHandoffReview`。方案审查不能冒充实现审查。

验证只有真实执行并断言目标逻辑时才算通过。修改代码后必须基于最新实现重新判断，不能沿用输入状态。需要失败归因或交接时可使用 `TestEvidenceStatus`；`EnvironmentBlocked` 只说明工具链和未证明范围，不能据此关闭 Critical/Important。

`SingleAgentReview` 只能表示单 Agent 自审，不能冒充独立交叉审查。未跟踪文件仍进入审查与验证范围；是否修复成功与是否达到 VCS/Submit 就绪分别判断。
