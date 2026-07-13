---
name: review-loop
description: 用一个 AI 把当前实现的一轮代码审查、修复、验证和复审闭环一次跑完——默认串联 review-fix 证据包、review-check 只读 findings、review-repair 直接修复，并在改动后再次 review。用户说“一键 review 并修复”“一个 AI 把这批 review skill 全跑完”“审查当前改动直到没有 Critical/Important”时必须使用。只想看问题不改代码用 review-check；已有明确 findings 只需修复用 review-repair；要分发给多个 AI 审查或只生成任务包用 review-fix。Codex 用自然语言点名 review-loop skill；Claude Code 可用 /review-loop；Cursor 按当前 skill 入口或自然语言点名。
argument-hint: [dev-doc路径 | 当前工作区 | 功能描述] [standard|quick]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# 单 AI Review 闭环编排

## 任务定位

本 skill 是 `review-fix → review-check → review-repair → 验证 → 二次 review-check` 的单 AI 编排器。它不取代三个基础 skill，而是按顺序加载并执行它们的当前规则，让用户一次输入即可得到可追溯的审查、修复和复审结果。

一次运行允许修改代码和必要测试；默认不执行 `git add` / `svn add`，只有用户在看到精确文件清单后明确授权时才可只纳管该清单。始终不自动 commit、push，不执行数据库写入、DDL 或数据修复。

## 共享协议

先遵循 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)：证据预填、只问阻塞问题、业务/权限/状态/接口/DB 冲突显式记录。

非交互/无人值守运行中，`needs-confirmation` 转为 `Blocked` 并保留 finding ID；不等待回复、不修改对应代码。任一 Critical/Important 因此未关闭时，整体不得进入 Submit Gate。

同时遵循：

- [../_shared/workflow-gates.md](../_shared/workflow-gates.md)：当前阶段是 Review Gate → Verification Gate。
- [../_shared/workflow-brief.md](../_shared/workflow-brief.md)：输入/输出使用 Workflow Brief 做索引，不用 Brief 代替原始 diff、源码或测试证据。
- [../_shared/workflow-chain.md](../_shared/workflow-chain.md)：finding ID、测试证据状态和后续动作以共享链路为准。

执行前按阶段渐进读取，不一次加载全部基础文件：

1. 首轮只读共享交互/门禁和当前阶段需要的 [../review-fix/SKILL.md](../review-fix/SKILL.md)、[../review-check/SKILL.md](../review-check/SKILL.md)，控制在 5 个文件内。
2. 只有生成任务包或审查输出时，才分别读取 [../review-fix/reference.md](../review-fix/reference.md)、[../review-check/reference.md](../review-check/reference.md) 的相关锚点，不加载无关模板章节。
3. 只有出现可修 findings 时，才读取 [../review-repair/SKILL.md](../review-repair/SKILL.md)；进入修复结果输出时再加载 [../review-repair/reference.md](../review-repair/reference.md) 的对应锚点。
4. Workflow Brief 和 finding 状态需要落地时再读取 brief/chain 的对应章节；已读取且未变化的规则不重复加载。

基础 skill 规则冲突时，安全和准确性边界优先，其次使用更新、更具体的规则；必须在最终输出说明冲突和采用口径。

## 模式

### standard（默认）

适合中等/复杂改动、跨文件改动、需要留审查证据包的任务：

```text
review-fix 任务包
→ review-check
→ review-repair
→ Verification Gate
→ 二次 review-check
```

### quick

只在用户明确选择，且改动范围小、单模块、证据齐全时使用：

```text
review-check 当前 diff
→ review-repair
→ Verification Gate
→ 二次 review-check
```

quick 只跳过任务包文件，不降低审查清单、修复门槛、验证要求或复审要求。发现跨模块、接口契约、权限、状态、事务、DB 或 Critical 时自动升级为 standard，并说明原因。

## 执行流程

### Step 0：入口与模式识别

`$entry` 可为 dev-doc、Workflow Brief、review-task、功能描述或“当前工作区”。未指定模式时使用 standard。

只在以下情况询问：

- 用户要求的模式会改变是否生成任务包。
- 当前工作区包含多批互不相关改动，无法安全确定 review 范围。
- 业务/API/权限/DB 语义会改变修复方向。

告诉用户：`检测到 review-loop <standard|quick> 模式；将审查、修复、验证并复审，不会提交代码或执行数据库写操作。`

### Step 1：证据与基线

先确定**变更文件所属工作副本**，不能只取当前目录向上的第一个或最外层 VCS 根：

1. 从用户指定路径、dev-doc / Workflow Brief、当前 diff/status 和实现模块确定本次范围内的候选变更文件。
2. 对每个候选文件，从文件所在目录逐级向上查找 `.svn` 或 `.git`（目录或 worktree 的 `.git` 文件）；最先遇到的控制标记就是该文件的 `VCS_OWNER`。
3. 按 `VCS_OWNER` 去重并分别读取 status/diff。monorepo 外层 Git 包含一个内层 SVN 工作副本时，内层文件以最近的 `.svn` 为准；外层 Git 的 `?? <整个内层目录>/` 只记录为嵌套仓库提示，不作为内层文件的 VCSGate 证据。
4. 同一任务确实跨多个工作副本时，逐个执行门禁并分别记录；任一范围内工作副本未通过，整体停止。无法把关键文件归属到具体工作副本时记录 `VCSOwnerUnknown`，不得猜用外层仓库。

