# Skill Quality Report

## 基线概览

- 记录时间：2026-07-18 17:43 Asia/Shanghai
- 仓库类型：Java 后端开发工作流 Skill 集合仓库
- 正式 Skill：9 个
- 公共规则目录：`skills/_shared`
- 主要产物目录：`skills/`、`scripts/`、`project-html/`、`docs/`
- 安装入口：`install.sh`、`install.ps1`、`install-local.cmd`
- 全量校验入口：`node scripts/check-all.js`

## Skill 分类

| 分类 | Skill | 主要职责 |
| --- | --- | --- |
| 计划与文档 | `dev-doc` | 编码前生成开发方案、看板条目和可选 OpenAPI |
| Bug 诊断 | `bug-fix` | 记录 Bug 现象、根因证据、修复边界和看板条目 |
| 业务说明 | `biz-flow` | 面向测试/产品输出业务流、数据流、时序和状态机 |
| 审查任务 | `review-fix` | 生成多 AI review 任务包，或汇总 findings 形成修复交接 |
| 只读审查 | `review-check` | 对任务包、方案、patch 或工作区变更输出结构化 findings |
| 直接修复 | `review-repair` | 根据 findings 修改代码、验证并回填状态 |
| 单 Agent 闭环 | `review-loop` | 编排审查、修复、验证、复审的最多两轮闭环 |
| 代码理解 | `code-reading` | 生成代码地图或只读影响分析 |
| 对话交接 | `conversation-handoff` | 输出跨 Codex/Claude/Cursor 对话可继续执行的交接文档 |

## 当前质量基线

- Frontmatter/OpenAI 元数据：通过 `scripts/check-skill-metadata.js`；除必填字段、引号、BOM/UTF-8 外，还拒绝 frontmatter、`interface` 和 `policy` 块中的重复直接键。
- Eval 覆盖：9 个 Skill 均有 `evals.json`，共 141 个场景。
- Eval 文档口径：README 声明“覆盖全部正式 Skill”而不重复硬编码数量；当前精确 9 Skill/141 场景由 inventory 和 eval 校验输出证明。
- Eval 结构健壮性：顶层、场景对象、ID、prompt、expected_output、tags 均有确定性诊断；malformed 非对象和标量 tags 不会再抛 TypeError，相关自测由 `check-scripts.js` 执行。
- Workflow Brief：9 个 Skill 均通过 `scripts/check-workflow-briefs.js`。
- 公共交互协议：通过 `scripts/check-interaction-policy-sync.js`。
- 看板资产同步：`project-html/` 与 `skills/dev-doc/assets/board/` 当前同步，`BOARD_VERSION = 23`。
- 安装器：通过 `scripts/check-installers.js`；除三端静态 guardrail 外，会在隔离 HOME 实际安装 Codex 副本并逐目录树/字节验证资源完整、同名替换、无关 Skill 保留和仅 `SKILL.md` 去 BOM。Windows 路径已本地实测，POSIX 路径由本地 tar fixture 分支承载。
- 文档：通过 `scripts/check-docs.js`。
- Skill 资源清单：AGENTS/CLAUDE 的 9 个入口、`reference.md` 和 `examples.md` 声明通过 `scripts/check-skill-inventory.js` 与文件系统对账。
- Finding 状态契约：Review Gate 统一使用 `fixed / deferred / deferred-next-batch / blocked / rejected`；普通 deferred 不承诺下一批，next-batch 状态明确进入后续批次。
- 测试证据状态契约：材料/只读阶段使用六种 `TestEvidenceStatus`；代码修改后必须重判为 Passed/Failed/NotRun/EnvironmentBlocked，不能沿用 NotProvided/NotApplicable 绕过验证。
- Workflow Brief：共享协议与 9 个 Skill 模板均由 `check-workflow-briefs.js` 校验；首轮读取上限 5 个文件，rejected 不得作为 open finding，普通 deferred 不自动进入下一批。
- Workflow Brief 路由：`nextCommand` 必须覆盖明确状态分支；人工动作不能写空命令，`<skill-name> skill` 引用必须指向现存 Skill。
- 用户索引：README“选择 skill”表和 AGENTS/CLAUDE supporting-files 表均由 inventory 与文件系统对账，不再只靠名称全文出现判断。
- 持续集成：`.github/workflows/check.yml` 保留既有 `check / board` context 并运行唯一全量入口 `node scripts/check-all.js`；`check-docs.js` 守护该绑定。远端 Ubuntu 实际结果待提交后产生。
- Portable discovery：biz-flow、bug-fix、code-reading、review-check 与 review-fix 的 frontmatter description 已与 UI prompt/eval 的相邻 Skill 路由同步，并由 inventory 守护。

