# 证据与门禁边界

本协议只在 VCS、验证或 Gate 结论存在歧义时读取。Gate 是对结论的证据要求，不是必须顺序执行的研发流水线。Agent 可按目标、授权和风险合并、跳过不适用状态、调整方案或并行委派独立切片；主 Agent 负责复核证据和冲突。

## 结论所需证据

- 方案、实际改动、验证结果和线上运行是不同证据层级。文档不能证明已经实现；源码或构建成功不能证明已经部署或运行正确。
- 实现结论以实际文件、VCS status/diff 或用户提供的 patch 为准，不能从任务名或旧 Brief 猜 `changed`。
- 验证结论必须给出本轮命令、结果和能证明的目标行为。未运行、只验证前置条件、陈旧报告或没有断言目标逻辑，均不能写成通过。
- Review finding 需要可复核定位、证据、影响和验证方式。修复沿用 finding ID；只有最新实现和验证都支持时才能关闭。
- 未关闭的 Critical/Important、敏感信息、目标验证失败或关键文件未纳管时，不得宣称 Review/Submit 已通过。
- 材料不足只限制受影响结论；其他有独立证据的切片可以继续。

常用状态名只在交接或机器消费有价值时使用：`Plan / Implementation / VCS / Verification / Review / Submit Gate`，以及 `Passed / Failed / NotProvided / NotRun / EnvironmentBlocked / NotApplicable`。普通任务用自然语言说明即可。

## 测试失败归因

需要区分测试契约和本机环境时，再记录 `TestDependencyClass`：

- `Hermetic`：不依赖网络、真实凭据或外部可变服务。
- `ServiceBacked`：依赖数据库、Redis、MQ 等受控服务。
- `LiveExternal`：调用真实 SaaS、AI、云或第三方 API，默认不混入普通 CI。
- `Mixed`：同一命令混合多类依赖，应分别说明已验证和未验证范围。

JDK、Node、构建工具或依赖下载使命令无法启动，可记 `EnvironmentBlocked`。默认测试/CI 本身强依赖未提供的真实凭据或不可控服务，则是测试架构或 CI 契约问题，不能伪装成环境阻塞，也不能注入假密钥绕过。报告前核对命令输出和报告时间，避免把旧测试结果当成本轮证据。

## VCS 归属与纳管

按每个候选变更文件向上查找最近的 `.svn` 或 `.git`，该工作副本才是 `VCS_OWNER`；外层 Git 的未跟踪目录不能替代内层 SVN 证据。按 owner 分组读取 status 和实际 diff。命令失败时保留错误并标记 `VCSStatusUnknown`，不能把空输出当 clean。

按项目规则应纳管的范围内新增源码、测试、配置、OpenAPI、SQL/XML 或正式文档尚未纳管时，仍可读取、修复和验证，但标记 `VCSGateBlocked`，不得宣称可提交。明确排除或仅本地保留的产物不因此阻塞。任何 add 操作都遵循当前项目规则和用户授权，只使用逐文件清单；禁止 `git add .`、目录级兜底、顺带纳管、自动 commit 或 push。

## 交付与交接

报告用户真正需要判断的内容：实际产物或改动、关键证据、验证结果、阻塞边界和未覆盖风险。不要求固定字段、唯一下一动作或完整 Gate 清单。

只有真实跨 Agent、跨任务或延期恢复时才读取 [Workflow Brief](workflow-brief.md)；Brief 只是证据索引。Review 的 finding/test 共享语义见 [workflow-chain.md](workflow-chain.md)，它同样不是执行流程。

数据库保持只读；DDL 和数据修复只能形成建议或审批材料。不得回显凭据，也不得用调度、委派或模板绕过用户授权、文件覆盖和外部副作用边界。
