# 工作流串联速查（单一权威）

本表是"当前 skill 完成后，下一步跑什么"的唯一权威来源。各 skill 的完成输出、`Workflow Brief` 的 `next` 字段、workflow-guide 的下一步提示都以本表为准，避免各处叙述漂移。改动串联关系时只改这里。

`superpowers-zh` 是推荐的外部方法论层，不进入本表的强制主链路。可在主链路前后插入，但它的输出必须回填到本仓库的门禁字段、`Workflow Brief` 或 finding ID 链路，不能形成第二套交付结论。

表中的 `superpowers:<skill>` 是能力名写法；真实入口以当前宿主安装后显示的命令、skill 名或自然语言触发方式为准。跨 Claude Code / Cursor / Codex 时不得硬编码某个宿主的斜杠命令。

## skill 一句话职责

| skill | 阶段 | 做什么 | 会改代码吗 |
|-------|------|--------|-----------|
| `dev-doc` | Plan Gate | 需求落成可执行开发文档 | 否 |
| `bug-fix` | Plan Gate | 记录 Bug 现象/根因/修复边界 | 否 |
| `biz-flow` | Plan Gate | 给测试的业务流/数据流/时序地图 | 否 |
| `review-fix` | Review Gate | 生成 review 任务包；回收 findings 后出修复交接 | 否 |
| `review-check` | Review Gate | 按清单执行一次只读审查，输出 findings | 否 |
| `review-repair` | Review Gate → Verification | 按 findings/fix-handoff 直接修复并验证 | 是 |
| `review-loop` | Review Gate → Verification | 单 AI 编排任务包、审查、修复、验证和二次复审 | 是 |
| `code-reading` | Understanding Gate | `CodeMap` 生成代码地图；`ImpactAnalysis` 在聊天中只读分析契约、调用链和兼容影响 | 否 |
| `conversation-handoff` | 任意阶段 | 把当前对话证据、状态和下一步压缩为跨对话移交文档 | 否 |

## 下一步映射（谁 → 下一步 + 可复制命令）

| 当前完成 | 默认下一步 | Claude Code | Codex |
|----------|-----------|-------------|-------|
| `dev-doc` | AI 实现 → VCS/验证 → 多 AI 用 `review-fix`，单 AI闭环用 `review-loop` | `/review-fix docs/<日期>/<任务>.md` 或 `/review-loop docs/<日期>/<任务>.md` | `使用 review-fix skill 基于 docs/<日期>/<任务>.md 生成 Review 任务包`，或 `使用 review-loop skill 基于该文档审查、修复、验证并复审当前工作区` |
| `bug-fix` | 确认根因后修复 → VCS/验证 → 多 AI 用 `review-fix`，单 AI闭环用 `review-loop` | `/review-fix docs/bugs/<日期>/<bug>.md` 或 `/review-loop docs/bugs/<日期>/<bug>.md` | `使用 review-fix skill 基于 docs/bugs/<日期>/<bug>.md 生成 Review 任务包`，或 `使用 review-loop skill 基于该文档审查、修复、验证并复审当前工作区` |
| `biz-flow` | 测试设计；或转 `dev-doc` 开发 | `/dev-doc <业务名>` | `使用 dev-doc skill 给 <业务名> 生成开发文档` |
| `review-fix`（任务包） | 多 AI 只读审查 | `/review-check docs/review-fix/<日期>/<任务>-review-task.md` | `使用 review-check skill 审查 docs/review-fix/<日期>/<任务>-review-task.md` |
| `review-check`（findings） | 贴回 `review-fix` 汇总，或交 `review-repair` 直修 | `/review-fix <粘贴 findings 并汇总>` 或 `/review-repair <粘贴 findings>` | `使用 review-fix skill 汇总这些 findings 并生成修复交接`，或 `使用 review-repair skill 根据这些 findings 直接修复` |
| `review-fix`（修复交接） | `review-repair` 直修，或人工按交接修 | `/review-repair docs/review-fix/<日期>/<任务>-fix-handoff.md` | `使用 review-repair skill 根据 fix-handoff 直接修复` |
| `review-repair`（修复完） | 验证通过 → `code-reading` → 人工 review；改动大则二次 `review-check` | `/code-reading docs/<日期>/<任务>.md` 或 `/review-check <当前修复 diff>` | `使用 code-reading skill 基于 docs/<日期>/<任务>.md 生成代码地图`，或 `使用 review-check skill 对当前修复 diff 执行二次只读审查` |
| `review-loop`（单 AI 闭环） | 无未关闭 CR/IM 且验证通过 → `code-reading` → 人工 review | `/code-reading docs/<日期>/<任务>.md` | `使用 code-reading skill 基于 docs/<日期>/<任务>.md 和当前实现生成代码地图` |
| `code-reading`（CodeMap） | 人工 review → 提交 | 人工 | 人工 |
| `code-reading`（ImpactAnalysis） | 需要实施方案 → `dev-doc`；需要缺陷判断 → `review-check`；否则人工确认影响结论 | `/dev-doc <任务>` 或 `/review-check <影响分析 + 当前证据>` | `使用 dev-doc skill 基于本影响分析生成开发方案`，或 `使用 review-check skill 基于本影响分析执行只读审查` |
| `conversation-handoff` | 新对话按移交文档中的 `Workflow Brief.next/nextCommand` 恢复原阶段，不强制跳到固定 Skill | `请先阅读 docs/handoffs/<日期>/<任务>-handoff.md，按“最小读取顺序”核对证据后执行 nextCommand` | `请先阅读 docs/handoffs/<日期>/<任务>-handoff.md，按“最小读取顺序”核对证据后执行 nextCommand` |