## 已知边界

- 仓库当前已有未提交修改：本轮起视为外部已有工作，后续不得重置或覆盖。
- Markdown 源文件按项目规则保留 UTF-8 BOM；安装到 Codex 目标时由安装器去除 `SKILL.md` BOM。
- 不应把 `$skill-name` 作为 Codex 文档入口，因为 Codex Desktop 中 `$` 会打开选择器。
- 所有数据库相关 Skill 指令必须保持只读默认和 DDL 用户确认边界。

## 初始质量判断

当前基础设施较完整，优先优化方向不应是大规模补脚手架，而应聚焦：

- 跨 Skill 边界和触发条件是否仍有重叠或歧义。
- 公共规则引用是否足够集中，避免每个 Skill 复制交互协议。
- 校验脚本是否能覆盖 README/AGENTS/CLAUDE 与实际 Skill 清单、metadata、eval 的漂移。
- 已有文档和示例是否与新的看板 detail sidecar 架构保持一致。
- 长流程是否都有明确停止条件、失败分支和 token 范围控制。

## 第 10 轮 Checkpoint

- 新增长期状态与 dirty worktree baseline，后续恢复时从 `.agent/skill-iteration-state.md` 继续，不从第 1 轮重来。
- 新增并接入：
  - `scripts/check-skill-inventory.js`
  - `scripts/check-review-boundaries.js`
  - `scripts/check-document-boundaries.js`
- `node scripts/check-all.js` 当前执行 15 个脚本/步骤，并通过。
- `conversation-handoff` 已补充非交互/无人值守停机规则，并新增 eval 覆盖；eval 总数为 131。
- README/AGENTS/CLAUDE 已同步新增单项脚本入口，`check-docs.js` 会守护 README 的新增脚本名。
- 后续优先级：先审查当前 diff 和启动前 dirty 文件归属，再决定是否继续修改已有 dirty 文件。

## 第 19 轮 Checkpoint

- `scripts/check-docs.js` 已从 `scripts/check-all.js` 自动推导 README 维护命令清单，减少新增校验脚本后的双写遗漏。
- `review-repair`、`conversation-handoff`、`biz-flow` 的 OpenAI UI prompt 已补充相邻 Skill 路由边界，并由 `scripts/check-skill-inventory.js` 守护关键入口提示。
- `scripts/check-skill-metadata.js` 与 `scripts/check-skill-inventory.js` 已校验 OpenAI metadata 单行引号闭合，并通过 `--self-test` 覆盖最小正反例。
- `scripts/check-review-boundaries.js` 与 `scripts/check-document-boundaries.js` 的失败信息已明确这些短语是行为护栏；README/AGENTS/CLAUDE 也已说明它们不是普通文案 lint。
- 最新全量验证：`node scripts/check-all.js` 通过。
- 后续优先级：优先处理仍未分析的 Windows 编码体验问题；若确认只是终端显示噪声，则标记为无需处理或补充维护说明。

## 第 27 轮 Checkpoint

