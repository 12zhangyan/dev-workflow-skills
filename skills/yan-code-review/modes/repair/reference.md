# Repair 补充参考

仅在需要完整归一化表或完成格式时读取。

## Finding 归一化

| 状态 | 判定 | 动作 |
|------|------|------|
| accepted | 有定位、证据、期望行为和验证方式 | 在授权范围内修复 |
| needs-confirmation | 业务、权限、状态、API/数据结构或证据冲突 | 保留 `BK-n`，只阻塞相关项 |
| rejected | 误报、无证据、超范围或纯风格偏好 | 保留 `RJ-n` 与依据 |
| deferred | 当前不处理的低收益项 | 记录原因 |
| deferred-next-batch | 有证据但与本轮独立、越界或需另一环境 | 明确下一批边界 |

归一化前检查 ID 唯一性：同一 ID 对应不同根因时标记 `Blocked`；同根因重复项可合并来源，但不丢 source alias。已有 canonical ID 不因严重度或批次变化静默重编。

工作切片由 Agent 按风险、依赖、共享根因、模块/VCS owner、可独立验证性和当前授权决定，不设固定 finding 或文件数量。每个输入 ID 都必须得到本轮终态。

## 完成格式

```text
Result: <Fixed|PartiallyFixed|Blocked>
Changed: <实际文件及作用>
Findings:
- <ID>: <fixed|deferred|deferred-next-batch|blocked|rejected>; <依据>
Tests: status=<Passed|Failed|NotRun|EnvironmentBlocked>; command/result=<证据与限制>; dependency=<可选，仅外部依赖或失败归因需要时>
VCS: <owners、修复前后 diff、未跟踪文件、VCSGateBlocked>
BoardPublishStatus: <Published|NotRequested|Blocked>
Next: <唯一动作>
```

`TestEvidenceStatus` 只有在本轮验证实际调用并断言目标行为时才是 `Passed`。环境/工具链无法启动是 `EnvironmentBlocked`；默认 CI 设计成依赖真实外部服务是 `Failed` 的测试契约问题。只在这类依赖边界会帮助裁决时才补充 `TestDependencyClass`。

存在未关闭 CR/IM、验证失败或未跟踪关键文件时，结果不能冒充完整关闭。是否复审由残余风险、公共契约影响和验证缺口决定，不按文件数量机械触发。

需要跨 Skill、Agent 或任务继续时才加载共享 Workflow Brief，并保留唯一一份；本文件不复制模板。无需移交且结果已闭合时不输出 Brief。
