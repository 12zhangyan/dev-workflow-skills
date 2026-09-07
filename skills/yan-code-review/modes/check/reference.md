# Check 补充参考

仅在审查维度或输出格式需要补充时读取；常规窄范围 Review 直接按 mode 执行。

## 风险视角

从变更行为推导相关视角，不逐项打卡：

| 视角 | 典型证据 |
|------|----------|
| 业务与数据正确性 | 状态/金额/数量/权限规则、调用链、SQL 条件、幂等约束 |
| 边界、事务与并发 | 异常路径、回滚边界、共享状态、锁和条件更新 |
| 安全与兼容 | 鉴权、敏感日志、注入、接口/字段/配置变化、旧数据 |
| 性能与部署 | 循环远程调用、N+1、扫描范围、运行配置和 CI |
| 测试有效性 | 是否调用并断言目标逻辑、依赖类型、默认 CI 可重复性 |
| 交付完整性 | 最近 `VCS_OWNER` 的 status/diff、未跟踪源码/测试/配置 |

只有相关文件、契约或行为命中时才扩展专门领域；不要因清单存在而制造 finding。

## Finding 内容

Check 产生稳定 source ID：`CR-n / IM-n / MI-n`。package 首次聚合可映射为 canonical ID，但必须永久保留 source alias；repair 沿用 canonical ID。

至少保留 ID、定位/证据和可观察影响；修复方向和验证建议仅在有把握时补充。缺少核心证据时不生成 accepted finding，归入材料缺口、待确认或非阻塞观察。

## 输出包络

先用普通中文给用户结论、最高优先级问题或无问题边界和验证证据。只有交接或审计需要时才附机器字段；下一动作按真实缺口给出，可以没有，也可以并行：

```text
ReviewScopeType: <PlanReview|ImplementationReview|FixHandoffReview>
Conclusion: <Findings|NoEvidenceIssue|InsufficientMaterial>
Scope: <已检查与未检查范围>
VCS: <owners/status/untracked/unknown>
Tests: TestDependencyClass=<Hermetic|ServiceBacked|LiveExternal|Mixed|Unknown|NotApplicable>; TestEvidenceStatus=<Passed|Failed|NotProvided|NotRun|EnvironmentBlocked|NotApplicable>; command/result=<证据与限制>
BoardPublishStatus: <NotRequested|Published|Blocked>
Findings: <结构化条目或无>
Next: <必要动作>
```

结论差异：

测试状态全集：Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable。

- `Findings`：按严重度给有证据的条目；只有用户已授权修改时才指向 repair。
- `NoEvidenceIssue`：写“在已检查范围内未发现有证据的问题”，列出范围与限制；不输出空 finding 分组，不自动建议 repair/package。只有实现范围、VCS 完整性和必要验证都满足时，Review Gate 才可为 passed；PlanReview 不代表实现通过。
- `InsufficientMaterial`：列最小缺失材料及无法判断的范围，不写“未发现问题”。

需要跨 Skill、Agent 或任务继续时才加载共享 Workflow Brief，并在一个可访问位置保留唯一一份；本文件不复制模板。