- 9 个正式 Skill 现在全部具有按需加载的 `examples.md`；`code-reading` 与 `conversation-handoff` 的示例分别覆盖双模式边界和证据分层/无人值守停机。
- `scripts/check-docs.js` 会验证全部 Skill 本地 Markdown 链接与标题锚点，当前共 100 个。
- `scripts/check-skill-metadata.js` 递归验证 31 个 Skill Markdown 的 UTF-8 BOM/有效 UTF-8，并守护 metadata 单行 scalar；相关 parser 均有最小负例自测。
- `scripts/check-workflow-briefs.js` 对 malformed Brief 输出字段级诊断，不再因缺字段抛 TypeError。
- `scripts/check-skill-inventory.js` 会将 AGENTS/CLAUDE 的 Skill 表与文件系统对账，新增或删除 examples 后漏同步文档会显式失败。
- 最新全量验证：`node scripts/check-all.js` 通过（15 个检查脚本、9 个 Skill、131 个 eval 场景，`BOARD_VERSION = 23`）。
- 后续优先级：轮换到近期未直接优化的 review 系 Skill，检查 findings ID 追踪、停机条件和 eval 是否仍完整一致。

## 第 34 轮 Checkpoint

- Review Gate 已统一五种 finding 终态和分阶段 `TestEvidenceStatus`，并由 review boundary 检查守护。
- 共享协议与 9 个 Skill 的 Workflow Brief 均纳入结构和路由校验；未知 Skill、空人工动作、遗漏状态分支会失败。
- README 与 AGENTS/CLAUDE 的 Skill 清单已和文件系统确定性对账；31 个 Skill Markdown 的 BOM、链接和锚点均受检查。
- biz-flow 与 review-check 的 portable discovery surface 已明确相邻 Skill 路由，review-check 新增 direct-repair 与 single-agent-loop 路由覆盖。
- 最新全量验证：`node scripts/check-all.js` 通过（15 个检查脚本、9 个 Skill、31 个 Markdown、100 个本地链接、132 个 eval 场景，`BOARD_VERSION = 23`）。
- 后续优先级：轮换到文档类 Skill，检查 portable description、UI prompt 与 eval 的真实边界缺口，避免继续集中优化 review 系。

## 第 35 轮补充

- code-reading discovery surface 现在明确只负责结构/影响理解，不输出实施方案、不判断或关闭 findings、不直接修复代码。
- 相邻请求分别路由到 dev-doc、review-check、review-repair、biz-flow；四类路由都有 eval 标签并由 inventory/eval 检查守护。
- 最新全量验证：`node scripts/check-all.js` 通过（9 个 Skill、31 个 Markdown、100 个本地链接、135 个 eval 场景，`BOARD_VERSION = 23`）。

## 第 36 轮补充

- bug-fix discovery surface 已按主交付物排除纯正常业务流说明：不诊断单次故障、只给测试/产品讲业务流时路由 biz-flow。
- 事故复盘若要求现象、复现、根因证据或修复边界，仍由 bug-fix 负责；不能因文档中包含流程说明而自动转走。
- 最新全量验证：`node scripts/check-all.js` 通过（9 个 Skill、31 个 Markdown、100 个本地链接、136 个 eval 场景，`BOARD_VERSION = 23`）。

## 第 37 轮补充

- bug-fix 与 biz-flow 现在按主交付物双向分流：正常业务/数据/状态说明归 biz-flow，单次事故的现象/复现/根因/修复边界归 bug-fix。
- 两个方向分别有近邻 eval，且 frontmatter 与 OpenAI prompt 的目标 Skill 名由 inventory 守护。
- 最新全量验证：`node scripts/check-all.js` 通过（9 个 Skill、31 个 Markdown、100 个本地链接、137 个 eval 场景，`BOARD_VERSION = 23`）。

## 第 38 轮补充

- eval 校验器已确认原有重复/非法 ID 和 tags 类型检查有效，本轮未重复实现这些规则。
- malformed 顶层或场景现在输出稳定路径诊断并继续；非法 tags 不会在覆盖统计阶段再次触发异常。
- `check-evals.js --self-test` 已接入脚本总检查；最新全量验证继续通过，eval 基线仍为 137。

## 第 39 轮补充

