---
name: review-loop
description: 用一个 AI 把当前实现的一轮代码审查、修复、验证和复审闭环一次跑完。小范围单模块改动默认 quick，直接执行 review-check、必要的 review-repair、目标验证和二次复审；需要审计任务包、多 AI 分发或存在契约/权限/状态/事务/DB/跨模块高风险时使用 standard。未跟踪文件必须纳入审查，可继续修复和验证，但在纳管前不得宣称 Review 通过，并且不进入 Submit Gate。用户说“一键 review 并修复”“一个 AI 把这批 review skill 全跑完”“审查当前改动直到没有 Critical/Important”时必须使用；最多 2 个修复循环，仍有 Critical/Important、验证失败或环境阻塞时保留未关闭项并停止。只想看问题不改代码用 review-check；已有明确 findings 只需修复用 review-repair；要分发给多个 AI 审查或只生成任务包用 review-fix。
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

一次运行允许修改代码和必要测试。启动时先按“VCS 纳管策略”确定 `VcsAddPolicy`：宿主仓库规则明确要求新建业务文件必须纳管时采用 `host-required`，否则采用 `user-authorize-only`。任何 add 前都先声明规则来源、冲突采用口径和精确文件清单；始终不自动 commit、push，不执行数据库写入、DDL 或数据修复。

## 共享协议

先遵循 [../../../_shared/interaction-policy.md](../../../_shared/interaction-policy.md)：证据预填、只问阻塞问题、业务/权限/状态/接口/DB 冲突显式记录。

非交互/无人值守运行中，`needs-confirmation` 转为 `Blocked` 并保留 finding ID；不等待回复、不修改对应代码。任一 Critical/Important 因此未关闭时，整体不得进入 Submit Gate。

同时遵循：

- [../../../_shared/workflow-gates.md](../../../_shared/workflow-gates.md)：当前阶段是 Review Gate → Verification Gate。
- [../../../_shared/workflow-brief.md](../../../_shared/workflow-brief.md)：输入/输出使用 Workflow Brief 做索引，不用 Brief 代替原始 diff、源码或测试证据。
- [../../../_shared/workflow-chain.md](../../../_shared/workflow-chain.md)：finding ID、测试证据状态和后续动作以共享链路为准。

执行前按阶段渐进读取，不一次加载全部基础文件：

1. 首轮只读共享交互/门禁和当前阶段需要的 [../package/mode.md](../package/mode.md)、[../check/mode.md](../check/mode.md)，控制在 5 个文件内。
2. 只有生成任务包或审查输出时，才分别读取 [../package/reference.md](../package/reference.md)、[../check/reference.md](../check/reference.md) 的相关锚点，不加载无关模板章节。
3. 只有出现可修 findings 时，才读取 [../repair/mode.md](../repair/mode.md)；进入修复结果输出时再加载 [../repair/reference.md](../repair/reference.md) 的对应锚点。
4. Workflow Brief 和 finding 状态需要落地时再读取 brief/chain 的对应章节；已读取且未变化的规则不重复加载。

基础 skill 规则冲突时，安全和准确性边界优先，其次使用更新、更具体的规则；必须在最终输出说明冲突和采用口径。

### VCS 纳管策略

在 Step 0 读取当前作用域内宿主已提供的仓库规则（如项目级 `AGENTS.md` / `CLAUDE.md`）并确定：

- `VcsAddPolicy: host-required`：最近且优先级最高的适用仓库规则明确要求“新建业务文件必须 VCS add”。该宿主规则视为本次纳管授权，不再追加一次业务确认；但执行前必须先向用户输出 `VcsAddPolicySource`、`PolicyConflict`、采用口径和逐文件最小清单，并仍遵循宿主工具自身的审批机制。只允许 add 本次 review 范围内已核实的新业务源码、测试、配置、OpenAPI 或正式文档。
- `VcsAddPolicy: user-authorize-only`：没有上述明确宿主规则时使用 review-loop 默认口径。只列清单；用户看到精确清单并明确授权后才能 add。非交互运行直接 `Blocked / VCSGateBlocked`。

