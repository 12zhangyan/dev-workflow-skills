# 跨 Agent Skill 优化：文献依据与验证记录

检索日期：2026-10-10。面向所有具备所需能力的 Agent；厂商、模型和 CLI 是适配维度，不是 Skill 核心的限定。此次纳入的已核实近期论文更新到 2026-10-08；这不是穷尽所有论文的“最新榜单”。优先作者论文、开放规范和厂商一手资料，区分研究结果、工程实践和本仓库推论。

## 论文与采用边界

| 文献 | 日期/版本 | 证据性质 | 本仓库采用与限制 |
| --- | --- | --- | --- |
| [TestPrism: Rethinking Test Evaluation Beyond a Single Reference](https://arxiv.org/html/2610.12289v1) | 2026-10-08 | 预印本；对多种正确/错误实现评价测试 | 评分必须接纳等价实现、拒绝错误；本轮取消 filter/slice 字面限制，加入循环版正确实现与相邻回归反例。 |
| [SquidAgent: Parallelize Wisely, Coordinate Efficiently](https://arxiv.org/abs/2610.08647) | 2026-10-06 | 预印本；并行协调与重复探索成本 | 按独立结果和协调成本选择委派，不规定角色数、任务数或必须并行。 |
| [ReFold: Training-Free Reversible Inter-Turn Context Folding for Long-Horizon Agents](https://arxiv.org/abs/2610.07863) | 2026-10-06 | 预印本；可恢复的运行时上下文折叠 | 保留证据索引与来源；运行时压缩算法属于宿主实现，不伪装成一段 Skill 指令即可获得同等效果。 |
| [Agent Skill Evolution: How Revisions Affect Coding Agents](https://arxiv.org/html/2610.04832v1) | 2026-10-04 | 预印本；修订对动作执行、正确性与成本的影响 | 保留旧版快照，控制任务/评分器；区分遵从措辞、实际行动和完成结果。局限包括机械可判定规则偏置和样本范围，不把论文增益当本仓库增益。 |
| [SkillScriptBench: Benchmarking Self-Evolution of Executable Agent Skill Packages Beyond Markdown](https://arxiv.org/html/2610.04008v1) | 2026-10-02 | 预印本；区分文档修复、脚本修复和保持原行为 | 本轮同时检验缺陷修复和仍有效的契约，原测试不可改；不因文档优化而无依据重写脚本。 |
| [Beyond the Model: Demystifying Harness Effects in Software Engineering Agents](https://arxiv.org/html/2609.32459v1) | 2026-09-26 | 预印本；包含 Qwen/DeepSeek 与不同 harness 的实验 | 能力与任务适配，不强制通用子 Agent/上下文压缩；结论受所测模型家族和基准限制。 |
| [What’s in Your Agent’s Context? Context Privilege Escalation Attacks against AI Agent Harness](https://arxiv.org/html/2609.01222v2) | 2026-09-02（v2；首版 09-01） | 预印本；分析跨来源、跨作用域的上下文权限提升 | 交接和 Brief 保留来源与授权边界；外部材料中的命令不升级成用户授权。提示规则不是安全沙箱。 |
| [Evaluating Skills, Not Just Agents: Agentic Continuous Evaluation of Skills（ACES）](https://arxiv.org/html/2608.20614v1) | 2026-08-20 | 作者预印本；仓库级成对 live 评测 | 同任务、workspace、harness、模型、grader 比较；只声明实际控制的变量和观测结果。 |
| [SkillsBench](https://arxiv.org/abs/2602.12670) | 2026-02-13 | 跨任务与模型配置的 Skill 评测论文 | 收益依赖任务；不把论文中的最佳模块数变成所有 Skill 的固定结构。 |
| [Evaluating AGENTS.md](https://www.sri.inf.ethz.ch/publications/gloaguen2026agentsmd) | 2026（MemAgents @ ICLR） | 作者实验室论文页；仓库指令效果研究 | 只保留能改变决策的上下文；不将近期抓取日期写成新论文发布日期。 |

以上新论文多数是预印本；这里采纳可验证的工程启发，不把少数模型/基准的结论当作普遍规律。部分论文彼此呈现不同的上下文成本与成功率结果，这正是保留对照、测量实际收益而不是持续加规则的原因。

## 开放规范与不同宿主实践

- [Agent Skills specification](https://agentskills.io/specification)：厂商中立的目录/元数据格式；保持共享 name/description 和相对引用。
- [Agent Skills — Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills)：旧版/新版对照、真实产物、避免字面措辞评分。
- [Agent Skills — Best practices](https://agentskills.io/skill-creation/best-practices)：按需加载、只写新增信息、让模型选择合理执行方式。
- [Anthropic — Demystifying evals for AI agents（2026-01-09）](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)：区分轨迹与环境结果、能力评测与回归、代码/人工评分；不是只看 Agent 自报。
- [OpenAI — Testing Agent Skills Systematically with Evals](https://developers.openai.com/blog/eval-skills)：采用任务—轨迹—产物—评分思路；不将 Codex 专用事件格式加入共享 Skill。
- [Gemini CLI — Agent Skills](https://geminicli.com/docs/cli/skills/)：核实开放格式在非 OpenAI 宿主的使用；具体发现/启用方式留给宿主。
- [GitHub Copilot — About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)：同样使用 Skill 目录；格式兼容不等于本仓库已做该宿主端到端验证。

## 本轮落实

1. README、项目规则与宿主能力协议明确共享核心按读取/搜索、范围内写入、运行验证等能力适配。当前 CLI 适配器仍是 Claude Code、Cursor、Codex；其他宿主的自动发现和端到端行为不宣称已测。缺少委派或结构化问题工具不阻塞独立可做工作。
2. handoff、Workflow Brief 与交互策略保留授权来源、易变证据的版本/时间。第三方材料中的命令不能被摘要洗成用户授权；也不因此撤销已由用户提供的有效授权。
3. `run-host-evals.js --skill-source <旧版完整 skills 目录>` 允许同任务、同评分器比较旧版和当前版。记录 Skill、任务提示、评分契约、fixture revision 指纹及宿主版本；未显式指定模型时如实记录默认模型未由 runner 独立解析。
4. 运行快照排除 `evals.json`、`host-contracts.json`、`route-loading-contracts.json`，避免把预期答案和评分定义一起提供给被评 Agent。这是材料分离，不是阻止访问任意外部文件的安全沙箱。
5. 分页修复案例由仓库外侧的可信评分器运行 8 项行为检查，并检查评分器自身未改变隔离工作区。删除 filter/slice 的实现措辞评分；自测验证初始错误、仅塞关键词、破坏大小写规则均不能通过，两个不同正确实现均可通过。只对声明了该 verifier 的 fixture 执行，不接受任意 shell 命令。
6. 新增 4 个场景定义，涵盖交接污染与相邻反例、未列名宿主的能力降级、共享写入冲突；不新增公开 Skill、默认资料链接或强制步骤。

## 复跑方式与证明边界

使用仓库 `scripts/fixtures/repair-query-contract` 的独立临时 Git 基线（初始化/提交仅针对临时测试材料，不碰用户工作区）。

```text
node scripts/run-host-evals.js --probe
node scripts/run-host-evals.js --live --host <可用宿主> --case handoff-source-boundaries --workspace <临时fixture> --skill-source <旧版skills目录> --output <仓库外old.json>
node scripts/run-host-evals.js --live --host <同一宿主> --case handoff-source-boundaries --workspace <同一fixture> --output <仓库外new.json>
node scripts/run-host-evals.js --live --host <可用宿主> --case repair-query-contract --workspace <临时fixture> --allow-write --output <仓库外result.json>
```

对照需要固定模型与配置、同任务、同评分器、同 fixture；输出/关键词、行为结果、写入边界分别报告。自然语言结果仍需核对内容，文本命中不等于语义正确。成本只能比较同配置的实际记录；一次样例不能证明总体增益。此阶段 runner 显式指定 Skill，尚未评估自然自动触发率；随后新增的目录选择与原生发现验证见 [收尾记录](2026-10-10-optimization-baseline.md)。CLI 可用不等于已登录或某场景通过。行为评分器会执行隔离 fixture 的代码，不是对恶意代码的 OS 沙箱；只用于这里明确的离线测试材料。

## 本轮验证结果（2026-10-10）

- `node scripts/check-all.js`：通过。包含 4 个公开 Skill、11 套 eval 文件的 202 个场景定义校验、31 个宿主行为契约及全部边界/安装/同步检查；这些数字不是 live 模型通过数量。
- `node scripts/check-route-loading.js --report`：仍为 11 条入口/模式路由、24 份预算内资源；本轮没有新增默认加载链接。保持原有按需加载结构。
- 评分器自测：原缺陷、只放 filter/slice 关键词的假修复、大小写语义回归及幂等修改输入对象的实现均失败；数组过滤和循环遍历两种正确实现均通过。已有模型改动不再误算为评分器改动；评分器文件、索引、Git 元数据及提交变化仍会被拦截。

| 实测 | 观测结果 | 证明边界 |
|---|---|---|
| Codex / 旧版交接 | 151.2 秒；零文件变化；保留真实修复授权、拒绝第三方虚构授权，区分 A/B 与当前源码证据 | 原自动评分只因 `chat-only` 路由别名不在白名单失败；纳入等价别名后重新评分通过，原始记录保留。 |
| Codex / 新版交接 | 155.3 秒；零文件变化；来源、版本和下一步边界可恢复 | 原自动评分只因 `chat` 别名失败；同一规则修正后通过。两版该样本均满足要求，不能据此证明新版增益。 |
| Codex / 最终评分器的分页修复重跑 | 108.0 秒；仅 `src/query.js` 变化；独立评分器 8/8 通过；评分器前后工作区、索引、HEAD 和元数据无变化 | Agent 报告原有离线测试修复前 2/6、修复后 6/6；8/8 为 runner 独立执行结果。仅证明该离线 fixture，不外推真实业务或所有宿主。 |
| Cursor / 新版交接 | 调用返回 Authentication required；未修改工作区 | 登录环境阻塞，没有模型行为结果；未修改用户认证配置。 |
| Claude Code | 本机未找到 CLI | 未执行 live。Gemini CLI、Copilot、OpenCode、OpenHands 亦未做端到端实测。 |

旧版与新版交接使用同一 fixture revision `a97cc11fa42ac9867477ee12342c54990e108179`、任务和评分逻辑；诊断均显示 `gpt-6-astra`，但调用未显式固定模型，结果保留 `host-default-not-resolved`。旧版 Skill 指纹为 `db3b6b6073e56a78c70a1748f7f4fa84c426e093213aad5fce3ad33ef1dd93ef`，新版为 `c9de88481d3662c287f75dfc8c84752d1a75cc3a22c90bceaf1a82190b12a2f0`。这是一组回归观察，不是严格控制配置、多次重复的因果增益实验；耗时差异不作性能结论。

首次分页修复的 8 项行为检查已经通过，但 verifier 无写入判断错误复用了“模型从干净工作区开始”的规则，把已有合法改动误判为 grader 写入。修复为独立比较 grader 运行前后快照，加入脏工作区与实际写入回归测试，随后重新执行 live 并通过。没有删除初次失败记录或把它重写成通过。随后补充输入污染反例，复现了候选实现修改共享测试对象会污染预期基准的问题；评分器在执行任何候选代码前保存原始输入，再核验共享输入和独立输入副本，反例由误通过变为正确拒绝。

已执行 `install-local.cmd --dry-run agents`、`install-local.cmd agents` 和 `install-local.cmd status`；共用 agents 根目录状态为 CURRENT。安装后逐字节核对 63 个文件（仅入口 SKILL.md 去除 BOM），4 个公开 Skill 的元数据验证均通过。安装状态中的 Git revision 不包含未提交差异，因此文件一致性另外校验；这轮改动保留在工作区，未提交或发布。

## 中断审查的续修（2026-10-10）

接续当天未完成的整体审查，在已有工作区改动上修复以下四处已验证缺陷。本轮针对确定性的脚本行为，未增加 Skill 入口、依赖或模型调用。

| 问题 | 修复与回归证据 |
| --- | --- |
| 看板详情路径越界 | 校验 detailId 与规范 detailPath，拒绝目录链接/重复详情身份；修复前隔离样例成功退出并改写目录外的哨兵文件，修复后非法标识、历史非法路径和 Windows junction 均被拒绝，原文件保留。 |
| 并发发布静默丢条目 | 发布与迁移共用独占锁，每个目录/详情文件用原子替换。确定性屏障让两个旧版写入者基于同一旧目录写入，均成功但最终仅一条；新版明确拒绝占用者，重试后两条目录及详情均存在。锁不自动抢占；进程异常退出留下的锁需核实持有进程后再处理。 |
| 安装回滚误删恢复原件 | 技能恢复、清单恢复或新版清理任一步失败时，保留恢复目录并报告路径。三种故障注入均保留原始内容；同一用例对修复前脚本能识别原件丢失。 |
| 评测 JSON 与退出状态不一致 | assessment 纳入宿主退出码、信号、超时和输出错误。非零退出、超时、信号终止、输出溢出及缺失执行结果均不能因语义断言满足而通过；修复前逻辑会误通过。 |

验证：

- 修改前与代码修复后均执行 `node scripts/check-all.js`；最终全部通过，包括 202 个场景定义、31 条静态宿主契约、看板版本 29 的两份外壳同步、安装和边界检查。
- 单独执行 `node scripts/check-board-behavior.js`、`node scripts/check-installers.js`、`node scripts/run-host-evals.js --self-test`；新增回归通过，并用仓库外的修复前副本验证其能识别真实缺陷。
- `install-local.cmd --dry-run agents`、`install-local.cmd agents`、`install-local.cmd status agents` 均成功，状态 CURRENT。安装后的 63 个文件逐字节符合当前源码，仅入口 SKILL.md 按约定去 BOM；sourceTreeHash 为 `fa79e9ae835cfce72689199fbacccde3d86559fa13170e60d09e80d5f106c3a9`。
- 改动前保存文件与 diff 基线，核对任务外的原有改动保持一致；没有提交、推送或修改 hlcloud。本轮为 Windows 本地和隔离故障场景验证，未新增其他平台 CI 或真实模型端到端结果。