- discovery metadata 的重复 YAML 键不再静默采用后值，避免 Codex/Claude/Cursor 或不同 YAML 库产生不一致解析。
- 检查范围刻意限定为项目规范中的 frontmatter 顶层与 OpenAI interface/policy 平面块；跨块同名键合法。
- 最新全量验证：9 个 Skill、31 个 Skill Markdown、137 个 eval 场景全部通过。

## 第 40 轮补充

- installer check 已从文本匹配升级为真实隔离安装 smoke；测试 HOME 唯一、finally 清理，不访问用户实际 Skill 目录。
- 当前 Windows local CMD 路径逐文件通过；POSIX install.sh 使用 `DEV_WORKFLOW_SKILLS_TARBALL=file://...` 的本地 fixture，尚待 POSIX 运行环境实际执行。
- 新识别高优先级缺口：现有 GitHub Actions 未运行 `check-all`，因此多数检查和 POSIX smoke 尚无 PR gate。

## 第 41 轮补充

- GitHub Actions 已从 3 个手工子步骤切换到完整 check-all，覆盖现有 15 个有序检查/构建步骤。
- 原 workflow/job ID 保留，减少既有分支保护 context 失配风险；仓库检查会拒绝 CI 回退为部分套件。
- 当前 Windows 全量验证通过；Ubuntu runner 和 POSIX installer smoke 仍需提交后的远端 run 作为最终平台证据。

## 第 42 轮补充

- README 的过时“8 个 skill”已移除，改为可长期成立的“全部正式 Skill”不变量。
- check-docs 守护文档口径，inventory/check-evals 动态守护实际清单与覆盖；当前仍为 9 Skill、137 场景。

## 第 43 轮补充

- review-fix discovery 现在明确只负责多 AI 任务包与 findings 汇总交接；一次审查、立即直修、同 AI 闭环分别路由 review-check/review-repair/review-loop。
- 三条近邻路径均有 eval 标签和 inventory 关键词守护；最新基线为 9 Skill、139 场景。

## 第 44 轮补充

- review-repair 现在只接收已有 findings、fix-handoff、review 结果或明确问题清单；无 findings 的单 AI 审查修复闭环稳定路由 review-loop。
- portable description、OpenAI prompt、正文边界和 eval 四层均有确定性守护；一次定向失败验证了稳定行为短语会被 inventory 捕获。
- 状态文件顶部轮次摘要已与日志末尾重新对齐；最新全量基线为 9 Skill、31 个 Markdown、100 个本地链接、140 个 eval 场景。

## 第 45 轮补充

- dev-doc 与 code-reading 现在按主交付物双向分流：可执行实施方案归 dev-doc，只读结构/调用链/契约影响理解且不要方案归 code-reading。
- 允许组合使用：先由 code-reading 收集证据，再回 dev-doc 形成方案；不会把这条组合路径误写成互斥禁令。
- OpenAI prompt 已补齐既有 review-fix 路由；最新全量基线为 9 Skill、31 个 Markdown、100 个本地链接、141 个 eval 场景。

## 第 46 轮补充

- eval 场景计数不再接受同一 Skill 内仅空白不同的重复 prompt，避免复制后只改 ID 虚增覆盖。
- 去重刻意限定为确定性文本归一化；跨 Skill 路由对照、大小写和代码字面量差异不受影响。
- 当前 9 个 Skill 的 141 个场景全部唯一并通过全量检查。

## 第 47 轮补充

- workflow-chain 的职责和下一步覆盖已从 8 个补齐到全部 9 个正式 Skill；conversation-handoff 作为任意阶段恢复工具，不改变原主链。
- inventory 会从文件系统动态推导 Skill 清单并对两个 chain 表做确定性检查；新增 Skill 后漏写 chain 会直接失败。
- 下一步表保留阶段限定多分支能力，当前 review-fix 两分支与全部其他 Skill 均通过。

## 第 48 轮补充

- workflow-chain 不再把 code-reading 视为单一代码地图产物：CodeMap 与 ImpactAnalysis 有独立下一步。
- ImpactAnalysis 可按目标进入 dev-doc、review-check 或人工确认，不会被误推到提交；CodeMap 仍保持人工 review/Submit 路径。
- inventory 自测和正例会守护两个必需模式标签，最新全量基线仍为 9 Skill、141 个 eval 场景。

