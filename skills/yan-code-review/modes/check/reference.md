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

## 容易误判的例子

仅借相关例子校准证据，不把表格变成必跑清单：

| 观察 | 应检查什么 | 结论边界 |
|------|------------|----------|
| 新增 PARTIAL 状态，接收接口已通过测试 | 实际会消费它的标签、任务和过滤分支是否仍按旧状态集合处理 | 未改消费者也可能有缺陷；只导出已完成记录的既定规则不必扩大 |
| Service 测试给 repository stub 返回已过滤结果 | 真实 Mapper/SQL 是否负责过滤，是否有契约或集成覆盖 | 可证明 Service 使用结果，不能据此证明 SQL 正确；不把所有 mock 测试判无效 |
| 测试通过，但 stub 替换了正在修复的方法 | 输入是否进入目标实现、断言能否区分正确与错误结果 | 测试没有证明修复；不要为补数量添加同样的空洞测试 |
| 搜不到同名单测 | 功能是否经上层入口、参数化用例或共享 fixture 得到断言 | 先查覆盖关系，未搜到文件名不等于没有覆盖 |
| 全部新增代码风格良好，需求却要求失败时不发消息 | 失败入口到消息调用的实际路径与副作用断言 | 验收遗漏仍是问题；不凭通用“最佳实践”新增未确认需求 |

## Finding 内容

Check 产生稳定 source ID：`CR-n / IM-n / MI-n`。package 首次聚合可映射为 canonical ID，但必须永久保留 source alias；repair 沿用 canonical ID。

至少保留 ID、定位/证据和可观察影响；修复方向和验证建议仅在有把握时补充。缺少核心证据时不生成 accepted finding，归入材料缺口、待确认或非阻塞观察。

## 输出包络

先用普通中文给用户结论、最高优先级问题或无问题边界和验证证据。只有交接或审计需要时才附机器字段；下一动作按真实缺口给出，可以没有，也可以并行：

```text
ReviewScopeType: <PlanReview|ImplementationReview|FixHandoffReview>
Conclusion: <Findings|NoEvidenceIssue|InsufficientMaterial>
Scope: <已检查与未检查范围>
Coverage: <仅在分批/中断/审计需要时；本轮基线、应审单元、已审/排除/失败/待审及原因>
VCS: <owners/status/untracked/unknown>
Tests: TestEvidenceStatus=<Passed|Failed|NotProvided|NotRun|EnvironmentBlocked|NotApplicable>; command/result=<证据与限制>; TestDependencyClass=<仅外部依赖或失败归因需要时：Hermetic|ServiceBacked|LiveExternal|Mixed|Unknown>
BoardPublishStatus: <仅实际发布时填写 Published|Blocked>
Findings: <结构化条目或无>
Next: <必要动作>
```

测试状态全集：Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable。

结论差异：

- `Findings`：按严重度给有证据的条目；只有用户已授权修改时才指向 repair。
- `NoEvidenceIssue`：写“在已检查范围内未发现有证据的问题”，列出范围与限制；不输出空 finding 分组，不自动建议 repair/package。只有实现范围、VCS 完整性和必要验证都满足时，Review Gate 才可为 passed；PlanReview 不代表实现通过。
- `InsufficientMaterial`：列最小缺失材料及无法判断的范围，不写“未发现问题”。

需要跨 Skill、Agent 或任务继续时才加载共享 Workflow Brief，并在一个可访问位置保留唯一一份；本文件不复制模板。
