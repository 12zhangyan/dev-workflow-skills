---
name: review-repair
description: 根据 code review findings 或 fix-handoff 直接修改代码并验证；只在已有 findings、review 结果或明确问题清单时触发。由 yan-code-review 根入口的 repair mode 加载。
---

# Review 后直接修复

## 任务定位

本 skill 用于 **Code Review 之后直接修代码**。它接收 `review-check` findings、其他 AI 的 code review 结果、`review-fix` 生成的 fix-handoff，或用户粘贴的问题清单，然后在当前工作区内完成修复、补必要测试、运行验证并输出闭环结果。

触发边界：
- 用户要“审查/Review/找问题” → 使用 `review-check`，不要使用本 skill。
- 用户要“一个 AI 审查并修复/一键 review 并修复”且还没有 findings → 使用 `review-loop`，不要使用本 skill。
- 用户要“生成 review 任务包/汇总多 AI findings/生成修复交接” → 使用 `review-fix`。
- 用户已有 findings 并要求“直接修/按这些问题改/关闭这些 finding” → 使用本 skill。
- 用户只给 yan-dev-doc、patch 或功能描述但没有 findings → 不直接修；只读找问题用 `review-check`，多 AI 任务包用 `review-fix`，同一 AI 完整闭环用 `review-loop`。

与相邻 skill 的分工：
- `review-check`：只读审查，只输出 findings，不改代码。
- `review-fix`：生成 review 任务包、汇总多 AI findings、产出修复交接和操作码。
- `review-loop`：在没有现成 findings 时，由同一 AI 编排审查、修复、验证和复审。
- `review-repair`：拿已明确的问题直接修复，并证明修复结果。
- `code-reading`：生成代码地图，不判断问题，不修代码。

## 共享协议

先遵循 [../../../_shared/interaction-policy.md](../../../_shared/interaction-policy.md)：证据预填、只问阻塞问题、显式记录需求/实现/状态/权限/数据归属冲突。

非交互/无人值守运行中，`needs-confirmation` 转为 `Blocked` 并保留 finding ID；不等待回复、不修改对应代码，继续处理与其独立且证据充分的 accepted finding。

同时遵循 [../../../_shared/workflow-gates.md](../../../_shared/workflow-gates.md)：本 skill 位于 Review Gate 之后、Verification Gate 之前；修完必须回到 Verification Gate，并输出每条 accepted finding 的处理结果。

若输入包含 `【Workflow Brief】`，同时遵循 [../../../_shared/workflow-brief.md](../../../_shared/workflow-brief.md)：先把 Brief 当作读取索引，按 `tokenHint` 读取 source、artifacts、changed 文件，再核对原始 findings；不要只凭 Brief 改业务逻辑。

## 执行流程

### Step 0：入口识别

`$entry` 为空时只问一个问题：

> "请贴 review findings，或给 `docs/review-fix/...-fix-handoff.md` / `...-review-task.md` 路径。"

入口模式：
- 路径含 `fix-handoff.md` → **修复交接模式**，优先读取其中的 Critical / Important / Minor / Rejected。
- 路径含 `review-task.md` → **任务包模式**，读取任务包；若没有 findings，要求用户补 review 结果，不直接修。
- 文本含 `【Workflow Brief】` → **轻量交接模式**，先按 `source`、`artifacts`、`changed`、`openFindings` 和 `tokenHint` 定位材料，再进入 findings/fix-handoff 修复。
- 文本含 `Severity:`、`Critical`、`Important`、`Findings`、`File/Line` → **findings 文本模式**。
- 文本是自然语言问题清单 → **问题清单模式**，只处理能定位到文件/方法/行为的问题；证据不足的列为待确认。

若输入同时包含 review task 和 findings，优先按 findings 修复；review task 只作为上下文证据。

若输入同时包含 Workflow Brief 和 findings，先用 Brief 控制读取范围，再按 findings ID 修复；Brief 不替代原始 finding 证据。

如果输入只有 review task、yan-dev-doc、patch 或 diff，且没有明确 finding，不进入修复；输出一行建议：`请先运行 review-check 生成 findings，或贴出需要修复的问题清单。`

告知用户："检测到入口模式：[模式名]，开始直接修复；不会提交代码，也不会执行数据库写操作。"

### Step 1：静默收集工作区证据

执行 VCS 与项目类型检测，结果用于保护本地改动和选择验证命令，不完整展示给用户：

1. 运行 `node <helper> detect-vcs`，读取返回的 `type` 与 `root`。
2. Git：以 `root` 为工作目录读取 `status --short`、`diff --name-status` 和实际 diff；SVN：读取 status、diff summarize 和实际 diff；无 VCS 时记录 `VCS_TYPE=none`。
3. 使用当前宿主的目录枚举/搜索能力，在 VCS root 下最多 3 层查找 `pom.xml`、`build.gradle`、`package.json`，不要依赖 POSIX `find`。