## 第 49 轮补充

- workflow-chain 中明确声明的 Skill 分支现在都能从 Claude Code 与 Codex 两列直接启动；review-fix 汇总和二次 review-check 不再只有说明没有命令。
- inventory 从默认下一步动态提取正式 Skill，并验证双宿主入口；目录路径不会误判为命令。
- 独立审计与全量套件均通过，当前仍为 9 Skill、141 个 eval 场景。

## 第 50 轮 Checkpoint

- 看板外壳定位/复制/版本比较从 dev-doc、bug-fix、biz-flow 三份主入口下沉为 `_shared` 按需资源；初始 Skill 上下文合计减少 87 行。
- bug-fix/biz-flow 不再依赖跨 shell 保留 `$src`；两个共享命令块各自解析模板位置，并守住既有 `data/`。
- 当前基线：9 个正式 Skill、32 个 Skill Markdown、102 个本地链接、141 个 eval 场景、15 个全量检查步骤、`BOARD_VERSION = 23`。
- 本地 Windows 全量和安装 smoke 通过；共享 Bash 仅有语法证据，POSIX 行为 smoke 记为下一轮高优先级任务。

## 第 51 轮补充

- document boundary 检查现在确定性提取共享 board bootstrap 的两个 Bash 块；代码块增删或提取失败会直接报错。
- 非 Windows 会在系统临时目录和隔离 HOME 中验证首次复制、既有 `changes.js`/detail 保留，以及 `BOARD_SHELL_CURRENT` / `BOARD_SHELL_UPGRADE_REQUIRED`；删除前校验临时路径归属。
- Windows 保留静态与语法守护并明确输出 POSIX 行为 smoke 已跳过；本地全量仍为 9 Skill、32 Markdown、102 本地链接、141 eval、15 个检查步骤，真实 POSIX 结果待提交后的 Ubuntu CI。

## 第 52 轮补充

- `conversation-handoff` 的完整输出模板现用四反引号包裹，内部三反引号提示块不再提前结束模板。
- `check-docs` 会按 Markdown 围栏字符、长度、缩进和 closing 语法扫描全部 Skill Markdown，并报告未闭合 opening 行；自测包含本次真实缺陷的最小负例。
- Workflow Brief 校验器同步接受至少三个反引号或波浪号的纯围栏终止行，四反引号模板不会再误报非字段。首次全量暴露该兼容缺口后已修复，最终全量基线保持 9 Skill、32 Markdown、102 链接、141 eval。

## 第 53 轮补充

- 本地路径/锚点检查从仅 `skills/` 扩展到全部 Skill Markdown 与 requiredDocs 中明确维护的入口文档；生成索引、日期产物和归档不作为源码前置条件。
- inline-code spans 内的伪 Markdown 链接会被忽略，code span 作为链接 label 时目标仍受检查；相关行为和维护清单都有自测。
- 受检本地链接由 102 增至 113；缺失目标故障注入按预期失败并已清理，最终全量套件通过。

## 第 54 轮最终收尾

- `review-loop` 的 portable description 与 OpenAI default prompt 已和正文/reference/eval 对齐：最多 2 个修复循环，残留 Critical/Important 或验证 `Failed`/`EnvironmentBlocked` 时保留 finding ID 并停止，不进入 Submit Gate。
- `check-skill-inventory.js` 同时守护 frontmatter 与 UI prompt 的停机边界；语法、自测、inventory、metadata、review boundary 和 eval 定向检查通过。
- `node scripts/check-all.js` 最终全量通过：15 个检查步骤、9 个 Skill、32 个 Skill Markdown、113 个维护链接、141 个 eval 场景、`BOARD_VERSION = 23`，Windows installer smoke 与 `git diff --check` 均通过；Windows 按设计跳过 POSIX board-shell 行为 smoke。
- 本轮仅完成已登记的 `SQ-054`，不新增候选优化；按用户要求结束迭代。