若宿主强制纳管与 review-loop 默认不 add 冲突，必须在第一次 VCS 操作前写明 `PolicyConflict: review-loop-default-no-add -> host-required` 和采用宿主规则的原因，不能执行后才解释。无法读取规则来源、无法确定优先级或无法得到逐文件清单时，不得猜测为 `host-required`。两种策略都禁止 `git add .`、目录级兜底、顺带纳管无关文件，也不授权 commit/push。

### 宿主隔离与旧任务包证据兼容

`review-loop` 的正式依赖是当前安装包内的 sibling `review-fix`，不是 `review-form`。只能读取当前已调用 skill 的相对资源或当前宿主明确暴露的资源；不得因为运行在 Cursor/Codex 就按产品名探测其他宿主的用户级 skill 目录，也不得把 `review-form` 缺失当作必须切换到 Claude Code。

Step 2 的正式任务包路径始终是 `docs/review-fix/<日期>/<任务>-review-task.md`，并按 sibling `review-fix` 第一阶段结构生成或更新。不得新建 `docs/review-form` 任务包，不得把工作区残留的 `docs/review-form/` 当作默认输出目录，也不得在 sibling `review-fix` 不可读时自动扫描 `docs/review-form` 寻找兜底模板。

只有用户显式提供可读的 `docs/review-form/*-review-task.md` 时，才可把它作为旧版 review-task 输入证据。使用前必须核对它能承载 review 范围、status/diff、需求约束、测试证据、审查轴和 finding 回收格式；合格后把必要证据迁移/归并到新的 `docs/review-fix/<日期>/<任务>-review-task.md`，缺字段按本 skill 当前规则补齐。输出 `ReviewTaskTemplateSource: review-fix`、`LegacyReviewTaskInput: docs/review-form/...` 和 `CompatibilityFlags: legacy-review-form-input`；它只表示读取了历史任务包证据，不表示 `review-form` skill 已安装或执行。

若 sibling `review-fix` 确实不可读，输出 `Blocked / review-fix-sibling-missing`，不要跨宿主继续找路径，也不要降级到 `docs/review-form` 生成任务包。

## 模式

### standard

适合中等/复杂改动、跨文件改动、需要留审查证据包的任务：

```text
review-fix 任务包
→ review-check
→ review-repair
→ Verification Gate
→ 二次 review-check
```

### quick（小范围实现默认）

用户未指定模式时，若改动属于单一模块、范围可由 status/diff 明确圈定、不超过 8 个实现/测试文件，且不涉及接口契约、权限、状态机、事务、DB、跨模块发布或 Critical 风险，默认使用 quick：

```text
review-check 当前 diff
→ review-repair
→ Verification Gate
→ 二次 review-check
```

quick 只跳过任务包文件，不降低审查清单、修复门槛、验证要求或复审要求。用户明确要求审计留档、生成 review-task、多 AI 分发，或发现跨模块、接口契约、权限、状态、事务、DB、Critical 风险时使用/升级为 standard，并说明原因。

## 执行流程

### Step 0：入口与模式识别

`$entry` 可为 dev-doc、Workflow Brief、review-task（旧版 `docs/review-form/*-review-task.md` 仅限用户显式提供）、功能描述或“当前工作区”。未指定模式时按“模式”一节自动选择；满足小范围条件时使用 quick，否则使用 standard。不得仅因 review-loop 能生成任务包就默认 standard。

只在以下情况询问：

- 用户要求的模式会改变是否生成任务包。
- 当前工作区包含多批互不相关改动，无法安全确定 review 范围。
- 业务/API/权限/DB 语义会改变修复方向。

告诉用户：`检测到 review-loop <standard|quick> 模式；将审查、修复、验证并复审，不会提交代码或执行数据库写操作。`

同时在首次状态更新声明：`VcsAddPolicy`、`VcsAddPolicySource` 和 `PolicyConflict`；若当前还没有新增文件，仍先声明策略，后续出现新增文件时沿用并在 add 前给出精确清单。

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

