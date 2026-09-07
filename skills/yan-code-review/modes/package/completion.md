# Yan Code Review Package Completion

## 完成输出

只报告实际状态。实时委派可以只使用当前上下文的共同证据索引；没有落盘任务包不是缺失步骤。

```text
ReviewCoordinationResult: <Packaged|PartiallyReviewed|Findings|NoEvidenceIssue|Blocked>
审查证据: <InMemory / docs/review-fix/...-review-task.md / 未建立 + 原因>
修复交接: <docs/review-fix/...-fix-handoff.md / NotApplicable>
Reviewers: <角色=完成/失败；外部分发时写 awaiting external results>
Findings: <CR n / IM n / MI n / RJ n / BK n；尚未审查写 pending>
Verification: <命令与结果；仅在外部依赖或失败归因有信息增益时附 TestDependencyClass>
BoardPublishStatus: <Published: deliveryId + eventId / NotRequested / Blocked + 原因>

```

确需跨 Agent、跨任务或稍后恢复时，任务包或 fix-handoff 在末尾写入唯一一段符合共享协议的 `【Workflow Brief】`；不在本文件复制第二份模板。聊天默认只返回其路径；仅零写入或接收方无法访问产物时，才按共享格式在聊天展开一份。

下一动作按结果选择：

- `Packaged`：委派不可用，交付一份持久任务包和一个便携 prompt，等待外部 findings；不要重复三份宿主提示。
- `PartiallyReviewed`：先补关键未覆盖视角，或由用户接受覆盖边界；不要假装完整共识。
- `Findings`：有 accepted finding 时指向 `yan-code-review mode=repair`；有 `BK` 时先解除 blocker。
- `NoEvidenceIssue`：给出已覆盖/未覆盖范围，再进入人工验收或按风险补一次独立审查，不生成空 fix-handoff。
- `Blocked`：只请求最小缺失证据或路径决策。

不要附完整证据包、长 diff、所有 reviewer 原文或固定后续流水线；已落盘的内容只给路径，未落盘时只保留能复核结论的最小证据索引。
