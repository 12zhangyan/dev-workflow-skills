---
name: review-check
description: 对 Review 任务包、yan-dev-doc、patch/diff 或当前工作区执行一次只读代码审查并输出结构化 findings；不得修改代码。由 yan-code-review 根入口的 check mode 加载。
---

# 代码审查执行

## 任务定位

执行一次**只读 code review**。它回答的是："这批改动有没有会导致缺陷、回归、安全风险或维护风险的问题？"

与相邻 skill 的分工：
- `yan-code-review mode=package`：生成 Review 任务包，回收多方 findings，并产出修复交接。
- `yan-code-review mode=check`：拿任务包或 diff 执行一次审查，只输出 findings，不修代码。
- `yan-code-review mode=repair`：已有 findings 后直接修改代码并验证。
- `yan-code-review mode=loop`：同一 AI 编排审查、修复、验证和复审闭环。
- `yan-project-analysis mode=understanding`：生成代码地图，只梳理结构，不判断问题。

## 执行流程

### 共享交互协议

先遵循 [../../../_shared/interaction-policy.md](../../../_shared/interaction-policy.md)：只基于已读取材料下结论；材料不足时输出"材料不足，无法下结论"，不要伪装成未发现问题；需求/实现/状态/权限/数据归属冲突要作为重点审查项。

非交互/无人值守运行中不等待提问：入口或关键材料缺失时直接输出 `InsufficientMaterial`、最小缺失材料和受影响范围；不修改文件，也不给 Review Gate 通过结论。

同时遵循 [../../../_shared/workflow-gates.md](../../../_shared/workflow-gates.md)：本 skill 只执行 Review Gate 的只读审查；输出必须包含 `ReviewScopeType`、`VerificationStatus` 和 `TestEvidenceStatus`，说明本次审的是方案/实现/修复交接、已看到或未看到哪些验证命令/结果、测试是否真的验证目标逻辑；材料不足时不能给通过结论。

若输入包含 `【Workflow Brief】`，同时遵循 [../../../_shared/workflow-brief.md](../../../_shared/workflow-brief.md)：先把 Brief 当读取索引，按 `tokenHint` 依次读取 `source`（review-task/yan-dev-doc）与 `changed` 文件，再按审查清单核对；不要因为已有 Brief 就跳过原始 diff/源码证据，也不要要求用户重新粘贴全文。

### Step 0：入口识别

`$entry` 为空时询问：

> "这次要审查什么？请给 Review 任务包路径、yan-dev-doc 路径、patch/diff 路径，或一句功能描述。"

入口模式：
- 文本含 `【Workflow Brief】` → **轻量交接模式**：先读 Brief 的 `source` / `changed` / `openFindings` / `tokenHint`，据此按需读取任务包和 changed 文件，不扩展到无关目录；随后仍走对应源模式的审查清单。
- 路径包含 `review-task.md` 或文档标题含 `Review 任务包` → **任务包模式**
- 含 `.patch` / `.diff` 或文件名含 `changes.patch` → **patch 模式**
- 含 `.md` 且路径在 `docs/` 下 → **文档模式**
- 其他自然语言 → **上下文模式**

告知用户："检测到入口模式：[模式名]，开始只读审查。"

### Step 1：收集审查材料

静默执行，只用于审查，不完整展示给用户：

1. 运行 `node <helper> detect-vcs`，读取返回的 `type` 与 `root`。
2. Git：以 `root` 为工作目录读取当前分支、`status --short`、`diff --name-status` 和实际 diff；SVN：以 `root` 为工作目录读取 info/revision、status、diff summarize 和实际 diff。无 VCS 时记录 `VCS_TYPE=none`。
3. 使用当前宿主的目录枚举/搜索能力，在 VCS root 下最多 3 层查找 `pom.xml`、`build.gradle`、`package.json`，不要依赖 POSIX `find`。

判断规则：初始 root 只用于发现；最终必须按 workflow-gates 的“VCS 证据归属”对候选变更文件逐个确定最近的 `VCS_OWNER` 并分组取证。命令失败保留退出码/错误摘要并写 `VCSStatusUnknown`，不能把空输出当 clean。Git 项目同时看 status、name-status 和实际 diff；SVN 项目同时看 status、summarize 和实际 diff。

按模式读取：
- 任务包模式：Read `$entry`，提取审查目标、证据包路径、关键源码、测试命令和回收格式。
- patch 模式：Read patch/diff，提取文件列表、关键 hunk、接口/状态/事务相关改动；若存在 `??` 新增文件，按路径优先级主动读取关键新增文件。
- 文档模式：Read yan-dev-doc，提取目标、范围、代码变更清单、测试关注点；必要时读取同日期的 `docs/code-reading/`。
- 上下文模式：用 Grep/Glob 查找候选入口；不确定时询问用户补充 yan-dev-doc、patch 或入口类。

优先读取：
1. 任务包或 yan-dev-doc 明确点名的关键文件。
2. 后端：Controller/Service/Mapper/Repository/DTO/枚举/配置类、SQL/XML/YAML。
3. 前端：路由、请求封装、状态管理、鉴权守卫、核心 Vue 页面、SSE/iframe/富文本渲染。
4. AI 生成/文件工具：读写/列表工具、路径解析器、沙箱根目录、生成产物部署逻辑。
5. 配置与部署：环境变量模板、Docker、CORS、JWT/Redis/LLM profile、CI 命令。

### Step 2：按清单审查