Windows + Java/SVN 工作区额外执行一次真实文件系统探测：对 `src/test/java`、`src/integration-test/java`、`src/test/resources` 等测试源根使用 walk/rglob 枚举 `*Test.java`、`*Tests.java`、`*IT.java` 和异常目录名，不能只按 Java 包名把 `.` 拼成路径。若同时存在字面目录名如 `eam.test` 与正常包路径 `eam/test`，或 `dir`/Glob 列表与 Maven/javac 报错路径不一致，记录 `WindowsTestSourcePathMismatch`，把真实文件路径、VCS_OWNER、SVN/Git status 和 Maven `testCompile` 报错路径放入证据；普通路径 API 读不到但 Maven 仍编译的文件，不得因为“读取失败”从范围中排除。

若范围内源码、测试、配置、OpenAPI 或正式 docs 在其实际 `VCS_OWNER` 中仍是 Git `??` / SVN `?`，记录 `VCSGateBlocked` 并输出逐文件最小纳管清单。`host-required` 在执行前声明策略来源、冲突采用口径和清单后，只纳管清单中的本次新建业务文件；`user-authorize-only` 必须等待用户看到清单并明确授权。两者都禁止 `git add .` 和目录级兜底，执行后立即重验 status/diff。普通临时文件或明确标记的 AI 工作流临时产物不属于实现范围时可排除，但必须写明依据。

未纳管不等于不可读取或不可验证。只要文件内容可读、范围归属明确，`VCSGateBlocked` 不阻止 Step 2-7 的审查、accepted finding 修复、目标验证和二次复审；所有 status/diff 收集都必须显式合并未跟踪文件内容，避免只审 tracked diff。它只阻止输出 Review Gate 已通过、`Fixed` 或进入 Submit Gate。最终顶层结论保持 `Blocked / VCSGateBlocked`，同时逐条报告已完成的修复与验证状态；纳管后只需重验 VCS status/diff 与受其影响的结论，不要求重做已经有证据的测试和复审。

SVN 纳管失败且 `svn status` 出现树冲突、父目录 `D`（schedule delete）并夹带本次新增 `?` 子文件时，先输出 `SVNTreeConflictAddRecovery`，把“恢复删除调度”和“纳管精确子文件”拆开处理；不得用 `svn add <父目录>` 或 `svn add .` 兜底。推荐命令模板按实际路径替换：

```bash
svn status <父目录或冲突路径>
svn resolve --accept working <冲突路径>
svn revert --depth empty <被标记为 D 的父目录>
svn add --parents <本次范围内的精确新增文件1> <本次范围内的精确新增文件2>
svn status <父目录或精确新增文件>
```

若 `D` 状态下还有非本次范围的未跟踪子文件，必须把它们列为 `ExcludedUntracked` 并说明不纳管；只有清单内文件可进入 `svn add --parents`。如果 `svn revert --depth empty` 后仍有子项删除调度或冲突，停止为 `Blocked / VCSGateBlocked`，输出剩余 `svn status`，不得扩大到递归 revert 或目录级 add，除非用户基于逐项清单明确授权。

记录 `ReviewScopeType`：

- 有实际 diff/status/源码 → `ImplementationReview`。
- 只有方案文档、没有实现证据 → `PlanReview`；继续执行 Step 2-3 的一次只读方案审查，然后跳过修复、验证和二次代码复审，不得声称代码已审。

运行用户/文档指定的基线验证；没有命令时按项目类型选择最小的模块级构建或测试。读取测试注解/tag/profile、配置和 CI workflow，记录 `TestDependencyClass=Hermetic / ServiceBacked / LiveExternal / Mixed / Unknown`。基线失败不自动终止审查，但必须保留失败证据，不能写 `Passed`；默认 `test/verify` 因真实 AI/SaaS 密钥或外部服务未配置而失败时属于测试架构/CI 契约问题，写 `TestEvidenceStatus=Failed` 并进入 finding，不得标为 `EnvironmentBlocked` 或用伪造密钥绕过。