判断规则：
- 初始 root 只用于发现；最终按 workflow-gates 的“VCS 证据归属”对 finding/Brief 指向的文件逐个确定最近 `VCS_OWNER`，按 owner 分组读取 status 和实际 diff。
- 命令失败保留退出码和错误摘要，写 `VCSStatusUnknown`；不得用空输出冒充 clean。任一范围内 owner 有未纳管源码、测试、配置、OpenAPI 或正式文档时写 `VCSGateBlocked`。
- Git dubious ownership 时只在本次命令使用 `git -c "safe.directory=$vcs_root"`，不改全局配置。
- 修复前记录当前已改文件、变更文件列表和关键 diff 摘要；不要回滚、覆盖或格式化与本次 finding 无关的本地改动。
- 如果输入提到新增测试/配置/OpenAPI 文件，主动检查这些文件是否已纳入 Git/SVN 可见范围。

### Step 2：归一化 findings

加载规则与输出模板：[reference.md](reference.md)

把输入整理成五类：
- `accepted`：有文件/方法/行为证据，能直接修复。
- `needs-confirmation`：涉及业务语义、状态流转、权限、接口契约、DB 结构、数据修复或用户口径冲突；先停下来问一个阻塞问题。
- `rejected`：误报、无证据、超范围、纯风格偏好或与项目规范冲突。
- `deferred`：Minor 或低收益建议，只记录当前不处理，不承诺进入下一批。
- `deferred-next-batch`：证据充分，但超过本轮批次上限或属于另一个模块/根因，明确排入下一批。

ID 规则：
- 输入已有 `CR-1` / `IM-2` / `MI-3` 等 ID 时原样保留。
- 没有 ID 时按严重级别补临时 ID：`CR-n`、`IM-n`、`MI-n`、`BK-n`、`RJ-n`。
- 输出中的每条处理结果必须能追溯到输入 finding；不要把多个不同根因合并成一个模糊项。

直接修复门槛：
- 必须能定位到文件、方法、接口、配置或数据路径。
- 必须有明确期望行为或可验证结果。
- 不得要求执行数据库写操作、DDL、数据修复 SQL。
- 不得要求重构无关模块或回滚用户已有改动。

### Step 3：制定最小修复计划

对每条 accepted finding 写内部修复计划：

| ID | 文件/方法 | 修复动作 | 影响范围 | 验证方式 |
|----|-----------|----------|----------|----------|

计划原则：
- 先 Critical，再 Important，再低风险 Minor。
- 优先复用当前文件附近的模式、工具类、异常处理、测试风格。
- 能补测试就补测试；测试成本明显过高时，在输出里说明未补原因和替代验证。
- 如果同一文件存在 unrelated dirty changes，读清楚后在其基础上最小修改；无法区分时只问一个确认问题。
- 记录每个 finding 的验证层级：单元测试、集成测试、编译、接口手测、静态检查或人工核对。

批次规则：
- 单轮默认最多处理 5 条 accepted findings，或最多 8 个文件；超过时先修 Critical / Important，并把剩余项标为 `deferred-next-batch`。
- 跨 2 个以上服务/模块时，按服务/模块拆批；不要在一轮里同时改多个不相关模块。
- 同一根因影响多个文件时可以同批处理，但要在输出里说明根因归并关系。
- 若批次中出现新的 blocker、验证失败且无法定位、或 diff 范围超出计划，停止后续 finding，先输出当前批次结果。

### Step 4：执行修复

使用 Edit/Write 修改代码和必要测试：
- 只改 accepted findings 需要的文件和必要测试。
- 不做顺手重构、统一格式化或大范围命名调整。
- 不执行 `git add` / `svn add` / commit，除非用户明确要求；但要报告新增文件是否需要纳入 VCS。
- 如果修复需要 DDL、数据修复或业务语义确认，停止对应 finding，输出 DBA/确认建议，不猜着改。
- 每完成一批 Critical / Important 后，重新读取相关文件或 diff 摘要，确认修改实际落在预期位置。

### Step 5：运行验证

优先使用 findings、fix-handoff、yan-dev-doc 或项目结构里的验证命令。

常见兜底：
```bash
mvn test
./gradlew test
npm test
```

多模块 Java 项目优先尝试模块级命令：
```bash
mvn -f <module-pom> test
mvn -pl <module> -am test
```

Windows PowerShell 使用 Maven Wrapper 时，把 `-Dkey=value` 参数作为一个完整字符串传入，例如 `.\mvnw.cmd '-Dtest=OrderServiceTest' test`；若 Maven 报告属性后半段是未知 lifecycle phase，先修正参数引用，不把命令解析错误归因于代码。

验证失败时：
- 如果失败与本次修复相关，继续修到通过。
- 如果失败明显来自既有环境/无关模块，记录命令、失败摘要和判断依据。
- 不要把未运行或失败的验证写成通过。