## superpowers-zh 插入点（可选增强）

| 插入点 | 推荐使用 | 回填到本仓库的证据 |
|--------|----------|-------------------|
| `dev-doc` 前，需求仍混沌 | `superpowers:brainstorming` | 把已确认范围、被否决方案、待确认项写入 `dev-doc` 的 blockers/conflicts/assumptions |
| 实现阶段，复杂逻辑或需要先写测试 | `superpowers:test-driven-development` | 回填 dev-doc Todo 对照表、changed 文件、验证命令和 TestDependencyClass |
| 实现阶段，问题定位不清 | `superpowers:systematic-debugging` | 若要沉淀问题，进入 `bug-fix`；否则把根因证据写入执行回填 |
| Review Gate 前 | `superpowers:verification-before-completion` | 回填 Verification Gate：命令、结果、TestEvidenceStatus、未验证风险 |
| 多视角 review | `superpowers:requesting-code-review` 或宿主同名 code review 入口 | 作为额外 reviewer 来源；有效问题必须归并为 `CR/IM/MI`，再进入 `review-fix` 或 `review-repair` |

边界：`superpowers-zh` 的 code review 结论不能直接关闭本仓库 Critical/Important finding；完成前验证也不能代替 Verification Gate，除非它记录了可复跑命令、退出结果和目标逻辑断言证据。

## Finding ID 命名体系（全链路统一）

review-check / review-fix / review-repair 共用同一套 ID 前缀，n 在各前缀内从 1 递增：

| 前缀 | 含义 | 谁产生 |
|------|------|--------|
| `CR-n` | Critical，必须修 | review-check 输出；review-fix 归并后沿用 |
| `IM-n` | Important，修完再继续 | 同上 |
| `MI-n` | Minor，建议处理不阻塞 | 同上 |
| `RJ-n` | Rejected，误报/无证据/超范围，不修但登记原因 | review-fix 汇总时标记 |
| `BK-n` | Blocker，需业务/DB/权限/接口确认后才能动 | 任一环节发现即标记，未解不进入修复 |

流转规则：review-check 首次分配 `CR/IM/MI`；review-fix 汇总多 AI 时**统一重编并在来源列保留各 AI 原始编号**，把拒绝项标 `RJ`、阻塞项标 `BK`；review-repair 按同一 ID 回填 `fixed / deferred / deferred-next-batch / blocked / rejected`，不得新起编号。`deferred` 表示低收益或当前不处理，且不承诺进入下一批；`deferred-next-batch` 表示证据充分，但因批次上限或模块边界明确排入下一批。

## 审查范围与测试证据状态（全链路统一）