### Step 2：standard 证据包阶段

standard 模式按 review-fix 第一阶段规则生成或更新：

```text
docs/review-fix/<日期>/<任务>-review-task.md
```

若 Step 0 命中用户显式提供且合格的旧版 review-task，按“宿主隔离与旧任务包证据兼容”把旧证据迁移/归并到上述 `docs/review-fix` 任务包；不调用不存在的 `review-form` skill，不把 `docs/review-form` 作为新任务包路径，也不改变后续 review-check / review-repair / verification 流程。

任务包必须写明实际 review 范围、diff/status、关键文件、需求约束、基线验证、`ReviewScopeType`、`TestDependencyClass`、`TestEvidenceStatus` 和回收格式。

quick 模式跳过文件生成，但在内存中建立等价的审查范围和证据索引。

### Step 3：第一次只读审查

按 review-check 完整清单审查需求一致性、业务正确性、边界异常、事务并发、安全、兼容性、性能、测试有效性和 VCS 完整性。

对跨调用共享的可变状态、请求级降级标记、缓存副本、重试开关和懒初始化对象，必须显式检查线程安全与原子性；只要并发会改变“本请求停止访问/下一请求重试/只执行一次”等承诺，就不得在没有并发证据或针对性测试时输出 `NoEvidenceIssue`。

输出稳定 finding ID：`CR-n / IM-n / MI-n`。每条必须包含 File/Line、Problem、Evidence、Impact、Fix、Verify。

二次复审发现的新 finding 必须在对应级别延续首轮最大序号，例如首轮已有 `IM-1`、`IM-2`，复审新增项从 `IM-3` 开始；不得复用 ID 指代不同根因。

结果分支：

- `NoEvidenceIssue`：不进入修复，保留基线验证结果；对 `ImplementationReview`，只有验证为 `Passed` 时才可作为后续通行结论。验证为 `Failed / EnvironmentBlocked / NotRun / NotProvided` 时顶层结论改为 `Blocked`，下一步只能是补验证或修环境后重验。
- `InsufficientMaterial`：列出缺失材料并停止，不得进入修复。
- `Findings`：进入 Step 4。

若 Step 1 已标记 `VCSGateBlocked`，仍按正常分支处理 findings、修复、验证和复审；但即使没有 findings，最终也只能输出 `Blocked / VCSGateBlocked`，不能把 `NoEvidenceIssue` 提升为 Review Gate 通过或 Submit Gate 通行结论。

当 `ReviewScopeType: PlanReview` 时，本步骤只输出方案 findings 或 `NoEvidenceIssue`，随后停止：有方案 findings 时修复结论记为 `Blocked` 并说明“等待实现或方案调整”，无 findings 时记为 `NoEvidenceIssue`。不得进入 Step 4-7，也不得形成实现通过结论。只有连方案审查所需材料也不足时才使用 `InsufficientMaterial`。

### Step 4：finding 归一化与停机判断

按 review-repair 规则把 findings 分为：

- `accepted`：证据和期望行为明确，可直接修复。
- `needs-confirmation`：业务语义、状态、权限、接口契约、DB、数据修复或用户范围冲突。
- `rejected`：误报、无证据、纯风格或超范围。
- `deferred`：低收益 Minor，当前不处理且不承诺进入下一批。
- `deferred-next-batch`：证据充分，但超过批次上限或属于另一个模块/根因，明确排入下一批。

存在 `needs-confirmation` 时暂停对应 finding，只问一个阻塞问题；不得猜着修。

数据库始终只读。DDL/数据修复只输出 DBA 申请材料，不执行，也不把相关 finding 标为 fixed。

### Step 5：直接修复

按 `CR → IM → MI` 顺序执行 accepted findings：

- 默认单轮最多 5 条 accepted findings、8 个文件、2 个修复循环。
- 只做关闭 finding 所需的最小改动和必要测试。
- 保留无关本地改动，不格式化或重构无关文件。
- 每条 finding 保留原 ID，并记录 `fixed / deferred / deferred-next-batch / blocked / rejected`。

