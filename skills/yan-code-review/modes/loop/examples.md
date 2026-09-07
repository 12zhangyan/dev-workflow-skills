# Loop examples

## 有 finding 并发生修改

```text
ReviewAgentMode: SingleAgentReview
ReviewReceipt: order-null-guard-20260903
Scope: OrderService.java, OrderServiceTest.java
RepairCycles: 1
Findings: IM-1 Fixed（目标测试与最新 diff 复审通过）
TestEvidenceStatus: Passed
Recheck: Passed
BoardPublishStatus: NotRequested
自动提交：未执行
```

## 无 finding、无代码修改

```text
ReviewAgentMode: SingleAgentReview
ReviewReceipt: order-query-20260903
ReviewConclusion: NoEvidenceIssue
RepairCycles: 0
TestEvidenceStatus: NotRun
Recheck: NotRequiredNoCodeChange
BoardPublishStatus: NotRequested
自动提交：未执行
```

`NoEvidenceIssue` 与 `TestEvidenceStatus: NotRun` 分别描述审查和验证证据；是否达到用户的最终验收目标，需要结合本次请求判断。
