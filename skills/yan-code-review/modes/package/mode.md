---
name: review-fix
description: 生成可分发给多个 AI 的统一代码审查任务包、证据包和 review 提示，或汇总 findings 形成修复交接；仅在收到 review 结果后生成 fix-handoff。由 yan-code-review 根入口的 package mode 加载。
---

# Review 清单生成与修复交接

## 任务定位

默认目标：**先给出一份可以交给其他 AI 的 Code Review 任务包**，让 Codex / Cursor / Claude 等 AI 按同一标准去审查。

任务包包含：
1. 审查上下文：需求文档、代码地图、diff/patch、关键源码、测试命令。
2. 审查清单：正确性、边界、事务、并发、安全、性能、兼容性、测试覆盖等检查点。
3. 分发提示：分别给 Codex / Cursor / Claude 的可复制 review prompt。
4. 回收格式：要求其他 AI 用结构化 findings 返回，便于后续汇总。

第二阶段才做：当用户贴回其他 AI 的 review 结果，或明确说"汇总/生成修复文档/生成修复操作码"时，再去重分级，生成 `docs/review-fix/<日期>/<任务名>-fix-handoff.md` 和 AI 修复操作码。

与相邻 skill 的分工：
- `yan-project-analysis mode=understanding`：只生成代码地图，不判断问题。
- `yan-code-review mode=check`：根据本 mode 生成的任务包执行一次只读审查，输出可回收 findings。
- `yan-code-review mode=repair`：根据 findings 或 fix-handoff 直接修改代码并验证。
- `yan-code-review mode=loop`：同一 AI 编排审查、修复、验证和复审。
- `superpowers:requesting-code-review`（或宿主显示的同名 code review 入口）：可作为额外 review 来源，但本仓库主路径是 `yan-code-review mode=package` 任务包 + `mode=check` findings 回收；有效问题必须归并为 `CR/IM/MI`，误报写 `RJ`，待确认写 `BK`，不能直接替代本 mode 的 finding ID 链路。
- `yan-code-review mode=package`：先生成 review 任务包；可选地汇总 review 结果并交接修复。
- `yan-project-analysis mode=incident`：面向线上/测试 Bug 的现象、根因、修复记录。

### 共享工作流门禁

遵循 [../../../_shared/workflow-gates.md](../../../_shared/workflow-gates.md)：本 skill 第一阶段进入 Review Gate，第二阶段输出修复交接并回到 Verification Gate。只有 yan-dev-doc/bug/biz-flow 文档但没有实际 diff、patch、VCS status 或变更文件时，只能生成方案审查任务，不能宣称审过实现代码。

若输入包含 `【Workflow Brief】`，同时遵循 [../../../_shared/workflow-brief.md](../../../_shared/workflow-brief.md)：先按 Brief 的 `source` / `artifacts` / `changed` / `tokenHint` 定位 yan-dev-doc 与变更文件，再收集证据包，不要求用户重新粘贴完整 yan-dev-doc 或 diff。Brief 里的 `changed` 只是读取索引，任务包证据仍需回到实际 diff/status 核实。

## 执行流程

### 共享交互协议

先遵循 [../../../_shared/interaction-policy.md](../../../_shared/interaction-policy.md)：证据包不足时先补材料，不把缺证据包装成审查结论；发现需求/实现/状态机/权限/数据归属冲突时写入任务包的阻塞项。

非交互/无人值守运行中不等待提问：入口、实现证据或文件冲突缺失时输出 `Blocked`/`InsufficientMaterial` 和最小补充项，不生成或覆盖 review-task/fix-handoff。

### Step 0：入口检测

`$entry` 为空时询问：

> "这次要基于什么生成 review 清单？可以给 yan-dev-doc 路径、patch/diff 路径、code-reading 路径，或一句功能描述。"

入口模式：
- 文本含 `【Workflow Brief】` → **轻量交接模式**：先读 Brief 的 `source` / `artifacts` / `changed` / `tokenHint`，据此定位 yan-dev-doc 和变更文件，再按 Brief 指向的源类型（yan-dev-doc/bug/patch）继续收集证据，不要求粘贴全文
- 含 `.patch` / `.diff` 或路径名含 `changes.patch` → **patch 模式**
- 含 `docs/bugs/` → **Bug 修复文档模式**；证据包必须包含复现/根因/验证结果和实际 diff/status
- 含 `docs/biz-flow/` → **业务流文档模式**；证据包必须包含测试口径、状态/数据流证据和实际 diff/status；否则只审业务口径，不审实现
- 含 `.md` 且路径在 `docs/` 下 → **文档模式**
- 其他自然语言 → **上下文模式**

告知用户："检测到入口模式：[模式名]，开始整理 review 任务包。"

### Step 1：静默收集上下文

执行以下命令，结果仅用于生成 review 任务包，不展示给用户：