如果修复范围超限，先完成 Critical/Important，将其余标为 `deferred-next-batch`，不为“一键完成”扩大范围。

### Step 6：Verification Gate

修复后必须运行有针对性的验证。判定：

- `Passed`：测试/检查实际调用并断言目标逻辑。
- `Failed`：目标逻辑相关验证失败。
- `NotRun`：没有可用验证或未执行，写原因。
- `EnvironmentBlocked`：工具链、依赖下载或显式 LiveExternal 测试所需网络不可用，写命令、版本和失败摘要。

主验证命令出现工具链版本不匹配时，不要立刻判定环境缺失。先做只读 `ToolchainRecovery`：核对项目文档/Wrapper/工具链配置、`JAVA_HOME` 与实际版本；Windows 再检查 `Get-Command java`、`where.exe java`、`~/.jdks`，Unix 类系统检查 `command -v java`、SDKMAN 与常见 JDK 目录。若发现满足项目版本的本机工具链，只为本轮命令临时设置 `JAVA_HOME/PATH` 后重跑，不修改项目或用户级配置。只有确认没有兼容工具链或兼容工具链本身不可用，才能写 `EnvironmentBlocked`。

完成 `ToolchainRecovery` 后主验证仍受工具链或环境限制时，不要在第一次失败后停止探索。保持主结论为 `EnvironmentBlocked`，再寻找不会掩盖风险的低层级证据，例如更窄的模块/测试选择、项目已支持的 profile/property、编译无关的静态检查或独立测试夹具。降级验证通过只能记录为 `FallbackValidation=Passed` 和已覆盖范围，不能冒充项目要求的正式环境已通过；若替代参数会改变生产语义、跳过目标代码或需要伪造凭据，则不得使用。

若默认 `test/verify` 混入 LiveExternal 并因 CI 未提供真实密钥/服务而失败，状态为 `Failed`，保留或新增 `Important` 测试架构/CI 契约 finding；修复应隔离 LiveExternal 后分别重跑，不得伪造密钥把启动检查骗过去。

Windows PowerShell 下调用 Maven Wrapper 时，将每个 `-Dkey=value` 作为完整参数引用；命令行参数被拆分时先修正命令，不算项目验证失败。读取 `target/surefire-reports`、JUnit XML 或覆盖率报告前，核对它们确由本轮运行产生；存在旧失败/已删除测试残留时，使用有针对性的 `clean` 验证或按时间戳过滤，不能把陈旧报告带进二次 review。

Windows 下 Maven `testCompile` / `test` 失败且 javac 报错路径包含非常规片段（例如字面目录 `eam.test`、大小写异常、重复包段、路径分隔符混用）时，先用文件系统 walk/rglob 复核测试源列表，再判断失败归因。排查步骤必须写明：测试源根、枚举到的真实文件路径、对应 VCS_OWNER/status、javac/Maven 报错路径、两者是否同一文件。若发现幽灵测试源或错误目录，修复或排除该源后重跑 `testCompile`；不能只按期望包路径读取文件后得出“文件不存在/非本次范围”的结论。

验证失败或 EnvironmentBlocked 时，不关闭依赖该验证的 Critical/Important，也不进入“全部完成”结论。`Failed / EnvironmentBlocked` 只属于验证状态：已经实施修复但未验证通过时，顶层修复结论使用 `PartiallyFixed`；尚未能实施修复时使用 `Blocked`。

### Step 7：二次只读复审

只要 Step 5 修改过代码，就必须重新读取最新 diff/status，并按 review-check 对以下范围复审：

- 原 findings 是否真正关闭。
- 修复是否引入新回归。
- 测试是否证明目标逻辑。
- 新增文件是否纳入 VCS 可见范围。

若出现新的 Critical/Important，且仍在第 1 个修复循环内，则回到 Step 4-6 再处理一次。达到 2 个循环仍未关闭时停止，输出 `PartiallyFixed`，不得继续无限循环。

若 Step 5 没有修改代码，不重复执行一遍相同的只读审查；记录 `Recheck: NotRequiredNoCodeChange`。不得把它表述为“二次复审已执行”。