在每个实际 `VCS_OWNER` 根读取：

- Git：`status --short`、`diff --name-status`、`diff --stat`、完整相关 diff。
- SVN：`svn status`、`svn diff --summarize`、完整相关 diff。
- dev-doc / Workflow Brief / review-task 指向的范围、约束、测试命令。
- 新增未跟踪文件内容；不能只审已跟踪 diff。

若范围内源码、测试、配置、OpenAPI 或正式 docs 在其实际 `VCS_OWNER` 中仍是 Git `??` / SVN `?`，记录 `VCSGateBlocked`。默认只列最小纳管清单，不代替用户执行 `git add` / `svn add`；用户看到精确清单后明确要求 AI 执行时，只允许纳管该清单，禁止 `git add .`，并立即重验 status/diff。普通临时文件或明确标记的 AI 工作流临时产物不属于实现范围时可排除，但必须写明依据。门禁仍未通过时可继续 Step 2-3 的证据包与第一次**只读审查**，但不得进入 Step 4-7 的修复、验证和修复后复审，不得输出 `Fixed / NoEvidenceIssue` 或 Review Gate 已通过；最终结论固定为 `Blocked / VCSGateBlocked`，列出 findings 与最小纳管清单，纳管后可携带原 finding ID 续跑，不要求从头重做已验证证据。

记录 `ReviewScopeType`：

- 有实际 diff/status/源码 → `ImplementationReview`。
- 只有方案文档、没有实现证据 → `PlanReview`；继续执行 Step 2-3 的一次只读方案审查，然后跳过修复、验证和二次代码复审，不得声称代码已审。

运行用户/文档指定的基线验证；没有命令时按项目类型选择最小的模块级构建或测试。读取测试注解/tag/profile、配置和 CI workflow，记录 `TestDependencyClass=Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown`。基线失败不自动终止审查，但必须保留失败证据，不能写 `Passed`；默认 `test/verify` 因真实 AI/SaaS 密钥或外部服务未配置而失败时属于测试架构/CI 契约问题，写 `TestEvidenceStatus=Failed` 并进入 finding，不得标为 `EnvironmentBlocked` 或用伪造密钥绕过。

### Step 2：standard 证据包阶段

standard 模式按 review-fix 第一阶段规则生成或更新：

```text
docs/review-fix/<日期>/<任务>-review-task.md
```

任务包必须写明实际 review 范围、diff/status、关键文件、需求约束、基线验证、`ReviewScopeType`、`TestDependencyClass`、`TestEvidenceStatus` 和回收格式。

quick 模式跳过文件生成，但在内存中建立等价的审查范围和证据索引。

### Step 3：第一次只读审查

按 review-check 完整清单审查需求一致性、业务正确性、边界异常、事务并发、安全、兼容性、性能、测试有效性和 VCS 完整性。

输出稳定 finding ID：`CR-n / IM-n / MI-n`。每条必须包含 File/Line、Problem、Evidence、Impact、Fix、Verify。

二次复审发现的新 finding 必须在对应级别延续首轮最大序号，例如首轮已有 `IM-1`、`IM-2`，复审新增项从 `IM-3` 开始；不得复用 ID 指代不同根因。

结果分支：

- `NoEvidenceIssue`：不进入修复，保留基线验证结果；对 `ImplementationReview`，只有验证为 `Passed` 时才可作为后续通行结论。验证为 `Failed / EnvironmentBlocked / NotRun / NotProvided` 时顶层结论改为 `Blocked`，下一步只能是补验证或修环境后重验。
- `InsufficientMaterial`：列出缺失材料并停止，不得进入修复。
- `Findings`：进入 Step 4。

若 Step 1 已标记 `VCSGateBlocked`，即使本步骤得到 `Findings` 也在输出 findings 后停止；不得进入 Step 4。若没有 findings，仍因 VCS 门禁输出 `Blocked`，不能输出 `NoEvidenceIssue`。

当 `ReviewScopeType: PlanReview` 时，本步骤只输出方案 findings 或 `NoEvidenceIssue`，随后停止：有方案 findings 时修复结论记为 `Blocked` 并说明“等待实现或方案调整”，无 findings 时记为 `NoEvidenceIssue`。不得进入 Step 4-7，也不得形成实现通过结论。只有连方案审查所需材料也不足时才使用 `InsufficientMaterial`。

### Step 4：finding 归一化与停机判断

按 review-repair 规则把 findings 分为：

- `accepted`：证据和期望行为明确，可直接修复。
- `needs-confirmation`：业务语义、状态、权限、接口契约、DB、数据修复或用户范围冲突。
- `rejected`：误报、无证据、纯风格或超范围。
- `deferred`：低收益 Minor 或超过批次上限。

