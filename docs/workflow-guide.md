# Java 后端 AI 开发工作流（Dev Workflow Skills）

> 目标：先定方案，再实现，再验证，再审查，再读代码，最后由人提交。
> README 只做能力总览；第一次跑流程从本文开始。

## 调用约定

| 场景 | Claude Code | Codex |
|------|-------------|-------|
| 生成开发文档 | `/dev-doc 任务名` | `使用 dev-doc skill 给 任务名 生成开发文档` |
| 记录 Bug | `/bug-fix Bug名` | `使用 bug-fix skill 记录 Bug名` |
| 梳理测试业务流 | `/biz-flow 业务名` | `使用 biz-flow skill 生成 业务名 的业务流方案` |
| 生成 Review 任务包 | `/review-fix docs/.../任务.md` | `使用 review-fix skill 基于 docs/.../任务.md 生成 Review 任务包` |
| 执行只读审查 | `/review-check docs/review-fix/...-review-task.md` | `使用 review-check skill 审查 docs/review-fix/...-review-task.md` |
| Review 后直接修复 | `/review-repair <findings或fix-handoff路径>` | `使用 review-repair skill 根据这些 findings 直接修复` |
| 单 AI 一键 Review 闭环 | `/review-loop docs/.../任务.md` | `使用 review-loop skill 基于 docs/.../任务.md 审查、修复、验证并复审当前工作区` |
| 生成代码地图 | `/code-reading docs/.../任务.md` | `使用 code-reading skill 基于 docs/.../任务.md 生成代码地图` |
| 只读判断接口与调用链影响 | `/code-reading <契约与入口>` | `使用 code-reading skill 只读分析新旧接口契约与现有调用链影响，不生成文档或看板` |

Codex 不要输入 `/dev-doc` 或 `$dev-doc`。Codex 安装 skill 不等于注册同名斜杠命令，也不保证进入 `$` 技能选择器。

Cursor 使用当前 skill 入口或自然语言点名；例如：`使用 review-loop skill 基于 docs/.../任务.md 审查、修复、验证并复审当前工作区`。若宿主没有结构化提问工具，按共享交互策略降级为聊天单选，不依赖固定工具名。

## 与 superpowers-zh 组合使用