先根据测试注解/tag/profile、配置和 CI workflow 判定 `TestDependencyClass`：`Hermetic / ServiceBacked / LiveExternal / Mixed`；无法取证时写 `Unknown`。默认 CI 应运行 Hermetic 与受控 ServiceBacked，LiveExternal 必须拆到独立 profile、tag 或 secret-protected job。

判定 `TestEvidenceStatus`：
- 验证命令通过，且测试/检查实际调用并断言本次修复的目标逻辑 → `Passed`。
- 验证命令失败，且失败与本次修复或目标逻辑相关 → `Failed`。
- 因时间、缺少依赖信息、用户限制或项目无可用命令未运行 → `NotRun`，必须写明原因。
- JDK/Node/Maven/npm/依赖下载等工具链不满足，或显式执行 LiveExternal 测试时网络不可用导致无法启动 → `EnvironmentBlocked`，必须记录命令、失败摘要和工具链版本；不得把环境阻塞当业务代码缺陷修。
- 默认 `test/verify` 自身强依赖真实 API key/外部服务，且 CI 未声明对应 secret/service → `Failed`，作为测试架构/CI 契约问题修复；不得用伪造密钥绕过，也不得标为 `EnvironmentBlocked`。修复方向是隔离 LiveExternal，并重跑 Hermetic/受控 ServiceBacked 子集。
- 只验证编译、mock 前置条件、临时目录存在性等，未调用或断言目标方法/接口/状态变更时，不得标为 `Passed`；应标为 `NotRun` 或 `Failed` 并说明测试证据不足。
- Surefire/JUnit/覆盖率报告必须确认来自本轮命令；若报告目录含旧失败、已删除测试或时间早于本轮运行的文件，先执行有针对性的 `clean` 或按时间戳过滤，再形成验证结论。

二次 review-check 触发条件：
- Critical / Important 修复超过 2 个文件。
- 修复改动了公共工具、公共 DTO、接口签名、权限、状态流转、事务边界。
- 修复时补充了新测试但未能运行完整验证。
- 验证失败但判断为环境/无关问题。

### Step 6：VCS 完整性复查

修复后再次查看：
- Git：`git status --short`、`git diff --name-status`
- SVN：`svn status`、`svn diff --summarize`

检查：
- 新增源码/测试/配置是否未跟踪。
- 是否误改了无关文件。
- 是否出现敏感信息、临时 patch、日志、凭证文件。
- 修复前后 diff 是否只覆盖 accepted findings 和必要测试。

### Step 7：输出修复结果

按 [reference.md](reference.md#完成输出格式) 输出：
- 修复结论：`Fixed` / `PartiallyFixed` / `Blocked`。
- `TestDependencyClass`：`Hermetic` / `ServiceBacked` / `LiveExternal` / `Mixed` / `Unknown`，并说明默认 CI 与外部测试边界。
- `TestEvidenceStatus`：`Passed` / `Failed` / `NotRun` / `EnvironmentBlocked`，并说明验证是否证明目标逻辑。
- 每条 finding 的处理状态：`fixed / deferred / deferred-next-batch / blocked / rejected`。
- 未处理项的后续去向：`deferred` 写明不处理原因；`deferred-next-batch` 写明下一批顺序；`blocked` / `rejected` 写明阻塞或拒绝依据。
- 修改文件。
- 验证命令和结果。
- VCS 完整性提示。
- 修复前后 diff 范围摘要。
- 是否建议二次 `review-check`。
- 可复制回贴块：用于贴回 `review-fix`、提交给人工 reviewer 或记录到任务对话。
- `【Skill 维护反馈】` 反馈块。

## 禁止事项

- 不在没有 findings / 问题清单 / fix-handoff 的情况下凭空修复。
- 不执行数据库写入、DDL、数据修复 SQL。
- 不提交、不 staged、不 push，除非用户明确要求。
- 不回滚用户已有无关改动。
- 不把材料不足的问题标成 fixed。
- 不把 Rejected / Notes 当成必须修。
- 不为追求一次完成而跨模块大范围修改；超出批次上限时分批输出。

## 检查清单

- [ ] 已识别入口模式并读取 findings / fix-handoff / review-task。
- [ ] 已收集 VCS 状态和项目类型。
- [ ] 已把 findings 分为 accepted / needs-confirmation / rejected / deferred。
- [ ] 阻塞型业务/DB/API/权限问题没有猜着修。
- [ ] 已按最小范围修改代码和必要测试。
- [ ] 已运行针对性验证；无法验证时已说明原因。
- [ ] 已复查 Git/SVN 状态和新增文件跟踪情况。
- [ ] 已输出每条 finding 的处理结果和后续建议。

## 相关资源

- 输出模板与示例：[reference.md](reference.md)
- 只读审查：`review-check`
- Review 任务包与修复交接：`review-fix`
- 完整工作流：仓库 `docs/workflow-guide.md`
