# review-loop Examples

## 示例：标准模式闭环

用户输入：

```text
使用 code-review skill，mode=loop，基于 docs/2026-07-11/APP收货拆分.md 审查并修复当前工作区，直到没有 Critical/Important。
```

执行摘要：

```text
1. status/diff 显示 4 个实现文件、2 个测试文件。
2. 生成 review-task，ReviewScopeType=ImplementationReview。
3. 第一次 review-check：IM-1 原接口响应 DTO 被修改；MI-1 缺少 SGL 异常测试。
4. review-repair：恢复原 DTO；补 SGL 异常测试。
5. 运行模块测试通过，且断言目标状态变化。
6. 二次 review-check：NoEvidenceIssue。
7. 输出 Fixed、SingleAgentReview；不提交代码。
```

关键结果：

```text
ReviewMode: standard
ReviewAgentMode: SingleAgentReview
ReviewScopeType: ImplementationReview
修复结论：Fixed
TestEvidenceStatus: Passed
RepairCycles: 1
openFindings: 无
```

## 示例：遇到业务 blocker

第一次审查发现“驳回后状态应回到 ELM 还是进入 RJT”没有证据。review-loop 必须停止该 finding，询问用户；不能为了完成一键流程自行选择状态，也不能把 finding 标为 fixed。

## 示例：快速模式

```text
使用 code-review skill，mode=loop quick，审查并修复当前工作区的小改动。
```

若实际发现接口契约或跨模块变更，自动升级 standard，生成 review-task 后继续。