加载清单：[reference.md](reference.md#审查清单)

审查顺序：
1. **需求一致性**：实现是否符合 yan-dev-doc / Review 任务包目标。
2. **需求冲突与业务正确性**：用户口径、yan-dev-doc、现有状态机、字典、权限、数据归属、接口先后依赖是否冲突；主流程、状态流转、金额/数量/权限/库存等关键规则是否正确。
3. **边界与异常**：null、空集合、非法枚举、重复提交、异常分支。
4. **事务与并发**：回滚边界、跨服务调用、幂等、锁、分页状态。
5. **安全与敏感信息**：越权、敏感日志、注入、明文凭证。
6. **前端交互**：路由守卫、token 刷新、SSE 错误事件、XSS/iframe、loading 状态。
7. **AI 文件沙箱**：路径穿越、覆盖写、读取截断、生成/修改模式误判、部署回滚。
8. **性能与兼容**：N+1、循环远程调用、接口签名/响应结构变更、OpenAPI 生成兼容。
9. **测试与验证**：测试是否覆盖正常、异常、边界、回归；测试名、测试数据和断言对象是否真的调用并验证目标逻辑，避免只验证前置条件或临时目录自证；新增/修改的测试文件是否已纳入 VCS。读取测试注解/tag/profile、配置和 CI workflow，输出 `TestDependencyClass`；默认 `test/verify` 混入真实 AI/SaaS 调用、要求未提供的真实密钥或不可控外部服务时，输出 `Important` 测试架构/CI 契约 finding，`TestEvidenceStatus=Failed`，不得写成 `EnvironmentBlocked`。
10. **提交完整性**：关键源码、测试、配置、SQL/XML、前端资源等是否存在"本地有文件但未被 Git/SVN 跟踪"的问题；这类问题即使本地测试通过，也会导致提交后缺文件。

### Step 3：判定 finding

只输出满足以下条件的问题：
- 能定位到文件、方法、接口、配置或数据路径。
- 有来自 diff/源码/文档的证据。
- 能说明影响。
- 有可执行修复建议。
- 有验证方式。

证据独立性（保证 findings 可复核、不放大误判）：
- `Critical` / `Important` 的 Evidence 必须来自**实际读到的代码或 diff**，写清 `路径:行号` 或 `类.方法`；只凭 yan-dev-doc/任务包声称"应该如此"而未读到对应实现时，最多记为 `Important` 并在 Evidence 注明"未读到实现，需确认"，不得直接判 `Critical`。
- 关键源码没读到就无法证实的问题，归入 `InsufficientMaterial` 或 `Notes`，不要凭推测升级严重度。

分级：
- `Critical`：可能造成数据错误、核心流程不可用、安全漏洞、生产事故。
- `Important`：高概率缺陷、重要回归、边界/异常会失败，修完再继续。
- `Minor`：维护性、局部测试增强、命名/重复逻辑等不阻塞问题。
- `Notes`：不确定观察或非阻塞建议，不进入 findings。

结论状态（三选一）：
- `Findings`：发现有证据的问题。
- `NoEvidenceIssue`：材料足够，未发现有证据的阻塞问题。
- `InsufficientMaterial`：关键材料不足，无法对目标范围下结论。必须列缺失材料和受影响结论范围，不得写"未发现问题"。

### Step 4：输出结构化结果

按模板输出：[reference.md](reference.md#输出格式)

要求：
- findings 按 `Critical / Important / Minor` 分组。
- 固定输出 `VerificationStatus`：已运行/未运行/未提供；命令、结果或未运行原因。
- 固定输出 `TestDependencyClass`：`Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown / NotApplicable`，说明默认命令与独立外部测试的边界。
- 每条包含 `File/Line`、`Problem`、`Evidence`、`Impact`、`Fix`、`Verify`。
- 没有明确问题时，先判断材料是否足够：足够才输出"未发现有证据的阻塞问题"并列出已检查范围；不足则输出"材料不足，无法下结论"。
- 不输出大段源码，不复述全部 diff。

### Step 5：结束提醒

结尾输出：

```text
可将以上 findings 原样交给 `yan-code-review mode=package`，用于生成修复交接文档。
如果希望直接修复，可将 findings 交给 `yan-code-review mode=repair`；它会修改代码并运行验证。
```

## 禁止事项

- 不修改代码，不写文件，不运行修复命令。
- 不执行数据库写操作或 DDL；涉及数据库只允许只读分析。
- 不把风格偏好包装成严重问题。
- 不因为"可能"就输出 finding；证据不足放入 Notes。
- 不在材料不足时宣称通过或未发现问题。
- 不要求重构无关模块，不回滚用户已有改动。

## 检查清单

- [ ] 已识别入口模式
- [ ] 已读取任务包 / yan-dev-doc / patch / 关键源码
- [ ] 已按审查清单覆盖正确性、边界、事务、并发、安全、前端/SSE、AI 文件沙箱、性能、兼容、测试与提交完整性
- [ ] 每条 finding 都有证据、影响、修复建议、验证方式
- [ ] 已在 Findings / NoEvidenceIssue / InsufficientMaterial 三种结论中选择一种，并写明依据
- [ ] 未修改任何代码或文档
- [ ] 输出可直接交给 `yan-code-review mode=package`

## 相关资源

- 审查清单与输出模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 组织多 AI review 与修复交接：`yan-code-review mode=package`
- Review 后直接修复：`yan-code-review mode=repair`
- Review 前代码地图：`yan-project-analysis mode=understanding`