存在 `needs-confirmation` 时暂停对应 finding，只问一个阻塞问题；不得猜着修。

数据库始终只读。DDL/数据修复只输出 DBA 申请材料，不执行，也不把相关 finding 标为 fixed。

### Step 5：直接修复

按 `CR → IM → MI` 顺序执行 accepted findings：

- 默认单轮最多 5 条 accepted findings、8 个文件、2 个修复循环。
- 只做关闭 finding 所需的最小改动和必要测试。
- 保留无关本地改动，不格式化或重构无关文件。
- 每条 finding 保留原 ID，并记录 `fixed / blocked / rejected / deferred-next-batch`。

如果修复范围超限，先完成 Critical/Important，将其余标为 `deferred-next-batch`，不为“一键完成”扩大范围。

### Step 6：Verification Gate

修复后必须运行有针对性的验证。判定：

- `Passed`：测试/检查实际调用并断言目标逻辑。
- `Failed`：目标逻辑相关验证失败。
- `NotRun`：没有可用验证或未执行，写原因。
- `EnvironmentBlocked`：工具链、依赖下载或显式 LiveExternal 测试所需网络不可用，写命令、版本和失败摘要。

若默认 `test/verify` 混入 LiveExternal 并因 CI 未提供真实密钥/服务而失败，状态为 `Failed`，保留或新增 `Important` 测试架构/CI 契约 finding；修复应隔离 LiveExternal 后分别重跑，不得伪造密钥把启动检查骗过去。

Windows PowerShell 下调用 Maven Wrapper 时，将每个 `-Dkey=value` 作为完整参数引用；命令行参数被拆分时先修正命令，不算项目验证失败。读取 `target/surefire-reports`、JUnit XML 或覆盖率报告前，核对它们确由本轮运行产生；存在旧失败/已删除测试残留时，使用有针对性的 `clean` 验证或按时间戳过滤，不能把陈旧报告带进二次 review。

验证失败或 EnvironmentBlocked 时，不关闭依赖该验证的 Critical/Important，也不进入“全部完成”结论。`Failed / EnvironmentBlocked` 只属于验证状态：已经实施修复但未验证通过时，顶层修复结论使用 `PartiallyFixed`；尚未能实施修复时使用 `Blocked`。

### Step 7：二次只读复审

只要 Step 5 修改过代码，就必须重新读取最新 diff/status，并按 review-check 对以下范围复审：

- 原 findings 是否真正关闭。
- 修复是否引入新回归。
- 测试是否证明目标逻辑。
- 新增文件是否纳入 VCS 可见范围。

若出现新的 Critical/Important，且仍在第 1 个修复循环内，则回到 Step 4-6 再处理一次。达到 2 个循环仍未关闭时停止，输出 `PartiallyFixed`，不得继续无限循环。

### Step 8：最终 VCS 复查与输出

再次检查 status/diff，确认：

- 没有误改无关文件。
- 范围内关键源码、测试、配置、OpenAPI 和正式 docs 均已纳入 VCS；否则只能输出 `Blocked / VCSGateBlocked`，不得输出 `Fixed`。
- 新增源码/测试/配置未漏报。
- 没有敏感信息、临时 patch、凭证或调试产物。
- 没有未经授权执行 stage，也没有执行 commit/push；若用户明确授权过精确纳管，列出实际 staged/added 文件并确认没有扩大清单。

按 [reference.md](reference.md#完成输出格式) 输出闭环结果和 Workflow Brief。

## 不变量

- 单 AI 结果必须明确标注 `SingleAgentReview`，不得写成多 AI 交叉审查。
- `review-fix` 任务包是证据快照，不代表审查通过。
- `review-check` 阶段保持只读；只有进入 review-repair 阶段才能修改代码。
- 无实际实现证据时只做 `PlanReview`，不修代码。
- 没有 findings 时不制造修复动作。
- 不自动 stage、commit、push、merge、发布或执行数据库写入；用户明确授权精确纳管清单时只允许 stage/add 该清单，不视为自动提交授权。

## 检查清单

- [ ] 已识别 standard/quick 模式和 review 范围
- [ ] 已按变更文件最近的 `.git` / `.svn` 确定一个或多个 VCS_OWNER，并分别检查 status、diff 和未跟踪新增文件
- [ ] stage/add 默认为未执行；如用户明确授权，实际纳管文件与精确清单一致且已重验门禁
- [ ] 已区分 PlanReview / ImplementationReview
- [ ] standard 已生成 review-task；quick 已说明跳过原因
- [ ] 第一次审查 findings 有稳定 ID 和证据
- [ ] accepted/blocked/rejected/deferred 已分类
- [ ] 修复后验证实际证明目标逻辑
- [ ] 测试报告属于本轮运行；PowerShell Maven `-D` 参数按完整参数传递
- [ ] 修改代码后已执行二次 review-check
- [ ] 最多 2 个修复循环，未无限重试
- [ ] 最终输出标明 SingleAgentReview、未关闭 findings 和 VCS 状态

## 相关资源

- 输出模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 任务包与修复交接：`review-fix`
- 只读审查：`review-check`
- findings 直接修复：`review-repair`