### Step 8：最终 VCS 复查与输出

再次检查 status/diff，确认：

- 没有误改无关文件。
- 范围内关键源码、测试、配置、OpenAPI 和正式 docs 均已纳入 VCS；否则只能输出 `Blocked / VCSGateBlocked`，不得输出 `Fixed`。
- 新增源码/测试/配置未漏报。
- 没有敏感信息、临时 patch、凭证或调试产物。
- 没有未经授权执行 stage，也没有执行 commit/push；若用户明确授权过精确纳管，列出实际 staged/added 文件并确认没有扩大清单。
- 已输出 `VcsAddPolicy`、规则来源和冲突采用口径；`host-required` 已在 add 前公开精确清单，`user-authorize-only` 已保留用户授权证据。

按 [reference.md](reference.md#完成输出格式) 输出闭环结果和 Workflow Brief。无论 standard/quick，都必须在最终答复给出精简 `ReviewReceipt`：列出本轮实际读取的范围文件（含未跟踪文件）、首审结果、处理 finding、验证命令/结果，以及 `PerformedAfterRepair` 或 `NotRequiredNoCodeChange` 的复审状态。quick 不为此新建 review-task 或其他审查文档。

## 不变量

- 单 AI 结果必须明确标注 `SingleAgentReview`，不得写成多 AI 交叉审查。
- `review-fix` 任务包是证据快照，不代表审查通过。
- `review-check` 阶段保持只读；只有进入 review-repair 阶段才能修改代码。
- 无实际实现证据时只做 `PlanReview`，不修代码。
- 没有 findings 时不制造修复动作。
- 不自动 commit、push、merge、发布或执行数据库写入。stage/add 只按已声明的 `VcsAddPolicy` 执行精确清单：`host-required` 以明确宿主规则为授权，`user-authorize-only` 以用户本轮授权为准；均不视为提交授权。

## 检查清单

- [ ] 已识别 standard/quick 模式和 review 范围
- [ ] 已按变更文件最近的 `.git` / `.svn` 确定一个或多个 VCS_OWNER，并分别检查 status、diff 和未跟踪新增文件
- [ ] 已在首次状态更新声明 VcsAddPolicy / VcsAddPolicySource / PolicyConflict；任何 add 前已公开精确清单
- [ ] stage/add 符合所选策略；host-required 有明确宿主规则，user-authorize-only 有用户本轮授权；实际纳管与清单一致且已重验门禁
- [ ] 已区分 PlanReview / ImplementationReview
- [ ] 已按范围自动选择 quick/standard；standard 已生成 review-task，quick 已说明跳过原因
- [ ] 已记录 ReviewTaskTemplateSource / LegacyReviewTaskInput / CompatibilityFlags；未跨宿主探测 skill 路径，旧版 `docs/review-form` 仅在用户显式提供时作为校验后的输入证据，新任务包仍写入 `docs/review-fix`
- [ ] 第一次审查 findings 有稳定 ID 和证据
- [ ] accepted/blocked/rejected/deferred 已分类
- [ ] 修复后验证实际证明目标逻辑
- [ ] 工具链版本不匹配时先完成 ToolchainRecovery，再决定 EnvironmentBlocked 或 fallback
- [ ] 测试报告属于本轮运行；PowerShell Maven `-D` 参数按完整参数传递
- [ ] Windows Java 验证已用 walk/rglob 复核 testCompile 测试源列表；异常目录名或 javac 路径不一致已显式记录
- [ ] 修改代码后已执行二次 review-check
- [ ] 最终答复包含可核对的 ReviewReceipt；未修改代码时复审准确记为 NotRequiredNoCodeChange
- [ ] 最多 2 个修复循环，未无限重试
- [ ] 最终输出标明 SingleAgentReview、未关闭 findings 和 VCS 状态

## 相关资源

- 输出模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 任务包与修复交接：`review-fix`
- 只读审查：`review-check`
- findings 直接修复：`review-repair`