推荐把 [superpowers-zh](https://github.com/jnMetaCode/superpowers-zh) 作为通用工程方法论层，把本仓库作为企业 Java 交付链层：

- `superpowers-zh`：头脑风暴、TDD、系统化调试、通用 code review、完成前验证等跨语言方法。
- `dev-workflow-skills`：开发文档、Bug/业务流文档、Review 任务包、findings 修复闭环、代码地图、看板、Apifox/OpenAPI 和 Workflow Brief。

安装时在具体项目目录运行：

```bash
npx superpowers-zh
```

自动识别不到工具时，按 `superpowers-zh` 文档使用 `npx superpowers-zh --tool <name>`，例如 `codex`、`cursor` 或 `claude`。不要在用户主目录直接安装，避免 bootstrap 文件污染全局范围。

下文用 `superpowers:<skill>` 表示常见能力名；真实入口以当前宿主安装后显示的命令、skill 名或自然语言触发方式为准。不要因为某个宿主没有同名斜杠命令，就认为不能使用对应能力。

组合建议：

| 阶段 | 可选 superpowers-zh | 本仓库主 skill |
|------|---------------------|----------------|
| 需求混沌、方案未成型 | `superpowers:brainstorming` | 收敛后进入 `dev-doc` / `biz-flow` |
| 复杂实现或测试先行 | `superpowers:test-driven-development` | 仍按 dev-doc Todo 回填执行结果 |
| 疑难问题定位 | `superpowers:systematic-debugging` | 需要沉淀 Bug 时进入 `bug-fix` |
| 通用完成检查 | `superpowers:verification-before-completion` | 进入 `review-fix` 或 `review-loop` 前补齐 Verification Gate |
| 额外通用审查视角 | `superpowers:requesting-code-review` / code review 相关入口 | 正式 findings 仍归并到 `review-check` / `review-fix` ID 链路 |

推荐执行链：

```text
可选 superpowers:brainstorming
→ dev-doc / bug-fix / biz-flow
→ AI 实现；可选 superpowers:test-driven-development / systematic-debugging
→ VCS Gate + Verification Gate；可选 superpowers:verification-before-completion
→ review-fix / review-check / review-repair，或 review-loop
→ code-reading
→ 人工 review / 提交
```

回填规则：

- brainstorming 输出只作为需求来源，必须写入 `dev-doc` 的范围、非目标、blockers、conflicts 或 assumptions，不能绕过 Plan Gate。
- TDD/debugging 输出必须落到执行结果回填：Todo 完成情况、changed 文件、验证命令、失败原因和 `TestDependencyClass`。
- verification-before-completion 只能增强 Verification Gate；没有可复跑命令、退出结果和目标逻辑断言证据时，`TestEvidenceStatus` 仍不能写 `Passed`。
- requesting-code-review 或其他通用 review 只能作为额外 reviewer 来源；有效问题要归并为 `CR/IM/MI`，误报写 `RJ`，待确认写 `BK`。
- 交给下一位 AI 时仍复制本仓库 `【Workflow Brief】`，不要只贴 superpowers 的过程输出。

## 一句话主链路

```text
dev-doc / bug-fix / biz-flow
→ AI 执行并回填结果
→ VCS 纳管新增文件
→ 测试/构建/接口验证
→ review-fix 生成任务包
→ review-check 多 AI 只读审查
→ review-fix 汇总修复 / review-repair 直接修复
→ code-reading 生成代码地图
→ 人工 review
→ 提交
```

单 AI 可把 Review Gate 简化为：

```text
review-loop standard：review-fix 任务包 → review-check → review-repair → 验证 → 二次 review-check
```

小改动可显式使用 quick，跳过任务包文件但不跳过审查、修复门槛、验证和二次复审。`review-loop` 必须标记 `SingleAgentReview`，不能冒充多 AI 交叉审查。

## 阶段门禁

| 门禁 | 必须看到的证据 | 通过后进入 |
|------|----------------|------------|
| Plan Gate | dev-doc / bug-fix / biz-flow 文档；阻塞项、冲突、假设已写清；Standard 模式看板与 `docs/INDEX.md` 已刷新，Compact 明确标记派生产物 NotApplicable | 实现 |
| Implementation Gate | Todo 对照表：已完成项、变更文件、未完成项、执行偏差 | VCS 检查 |
| VCS Gate | `git status --short` 或 `svn status`；新增源码、测试、配置、OpenAPI YAML、文档已 `add` | 验证 |
| Verification Gate | 有针对性的测试/构建/接口/数据核对命令和结果；失败已修复并重跑 | Review |
| Review Gate | 拆分链的 review task/findings/repair 状态，或 `review-loop` 的 SingleAgentReview 闭环结果 | 代码地图 |
| Understanding Gate | `code-reading` 代码地图；人工 review 关注点 | 提交前检查 |
| Submit Gate | 最终 status/diff/test/review/doc/sensitive 检查通过 | `git commit` / `svn commit` |

任何门禁失败都先停在当前阶段，不带病进入下一步。

## 准确性硬规则

- 方案文档不是实现证据；没有 diff/status/文件内容时，只能说“已形成方案”，不能说“已实现”。
- `变更文件` 必须来自 `git status` / `svn status` / diff / patch / 实际读取文件，不能按任务名猜。
- 验证必须写命令和结果；没跑就写“未运行 + 原因”，不要把建议命令写成已通过。
- 验证先标记 `TestDependencyClass`：`Hermetic`（纯单测/静态检查）、`ServiceBacked`（受控 DB/Redis/MQ）、`LiveExternal`（真实 AI/SaaS/云服务）或 `Mixed`。JDK、Node、Maven、npm、依赖下载或显式外部测试所需网络不可用时标 `environment-blocked`；但默认 `test/verify` 强依赖 CI 未提供的真实密钥/外部服务时，是 `Failed` 的测试架构/CI 契约问题，不能归咎于环境，也不能填假密钥绕过。
- Review 前先声明审查对象：审方案、审实现代码，还是审修复交接；没有实现证据时不得输出“代码无问题”。
- Finding 必须带证据位置；没有文件/方法/接口/日志/配置/文档章节支撑时，写“材料不足”或“待确认”。
- Critical / Important finding 必须逐条关闭、阻塞、拒绝或延期，不能只写“已处理”。
- 测试必须证明目标逻辑：测试名、输入数据、被调用方法和断言对象要一致；只验证前置条件或 mock 自身，不能算风险已解除。
- review-loop 启动时先声明 `VcsAddPolicy`：宿主仓库明确要求新建业务文件必须纳管时为 `host-required`，否则为 `user-authorize-only`。前者以宿主规则为授权，后者需用户看到逐文件清单后明确授权；发生规则冲突必须在 add 前写明来源和采用口径。两者都只允许 `git add -- <files>` / `svn add -- <files>` 纳管精确清单，禁止 `git add .`、目录级兜底，完成后立即重验 status/diff，且不扩展为 commit/push 授权。
- PowerShell 下 Maven `-Dkey=value` 参数按完整参数引用；Surefire/JUnit/覆盖率报告须确认来自本轮运行，陈旧报告不能作为当前结论。

## 轻量交接，减少 Token

> "每个 skill 完成后下一步跑什么 + 可复制命令"的单一权威表在 [skills/_shared/workflow-chain.md](../skills/_shared/workflow-chain.md)；下方的下一步提示都以它为准。

每一轮结束后优先复制 `【Workflow Brief】`，再附产物路径或 finding ID。不要把完整 dev-doc、review-task、fix-handoff、长 diff 反复粘贴给下一位 AI。

当要跨会话保留当前对话的目标、实际动作、验证、阻塞和接手提示，而不仅是交接一个 workflow 步骤时，使用 `conversation-handoff` 生成 `docs/handoffs/YYYY-MM-DD/<task>-handoff.md`。它必须区分已证实、推断和待确认；接手方仍要回到原始文件和命令结果核对。

推荐交接顺序：

```text
1. 复制上一轮的 Workflow Brief
2. 提供产物路径：docs/...md、docs/review-fix/...、docs/apifox/...
3. 如果是 review 修复，只贴 finding ID、文件、证据、修复建议、验证方式
4. 让下一位 AI 按 tokenHint 先读 Brief -> 源文档/任务包 -> changed 文件 -> 必要验证输出
```

示例：

```text
使用 review-check skill 审查 docs/review-fix/2026-07-09/xxx-review-task.md。
先读下面的 Workflow Brief，再按 tokenHint 读取任务包和 changed 文件；不要要求我粘贴全文。
```

```text
使用 review-repair skill 根据这些 findings 直接修复。
先按 Workflow Brief 确认 source、changed、tests，再只处理 accepted findings。
```

## 产物地图

| 产物 | 位置 | 谁生成 | 是否建议提交 |
|------|------|--------|--------------|
| 标准/增量开发文档 | `docs/YYYY-MM-DD/<task>.md` | `dev-doc Standard/Incremental` | 是 |
| 精简开发文档 | `docs/YYYY-MM-DD/<task>.md` | `dev-doc Compact` | 否（仅 md） |
| Bug 文档 | `docs/bugs/YYYY-MM-DD/<bug>.md` | `bug-fix` | 是 |
| 业务流文档 | `docs/biz-flow/YYYY-MM-DD/<feature>.md` | `biz-flow` | 是 |
| OpenAPI YAML | `docs/apifox/YYYY-MM-DD/<task>.openapi.yaml` | `dev-doc`，仅接口变更时 | 是 |
| OpenAPI 索引 | `docs/apifox/INDEX.md` | `dev-doc` | 是 |
| Review 任务包 | `docs/review-fix/YYYY-MM-DD/<task>-review-task.md` | `review-fix` 第一阶段 | 是 |
| Review 修复交接 | `docs/review-fix/YYYY-MM-DD/<task>-fix-handoff.md` | `review-fix` 第二阶段 | 是 |
| 代码地图 | `docs/code-reading/YYYY-MM-DD/<task>.md` | `code-reading CodeMap` | 是 |
| 只读影响分析 | 聊天输出，无仓库文件 | `code-reading ImpactAnalysis` | 否 |
| 看板数据 | `project-html/data/changes.js` | 文档类 skill | 是 |
| 单页与总索引 | `project-html/pages/`、`docs/INDEX.md` | `node project-html/build.js` | `docs/INDEX.md` 是；`pages/` 按项目策略 |

## 详细步骤

### 1. 选入口

- 新功能、接口变更、重构、配置变更：用 `dev-doc`。
- 需要记录现象、根因、修复边界：用 `bug-fix`。
- 要给测试/产品讲清业务状态、数据流、接口顺序：用 `biz-flow`。

如果需求和现有代码、字典、状态机、权限或数据模型冲突，先把冲突写进文档并阻塞，不要按猜测继续。

### 2. 生成方案文档

运行入口 skill 后，确认输出里至少有：

- 文档路径。
- 看板更新结果。
- 阻塞项、冲突、假设。
- 实现 Todo。
- 验证命令建议。
- 下一步执行提示。

涉及接口新增或签名变更时，还必须有：

- `docs/apifox/<日期>/<任务名>.openapi.yaml`
- `docs/apifox/INDEX.md`
- md 中的 Apifox 导入说明和接口索引。

### 3. 实现并回填执行结果

把文档末尾的执行提示交给 AI 或开发者。完成后要求回填：

```text
执行结果对照表
- 已完成 Todo：<逐项列出>
- 未完成/偏离项：<没有写 无>
- 变更文件：<源码/测试/配置/文档/OpenAPI>
- 验证命令：<已运行或待运行>
- 风险/疑问：<没有写 无>
```

没有这张对照表，后续 review 只能靠 diff 猜，容易漏掉“该做但没做”的项。

### 4. VCS Gate

Git：

```bash
git status --short
git diff --name-status
git add <新增源码/测试/配置/OpenAPI/文档>
```

SVN：

```bash
svn status
svn add <新增源码/测试/配置/OpenAPI/文档>
svn diff --summarize
```

重点检查：

- 新增测试文件是否已纳入 VCS。
- `docs/apifox/*.openapi.yaml` 和 `docs/apifox/INDEX.md` 是否已纳入 VCS。
- `project-html/data/changes.js`、`docs/INDEX.md` 是否刷新。
- 没有把临时 patch、日志、凭证文件误加入。

### 5. Verification Gate

优先用文档里给出的模块级验证命令。泛化命令只作为兜底：

```bash
mvn test
./gradlew test
npm test
```

多模块 Maven 项目应优先使用可复现的模块命令，例如：

```bash
mvn -f <module-pom> test
mvn -pl <module> -am test
```

验证失败时先修复并重跑。不要把失败测试带入 Review。

如果失败原因是工具链环境不匹配（例如项目要求 Java 21，但本机 `java -version` 是 Java 17），先停在 Verification Gate，记录为 `environment-blocked`，更换环境后重跑；不要让 review/repair 去猜业务代码问题。

### 6. Review Gate

先生成任务包：

```text
Claude Code: /review-fix docs/YYYY-MM-DD/<task>.md
Codex: 使用 review-fix skill 基于 docs/YYYY-MM-DD/<task>.md 生成 Review 任务包
```

`review-fix` 第一阶段必须有实际实现证据：VCS status、diff/patch 或明确变更文件。只有方案文档时，只能审方案，不能声称审过代码。

再让一个或多个 AI 执行只读审查：

```text
Claude Code: /review-check docs/review-fix/YYYY-MM-DD/<task>-review-task.md
Codex: 使用 review-check skill 审查 docs/review-fix/YYYY-MM-DD/<task>-review-task.md
```

把 findings 原样贴回 `review-fix`。`review-fix` 第二阶段应输出：

- accepted / rejected / needs-confirmation 分类。
- 每条 Critical / Important 的修复建议和验证方式。
- 修复操作码。
- 修复后回填要求。

Critical / Important 没关闭前，不进入 Submit Gate。

如果这次不需要再生成修复交接文档，希望 AI 直接修改代码：

```text
Claude Code: /review-repair <粘贴findings或fix-handoff路径>
Codex: 使用 review-repair skill 根据这些 findings 直接修复
```

`review-repair` 只处理有证据、能定位、能验证的 accepted findings；涉及业务语义、权限、状态流转、接口契约、数据库结构或数据修复的问题会停下来确认，不会猜着改。

### 单 AI 编排：review-loop

```text
Claude Code: /review-loop docs/YYYY-MM-DD/<task>.md
Codex: 使用 review-loop skill 基于 docs/YYYY-MM-DD/<task>.md 审查、修复、验证并复审当前工作区
```

默认 standard 会生成 review-task；quick 只适合小范围单模块改动。只要修改过代码就必须验证并二次 review-check，最多自动修复两轮。没有实际 diff 时只能输出 PlanReview；业务/API/权限/DB blocker、验证失败、环境阻塞或未关闭 Critical/Important 都会停止。skill 不执行 add、commit、push 或数据库写入。

### 7. 修复后复验

按修复交接或 `review-repair` 直修执行后，回填：

```text
- 已修复 finding：<CR/IM ID + 证据>
- 未采纳 finding：<原因>
- 验证命令与结果：<命令 + 结果>
- 是否需要二次 review-check：<是/否，原因>
- Workflow Brief：<修复后的 changed/tests/openFindings/next/tokenHint>
```

如果改动范围明显扩大，重新跑 `review-check`。小范围确定性修复可由人工 review 签收。

### 8. Understanding Gate

在最终人工 review 前生成代码地图：

```text
Claude Code: /code-reading docs/YYYY-MM-DD/<task>.md
Codex: 使用 code-reading skill 基于 docs/YYYY-MM-DD/<task>.md 生成代码地图
```

人工重点看：

- 调用链是否符合业务入口。
- 状态流转、权限、数据归属是否符合文档。
- 事务边界、幂等、重复提交、异常分支是否合理。
- Review 修复是否引入新风险。

### 9. Submit Gate

提交前必须逐项确认：

- `git status --short` 或 `svn status` 无漏 add。
- `git diff` 或 `svn diff` 已人工扫过。
- 目标测试/构建/接口验证已通过。
- Critical / Important findings 已关闭或有明确不采纳理由。
- `docs/INDEX.md`、看板、OpenAPI 索引已刷新。
- diff 中没有 API key、密码、token、cookie、私钥、生产连接串。
- 数据库 DDL/数据修复没有被 AI 直接执行；需要时只保留 DBA 申请材料。

提交命令：

```bash
git commit -m "<type>: <summary>"
svn commit -m "[任务类型] [任务名称]：简要说明"
```

## 失败分支

| 问题 | 处理 |
|------|------|
| skill 没触发 | Codex 改用自然语言：“使用 <skill-name> skill ...”；确认 skill 已安装到对应工具目录 |
| Node 不存在 | 文档仍可生成；看板单页和索引无法刷新时，在完成输出说明并让用户安装 Node 后运行 `node project-html/build.js` |
| `project-html/build.js` 失败 | 停止，先看报错；不要手工覆盖 `data/changes.js` |
| SVN/Git 新文件漏 add | 回到 VCS Gate，补 `svn add` / `git add` 后再 review |
| 测试失败 | 回到实现阶段修复并重跑，不进入 Review |
| `review-check` 输出 Critical | 严谨路径：贴回 `review-fix` 生成修复交接；直修路径：交给 `review-repair` 直接修复。两种都必须验证后再签收 |
| 只有 dev-doc 没有 diff | 只能审方案，不能输出“实现无问题” |
| OpenAPI YAML 生成失败 | 接口变更任务不得宣称 Apifox 可导入；先修 YAML 或标记为 blocker |
| 数据库结构变更 | 停止直接实现，只输出 DBA 申请说明或建议 DDL |

## 速记

```text
文档立项 → 执行回填 → add 新文件 → 跑验证 →（拆分链 review-fix/review-check/review-repair，或单 AI review-loop）→ code-reading → 人工签收 → 提交
```
