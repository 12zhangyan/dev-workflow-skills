# Loop receipt reference

仅在用户需要持久审计回执或完成格式仍歧义时读取。本文件不是第二套执行状态机。

```text
ReviewAgentMode: SingleAgentReview
ReviewReceipt: <stable receipt id>
Scope: <actual reviewed implementation and tests>
VCS_OWNER: <owner roots>
UntrackedInScope: <paths|none>
RepairCycles: <0|1|2>
Recheck: <Passed|FindingsRemain|NotRequiredNoCodeChange|Blocked>
TestDependencyClass: <Hermetic|ServiceBacked|LiveExternal|Mixed|NotApplicable>
TestEvidenceStatus: <Passed|Failed|NotProvided|NotRun|EnvironmentBlocked|NotApplicable>
BoardPublishStatus: <Published|NotRequested|Blocked>
自动提交：未执行
```

finding 表只保留有信息增益的列：`ID / 严重级 / 状态 / 证据 / 验证`。状态使用 `Fixed / Rejected / Deferred / Blocked / Open`，同一 ID 不得换根因。

结论独立表达：

- `NoEvidenceIssue`：在已检查范围内没有有证据的问题，不代表测试已运行或业务验收完成。
- `Fixed`：相关 finding 有最新实现和验证证据关闭，且无对应 Gate blocker。
- `PartiallyFixed`：至少一项完成，但仍有未关闭 finding、验证缺口或 VCS blocker。
- `Blocked`：缺少授权、关键业务裁决、实现证据或可执行验证。

只有无未关闭 Critical/Important、目标验证满足用户验收要求且 VCS Gate 不阻塞时，才能写 Review Gate 通过。需要交接时引用共享 Workflow Brief，不在本文件复制模板。