1. 运行 `node <helper> detect-vcs`，读取返回的 `type` 与 `root`。
2. Git：以 `root` 为工作目录读取当前分支、`status --short`、`diff --name-status` 和实际 diff；SVN：读取 info/revision、status、diff summarize 和实际 diff；无 VCS 时记录 `VCS_TYPE=none`。
3. 使用当前宿主的目录枚举/搜索能力，在 VCS root 下最多 3 层查找 `pom.xml`、`build.gradle`、`package.json`，不要依赖 POSIX `find`。

判断规则：初始 root 只用于发现；最终必须按 workflow-gates 的“VCS 证据归属”对候选变更文件逐个确定最近的 `VCS_OWNER` 并分组取证。命令失败保留退出码/错误摘要并写 `VCSStatusUnknown`，不能把空输出当 clean。Git 项目同时看 status、name-status 和实际 diff；SVN 项目同时看 status、summarize 和实际 diff。

判定 `ReviewScopeType`、`TestDependencyClass` 和 `TestEvidenceStatus`：
- 有实际 diff/patch、VCS status 中的源码/测试/配置改动，或已读取到明确 changed 文件 → `ReviewScopeType=ImplementationReview`。
- 只有 yan-dev-doc / bug-fix / biz-flow / 需求描述，没有实现证据 → `ReviewScopeType=PlanReview`，任务包必须写明未审实现代码。
- 第二阶段汇总 findings / 生成修复交接 → `ReviewScopeType=FixHandoffReview`。
- 读取测试注解/tag/profile、配置和 CI workflow，将验证命令分类为 `Hermetic / ServiceBacked / LiveExternal / Mixed`；材料不足时写 `TestDependencyClass=Unknown`，不得按错误文本猜测。
- 测试命令有通过结果且测试断言目标逻辑 → `TestEvidenceStatus=Passed`；测试失败 → `Failed`；材料未提供测试 → `NotProvided`；明确未执行且有原因 → `NotRun`；工具链不满足 → `EnvironmentBlocked`；纯方案阶段无测试 → `NotApplicable`。
- 默认 `test/verify` 混入真实 AI/SaaS 调用并因 CI 未提供密钥而失败时，写 `TestDependencyClass=Mixed` 或 `LiveExternal`、`TestEvidenceStatus=Failed`，并要求 reviewer 检查测试架构/CI 契约；不得降级为普通环境阻塞，也不得用伪造密钥绕过。

按入口读取：
- 文档模式：Read `$entry`，提取需求目标、范围、代码变更清单、测试要点；尝试读取同日期/同任务的 `docs/code-reading/` 文档。
- patch 模式：Read patch/diff 文件，提取文件列表、变更类型、关键 hunks。
- 上下文模式：用 Grep/Glob 查找候选入口；至少要拿到 diff/patch，或 yan-dev-doc + 关键源码/入口，或当前工作区变更摘要 + 关键文件。材料不足时只问一个聚焦问题让用户补 yan-dev-doc、patch/diff 或入口，不生成任务包。

最低证据门槛：
- patch 模式：必须能读到 patch/diff 或当前工作区 diff。
- 文档模式：必须能读到 yan-dev-doc，并提取到目标/范围或代码变更清单；缺关键源码时在证据包标为待补充。
- 上下文模式：必须能定位至少一个入口或当前变更文件；否则停止并要求补材料。

### Step 2：生成 Review 任务包

