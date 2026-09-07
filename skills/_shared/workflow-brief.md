# Workflow Brief

只在跨 Agent、跨任务或延期恢复时使用。Brief 是恢复工作的最小证据索引，不是第二份方案、findings 或聊天摘要。

```text
【Workflow Brief】
task: <目标>
scope: <授权、禁止事项和不可逆边界>
evidence: <裁决当前动作必需的路径、命令、ID 或状态>
next: <可执行动作及完成判据；独立动作可并列>
state: <可选；当前真实状态>
verification: <可选；已运行命令、结果和未证明范围>
open: <可选；未决 finding、blocker 或裁决>
inFlight: <可选；所有者/任务句柄、范围、状态和等待条件>
vcs: <可选；仅在 owner、未跟踪或提交状态影响 next 时>
api: <可选；仅在契约或规范产物影响 next 时>
```

`task/scope/evidence/next` 是恢复任务的最小核心；其余字段只有提供信息增益时才出现。内容长短由恢复任务所需证据决定，不填空字段，也不复制正文、源码、长 diff、日志或秘密。

Brief 记录授权但不产生授权。接手方先核验最能裁决 `next` 的证据；业务、权限、接口、数据库、验证结果或部署状态不能仅凭摘要推断。计划、编译和历史结果不能冒充本轮验证。

有依赖时只列当前可推进前沿；互不覆盖的动作可以并行。已有在途工作时记录句柄和等待条件，避免重复派发。普通实现、测试和验收由 Agent 自主完成，不要求转到外部 Skill。

旧产物中的 `stage/source/artifacts/changed/tests/openFindings/nextCommand/tokenHint` 只作为输入兼容，映射到当前证据后复核漂移；新产物不再复制旧字段和读取话术。