`review-fix`、`review-check`、`review-repair`、`review-loop` 必须把审查范围和测试证据拆开写，避免“方案审查”被误传成“代码审查已通过”，也避免“命令跑过”被误传成“目标逻辑已验证”。

| 字段 | 谁输出 | 允许值 | 关闭条件 |
|------|--------|--------|----------|
| `ReviewScopeType` | `review-fix` / `review-check` | `PlanReview` / `ImplementationReview` / `FixHandoffReview` | 只有 `ImplementationReview` 或已定位 findings 的 `FixHandoffReview` 能支撑代码层结论；`PlanReview` 只能支撑方案结论 |
| `TestEvidenceStatus` | `review-fix` / `review-check` / `review-repair` | `Passed` / `Failed` / `NotProvided` / `NotRun` / `EnvironmentBlocked` / `NotApplicable` | 只有测试或检查实际调用并断言目标逻辑时才可写 `Passed`；环境阻塞必须写工具链版本 |

阶段约束：`review-fix`、`review-check` 和 `review-loop` 的材料收集/只读审查可使用完整六种状态；`review-repair` 或 `review-loop` 一旦修改代码，必须重新判定为 `Passed / Failed / NotRun / EnvironmentBlocked` 之一。修复后的输出不得沿用输入里的 `NotProvided` / `NotApplicable`；没有运行可证明目标逻辑的验证时写 `NotRun` 和原因。

`review-loop` 复用同一状态体系，并额外标记 `ReviewAgentMode: SingleAgentReview`；不得把单 AI 自审写成多 AI 独立交叉审查。

状态传递规则：
- 从 `review-fix` 任务包进入 `review-check` 时，保留 `ReviewScopeType` 和 `TestEvidenceStatus`，reviewer 可基于新读取的 diff/status/test 输出升级或降级。
- `review-check` 发现测试未调用目标方法、只断言 mock/临时目录/前置条件时，`TestEvidenceStatus` 必须降级为 `Failed` 或 `NotProvided`，并输出 finding。
- `review-repair` 修复后必须重新判定 `TestEvidenceStatus`；环境阻塞时不能关闭 Critical/Important，只能写 `blocked` 或等待重跑。
- `Workflow Brief` 的 `source` 可携带 `ReviewScopeType`，`tests` 必须携带测试证据摘要；需要完整判断时回到原始 review task、findings、diff 和测试输出。

## 交接时带什么（省 token）

- 默认只复制上一轮的 `【Workflow Brief】` + 产物路径 + finding ID，不粘贴完整 dev-doc / review-task / fix-handoff / 长 diff。
- 下一位 AI 直接复制 Brief 的 `nextCommand` 启动下一步，并按 `tokenHint` 读取：先读 Brief → `source`/`artifacts` → `changed` 文件 → 必要验证输出；首轮最多 5 个文件。
- 遇到业务语义、权限、状态流转、接口契约、DB 结构、数据修复或证据冲突，必须回到原始文件核对，不能只凭 Brief 推断。
- finding ID 全链路保留：`review-check` 输出 ID → 贴回 `review-fix` 保留 → `review-repair` 按 ID 修复并在结果里回填同一 ID，保证发现→修复→关闭一一对应。
- 接口链路全程保留 `api: spec=...; index=...; operationIds=...`；后续接口签名变化优先更新同一个 YAML 和索引，不重复生成失联副本。

## 停机点（不带病进入下一步）

- Plan Gate 有阻塞 `blockers` / `conflicts` → 只出待确认文档，不给可执行编码提示。
- 没有实际 diff/patch/status → `review-fix` / `review-check` 只能审方案，不能声称审过实现代码。
- 没有明确 findings / fix-handoff / 问题清单 → `review-repair` 不凭空修复，先建议 `review-check`。
- 验证失败 → 回到实现修复并重跑，不进入 Review。
- `review-check` 出 Critical / Important 且未关闭 → 不进入 Submit Gate。
- `review-loop` 最多自动修复 2 轮；仍有 Critical / Important、验证失败或环境阻塞时停止，不进入 Submit Gate。
- 需要 DDL / 数据修复 → 停止直接执行，只输出 DBA 申请材料。