加载模板：[reference.md](reference.md#review-任务包模板)

产出一份文档，默认路径：

```text
node <_shared/scripts/workflow-fs.js absolute path> prepare-date-dir docs/review-fix
```

文件：`docs/review-fix/<日期>/<任务名>-review-task.md`

文档必须包含：
1. **审查目标**：这次 review 要确认什么。
   - 必须写 `ReviewScopeType`、`TestDependencyClass` 和 `TestEvidenceStatus`，并说明是否审实现代码。
2. **证据包**：其他 AI 需要读取/粘贴的文档、diff、源码、测试命令。
   - 必须包含 `assumptions`、`conflicts`、`blockers`、`openQuestions`：材料不足或语义冲突要直接暴露。
3. **统一审查清单**：按风险类别列出检查项。
4. **AI 分发提示**：Codex / Cursor / Claude 三份可复制 prompt。
5. **技能化审查入口**：提示安装了本仓库 skill 的 AI 使用 `yan-code-review mode=check` 审查任务包。
6. **回收格式**：要求其他 AI 按统一 JSON-like findings 返回。

冲突处理：把候选任务包路径赋给 `target` 后，运行 `node <helper> file-state <target>` 区分不存在、可读和 `EXISTS_UNREADABLE_OR_UNKNOWN`。可读且已存在时，交互会话选择 A 覆盖 / B 时间戳后缀 / C 取消；非交互或状态未知时标 blocker 并停止，不采用默认覆盖。

### Step 2.5：输出并停住

完成 Step 2 后输出：

```text
✅ Review 任务包已生成：docs/review-fix/<日期>/<任务名>-review-task.md

下一步：
1. 如果目标 AI 已安装本仓库 skill，直接让它运行：`使用 yan-code-review skill，mode=check，审查 docs/review-fix/<日期>/<任务名>-review-task.md`
2. 否则把任务包里的「Codex / Cursor / Claude 审查提示」分别交给对应 AI
3. 将它们返回的 findings 粘贴回来，再运行/继续 `yan-code-review mode=package` 汇总
```

**如果用户没有贴回 review 结果，到这里停止，不要生成修复文档，不要编造 findings。**

### Step 3：汇总 Review 结果（仅在用户贴回结果后执行）

触发条件：
- 用户贴回 Codex/Cursor/Claude 任一或多个 review 结果。
- 用户明确说："汇总 review"、"生成修复文档"、"生成修复操作码"。

加载模板：[reference.md](reference.md#汇总规则)

处理规则：
- 只接受有文件/方法/行为证据的问题；纯风格偏好默认降为 Minor 或 Rejected。
- 多个 AI 提到同一问题时合并，保留最清晰的证据和最高严重度。
- 按 `Critical / Important / Minor / Rejected` 分级。
- 每条 accepted finding 必须包含：问题、证据、影响、修复建议、验证方式。
- 对不修的问题写清拒绝原因：误报、无证据、超范围、收益低、与项目规范冲突。

### Step 4：生成修复交接文档（第二阶段）

路径：`docs/review-fix/<日期>/<任务名>-fix-handoff.md`

文档模板见：[reference.md](reference.md#修复交接模板)

### Step 4.5：登记到 HTML 看板（第二阶段）

仅在生成修复交接文档时登记看板。将 review-fix 文档作为普通文档条目登记，`type` 固定为 `"代码审查"`，`status` 固定为 `"草稿"`。

看板创建、升级、写入、构建流程与 `/yan-dev-doc` Step 5.5 / 5.6 相同：使用 `project-html/board-add.js` 写入，禁止手工重写 `data/changes.js`。

### Step 5：输出 AI 修复操作码（第二阶段）

加载模板：[reference.md](reference.md#ai-修复操作码模板)

操作码必须包含：
- 任务目标
- 输入文档路径
- 必修 / 可选 / 拒绝问题清单
- 修改边界
- 执行顺序
- 验证命令
- 完成后回填要求

## 规则

- **默认只生成 review 任务包**：没有其他 AI 的 findings 时，必须停在 Step 2.5。
- **不编造 review 结果**：不能自己假装 Codex/Cursor/Claude 已经审查。
- **只读数据库**：不得要求 AI 执行写库 SQL；涉及 DDL/数据修复只输出建议和 DBA 申请说明。
- **不吞拒绝项**：第二阶段不采纳的 review 意见必须写入 Rejected，说明理由。
- **不让 AI 自由发挥**：审查提示和修复操作码都必须限定材料、范围、输出格式和验证方式。
- **尊重现有改动**：提示中必须提醒不要回滚无关本地改动。
- **材料不足就停**：第一阶段不满足最低证据门槛时，只输出缺失材料清单和一个补充问题，不生成 review 任务包。
- **阻塞项不下发修复**：第二阶段若存在未确认的 blocker 或需求冲突，AI 修复操作码必须先要求确认，不得让下游 AI 猜着改。

## 检查清单

### 第一阶段：Review 任务包

- [ ] 已识别入口模式并收集 yan-dev-doc / patch / code-reading / diff 上下文
- [ ] 已满足最低证据门槛；材料不足时已停止并列出缺失材料
- [ ] 已生成证据包清单
- [ ] 已写入 assumptions / conflicts / blockers / openQuestions
- [ ] 已生成统一 review 清单
- [ ] 已生成 Codex / Cursor / Claude 审查提示
- [ ] 已提示可用 `yan-code-review mode=check` 执行审查
- [ ] 已写明 findings 回收格式
- [ ] 没有 review 结果时已停住，没有生成修复文档

### 第二阶段：修复交接

- [ ] 用户已贴回至少一个 AI review 结果
- [ ] findings 已分为 Critical / Important / Minor / Rejected
- [ ] 每条 accepted finding 有证据、影响、修复建议、验证方式
- [ ] 修复交接文档已写入 `docs/review-fix/<日期>/<任务名>-fix-handoff.md`
- [ ] AI 修复操作码已生成，且包含修改边界和验证命令
- [ ] 若存在 blocker 或需求冲突，操作码已要求先确认，不让 AI 直接修
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`，并已运行 `node project-html/build.js`

## 相关资源

- 详细模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 工作流背景：仓库 `docs/workflow-guide.md`
- 相邻 skill：`yan-dev-doc`、`yan-code-review mode=check/repair`、`yan-project-analysis mode=understanding/incident`
