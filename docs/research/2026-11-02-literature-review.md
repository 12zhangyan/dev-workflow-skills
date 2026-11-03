# 2026-11-02：对照 2026 年 Agent Skill 研究文献评估本项目

目的：用最新一批关于 Agent Skill / SKILL.md / 上下文文件的研究，检查本项目的设计和评测方法有哪些已对齐、哪些有缺口。

范围说明：只读了各论文的 arXiv 摘要页，没有读正文；下文的数字都来自摘要。结论用于指导评测方向，不作为项目效果的证据。

## 文献

| 论文 | 时间 | 与本项目相关的结论 |
|---|---|---|
| [ACES: Evaluating Skills, Not Just Agents](https://arxiv.org/abs/2608.20614) | 2026-08 | 同一任务分有 skill / 无 skill 两组配对实测，算出 Skill Lift（相对提升）。145 个真实 skill 上静态扫描分与 LLM 打分几乎不相关（ρ=0.14）；947 个配对平均提升 0.21，只有 72.8% 的配对是正提升。 |
| [SWE-Skills-Bench](https://arxiv.org/abs/2603.15401) | 2026-03 | 49 个公开工程类 skill 中 39 个对通过率零提升，平均 +1.2%；3 个因为指导和项目实际版本不符而下降（最多 −10%）；token 开销最多 +451%。 |
| [Agent Skills Can Be Harmful](https://arxiv.org/abs/2608.11888) | 2026-08 | 统计 307 次由 skill 引起的失败。最大一类是“流程过度”：过度验证 67 例，过重的实现流程 30 例。skill 常把检查清单和构造配方变成必做的工作。 |
| [SIGIL: Skill Compilation](https://arxiv.org/abs/2607.27309) | 2026-07（09 修订） | 只靠 Markdown 写的流程，四个模型的遵循度只有 26.2–54.0%；把流程编译成确定性代码后最高到 100%，token 还省 21–45%。 |
| [Skill Issue: Optimizing Repository SKILLs](https://arxiv.org/abs/2609.12742) | 2026-09 | 用仓库自己的历史 PR 构造任务做评测。一个仓库能凑出的任务量太少，+4.9 个百分点的提升和多次运行之间的随机波动分不开。 |
| [What Keeps Agent Skills from Being Reusable? (138K SKILL.md)](https://arxiv.org/abs/2608.08453) | 2026-08 | 91.8% 的公开 skill 至少有一个缺陷，主要是路由元数据（description）写得弱、正文臃肿或不可执行、资源组织差；元数据有效的 skill 检索命中更稳。 |
| [How Well Do Agentic Skills Work in the Wild](https://arxiv.org/abs/2604.04323) | 2026-04 | agent 从 3.4 万个真实 skill 中自行检索时，收益接近无 skill 基线，瓶颈在检索和挑选。 |
| [SkillsBench](https://arxiv.org/abs/2602.12670) | 2026-02（06 修订） | 人工精选的 skill 把平均通过率从 33.9% 提到 50.5%；最多 3 个模块的聚焦型 skill 好过大而全的组合。 |
| [What Should a Skill Remember?](https://arxiv.org/abs/2606.09421) | 2026-06 | 把 skill 压短可能反而更贵：删掉 API 用法、流程守卫、规则这类关键锚点后，agent 探索和恢复的成本上升。 |
| [Instruction Adherence in Coding Agent Configuration Files](https://arxiv.org/abs/2605.10039) | 2026-05 | 1650 个 Claude Code 会话。文件长度、位置、拆分方式、相互矛盾都没测出可检测的影响；同一会话中每多生成一个函数，遵循指令的几率下降约 5.6%（探索性发现）。 |
| [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988) | 2026-02（09 修订） | 上下文文件总体不提高成功率，推理成本上升 20% 以上；仓库概览无用，只有写明非标准做法的内容有用。 |

## 对照

### 1. skill 价值证明：主要缺口

文献共识是 skill 的价值要靠“有 skill / 无 skill”配对实测，而多数 skill 实测提升接近零。本项目已有的是新旧版本对比（`--skill-source`）和逐条规则的去留对照（如 [2026-10-21 规则复验](2026-10-21-rule-retro-eval.md)，每组 8–10 次）。这两者回答“这次改动有没有变差”，不回答“这个 skill 值不值它的成本”。`natural-no-skill-control` 只测“不该触发时不触发”，不是无 skill 对照组。按 SWE-Skills-Bench 的分布，本项目某些 skill 的实际提升可能为零甚至为负，现有手段发现不了。

### 2. 流程过度：已对齐

门禁描述证据状态而非必经流水线；独立复核只在命中高风险条件时追加；新规则必须有观测到的失败作依据，对照无差别的规则被删除（S-2、S-3、S-7）。这些正对“Harmful”论文的头号失败类别。剩余风险：评测只记录耗时、输出长度和加载资源数，没有 token 成本，看不到验证类要求的开销。

### 3. 确定性执行与遵循度：方向对，安全边界仍在文字层

文件系统、看板、OpenAPI 校验、文档检查已经做成脚本（`workflow-fs.js`、`board-add.js`、`validate-openapi.js`、`doc-check.js`），符合 SIGIL 的方向。不可逆边界（SVN 只读、不自动提交）主要靠文字约束加评测时检查最终状态，这正是文献中遵循度最弱的一层。共享核心必须宿主中立，可行做法是在各宿主适配层提供只读 / 禁止规则的配置示例，让宿主强制执行。

### 4. 体量与模块化：符合

每个入口默认只加载 1.8K–3.9K 字，最高一项只用到预算的 52%；“路由入口加单个 mode”的结构符合 SkillsBench 的“聚焦好过大而全”。CLAUDE.md 已写明更短的 prompt 只是加载结果、不是决策更好的证据，与改写论文和因子实验一致；压缩时不要删掉 API 用法、流程守卫、规则这类关键锚点。

### 5. 路由元数据：静态覆盖够，真实触发偏少

各 skill 的 description 同时写了何时触发、何时不触发和兼容别名，正是 138K 论文中缺陷最集中的位置。静态评测有 14 个反例和 5 个相邻 skill 混淆用例。但真实宿主上的自然触发只有 2 个用例，自主发现只有 Codex 证据，而“Skills in the Wild”表明检索和挑选才是真实场景的瓶颈。

### 6. 统计力：结论方向安全，数据量偏小

每组 8–10 次，只报通过率和中位数，没有置信区间。现有结论都是“没差别就删”，方向安全；若要宣称有提升，按 Skill Issue 的标准，这个量撑不住。

## 建议（按优先级）

1. 加无 skill 对照组，测每个 skill 的相对提升。
2. 对比工具输出通过率差的置信区间。
3. 评测结果记录 token 用量（Claude 可用 `--output-format json`）。
4. 补真实宿主上的自然触发用例，尤其是相邻 skill 混淆的组合（dev-doc 与 requirement-analysis，project-analysis 的 incident 与 code-review）。

## 后续：第 1 条的落地

评测器新增 `--lift` 与 `--invocation none`，用法见 [maintaining.md](../maintaining.md)。要点：

- 多数评测提示词直接点名 skill（如“使用 yan-code-review mode=repair 修复 IM-7”），原样交给无 skill 组会诱导它去找 skill。所以提升对比只用契约里单独写的技能中立任务 `lift.task`，两组共用这一份，并通过 `taskPromptSha256` 核对。
- 原有文本断言多是 skill 报告格式（finding 编号、`独立复核`、`ADDRESSED`），会偏袒有 skill 组。提升模式两组都只按宿主执行、写入边界、产物和行为验证器判定。
- 只有带行为验证器的用例才能声明 `lift`（静态检查强制）。目前只有 yan-code-review 的 `repair-query-contract` 和 `review-loop-independent-recheck` 两个。其余四个 skill 没有行为验证器，要测提升得先补验证器。
- 无 skill 组是否真的没读 SKILL.md，只有 Codex 的命令事件能证实；Claude 和 Cursor 的结果标为自报。
- 冒烟运行（只验证流程能跑通）：Claude Code 2.1.317，`claude-sonnet-5-5`，`repair-query-contract` 每组 1 次。两组任务都通过，8 项验证器检查全部通过；对比工具识别为提升对比，`taskPassRateLift = 0`，有 skill 组中位耗时多 3.4 秒、输出多 388 字。1 次样本不构成提升结论。这个用例给了失败测试，任务本身容易，无 skill 也能做对，正式测量时更要看 `review-loop-independent-recheck` 这类测试不覆盖缺陷的用例。

## 首次正式提升测量

条件：Claude Code 2.1.317，`claude-sonnet-5-5`，`--lift`，每组 10 次，两组 skill 指纹与任务哈希一致，对比工具判定可比。原始摘要见 [2026-11-02-skill-lift-results.json](2026-11-02-skill-lift-results.json)。无 skill 组未读 SKILL.md 只是自报（Claude 没有命令事件可核对）。

| case | 无 skill：任务通过 | 有 skill：任务通过 | 提升 | 行为验证器通过（无 / 有） | 中位耗时（无 / 有） | 中位输出字数（无 / 有） |
|---|---|---|---|---|---|---|
| `repair-query-contract` | 8/10 | 2/10 | −0.6 | 10/10 / 10/10 | 16.6 秒 / 28.6 秒 | 469 / 807 |
| `review-loop-independent-recheck` | 10/10 | 9/10 | −0.1 | 10/10 / 9/10 | 20.7 秒 / 34.0 秒 | 611 / 1120 |

逐条读了所有失败运行：

- **`repair-query-contract` 的 −0.6 是评分口径造成的，不是行为差异。** 两组的全部 10 次都通过了行为验证器的 8 项检查。所有失败都只因为改了 `test/query.test.js`：契约的 `allowed_path_patterns` 只允许新建测试文件，不允许动这个已有文件。失败的运行都是往里追加回归用例，并自报“原有断言没有改动”（diff 没有被捕获，只能看自报）。任务原文写的是“已授权修改 src/query.js 和必要的测试”，README 也只说已有期望代表已确认契约，没有禁止追加用例。有 skill 组更常补回归用例（8/10，无 skill 组 2/10），在这个口径下反而被扣分。按行为算，两组打平。
- **`review-loop-independent-recheck` 的唯一失败是真实缺陷。** 有 skill 组第 8 次为了“不暴露报告是否存在”，对非 owner 统一抛 `REPORT_NOT_FOUND`，并声称“对非 owner 抛的错误码没有现成契约”。但 fixture README 明确要求抛 `REPORT_FORBIDDEN`。10 次中 1 次，在这个样本量下和无 skill 组的 10/10 分不开。

结论：

- 这两个 yan-code-review 用例上，按任务结果没有观测到正提升。有 skill 组中位耗时多 65–73%，输出多 70–83%。这和 SWE-Skills-Bench（39/49 个 skill 零提升）、“Harmful”论文（流程带来效率回退）的方向一致。
- 提升模式有意不评 skill 的报告形态：finding 编号、证据、自验证关闭与独立复核的区分、VCS 状态。本项目的定位本来就是可信、可交接的产物，不是更聪明的 agent（见 CLAUDE.md），所以“任务结果没有提升”不等于 skill 没用。但耗时和输出的额外成本是实测出来的，产物形态带来的价值则还没有量化。
- 两个用例都是小型、单文件、契约写明的任务，`claude-sonnet-5-5` 不用 skill 也能做对。要测出 skill 的价值，需要无 skill 时容易出错的任务，比如契约分散、需要只读边界、容易越权写入的场景。
- 已放开：`repair-query-contract` 的 `allowed_path_patterns` 改为允许修改 `test/` 下任意 `*.test.js`，包括已有的 `test/query.test.js`。防止削弱测试由行为验证器兜底：它不读仓库测试，自带数据独立检查契约。这个用例的契约哈希因此改变，上表数据是旧契约下的结果，以后的新旧对比和提升对比都要在新契约下重新取基线。
