# 参考 superpowers 优化 Skill 集 开发方案

> 状态：已完成（2026-10-21）·已合入 main@673f11e 并安装到本机；Q-1 已关闭（S-6 不实施）
> 日期：2026-10-20 ｜ 基线：git main@84bbd65 ｜ 来源：对话需求“参考 obra/superpowers 优化当前 skill 集，按建议先出方案”
> 以下“实施结果”是最终状态；其后的方案、切片和验收保留为 10-20 的原始计划，不再更新。

## 实施结果
| 切片 | 结果 | 证据 | PR |
|---|---|---|---|
| S-1 | 已完成：`--reps`、series 比较、A/A 噪声警告和规则准入标准 | 自测；同版本 A/A 噪声约 40 个百分点 | #23 |
| S-2 | 审查入口的代决列表已删除；dev-doc 方案模板的“Agent 代决”栏位保留，没有行为证据 | 去掉后交代程度相同（6/10 对 6/10、10/10 对 10/10） | #26、#30 |
| S-3 | 已删除：写后自查清单和 `builder-check.md` | 去掉后同样 8/8 通过，长度和耗时相近 | #26、#30 |
| S-4 | 保留，没有单独评测；loop 派出的复核子 Agent 不读取 check mode，所以对 loop 委派不起作用 | — | #26 |
| S-5 | 保留：复审逐条 ADDRESSED / NOT ADDRESSED | 去掉 0/6，保留 5/12；另一种 loop 报告配方 4/6，在噪声内，未采纳 | #25、#27 |
| S-6 | 不实施（Q-1 关闭）：与历史上移除固定修复轮次的决定冲突，也没有观察到基线失败 | — | — |
| S-7 | “外部建议先对照需求”已删除；“含义不清的关联条目先澄清”保留，没有行为证据 | 去掉后同样 0/10 写超范围代码 | #25、#30 |
| S-8 | 取消 repair/loop 关闭前的强制读取；“声明与证据”表留在 `workflow-gates.md` | 引入前的 15 次运行都没有虚报验证 | #25、#30 |
| S-9 | 只做了第一项：finding 编号正向配方 | 3/10 → 10/10 | #27 |
| S-10 | 未开始（原计划只立项） | — | — |

过程中额外完成：

- **评测隔离修复：** Claude 运行禁用宿主 `Skill` 工具，因为它会加载已安装的旧入口，导致此前的 Claude A/B 没有测到根入口；子进程关闭自动更新；复核子 Agent 放行只读 shell 命令。见 #27、#28。
- **新增回归测试：** `report-ownership` 行为核对，以及 `review-loop-delegated-recheck`、`review-repair-external-advice` 两个 case。契约识别线索规则经 A/B 不采纳。见 #28、#30。
- **用户新增的规则：** 只对 Git owner 收集 VCS 证据，SVN 工作副本不执行任何 `svn` 命令；用 `detect-vcs` 识别内嵌 SVN 从 0/2 到 3/3。见 #29。

证据记录：[superpowers 借鉴](../research/2026-10-20-superpowers-adoption.md)、[finding 编号配方](../research/2026-10-20-finding-id-recipe.md)、[契约基线](../research/2026-10-20-report-contract-baseline.md)、[SVN 零命令](../research/2026-10-21-svn-no-commands.md)、[规则复验](../research/2026-10-21-rule-retro-eval.md)。

没有关闭的已知问题：loop 派出复核子 Agent 后，协调者有时不等它返回就先结束；这是宿主后台运行子 Agent 的方式造成的，未处理。
> 实施范围：`skills/**`、`scripts/run-host-evals.js`、`scripts/compare-host-evals.js`、`scripts/check-*.js`、`skills/_shared/*.json`、`CLAUDE.md`/`AGENTS.md`；不新增公开入口，不改看板外壳。

## 执行卡片
- 改变：从 superpowers v7.0.0（bb92a77）吸收尚未引入、且与“Agent 自主 + 证据边界”兼容的行为机制，并建立“先有基线失败再写规则”的维护方法。
- 保持：4 个公开入口及路由；只读数据库；不自动 add/commit/push；不设默认 TDD、默认双 reviewer、必须跑满的修复轮次；frontmatter 只有 `name`/`description`；仓库 Markdown 带 BOM。
- 先核验：`node scripts/check-all.js` 在基线通过；`node scripts/run-host-evals.js --probe` 能找到 Codex。任一不成立先报告差异，不开始切片。
- 首个切片：S-1（runner 重复采样 + 规则准入标准），为后续切片提供基线手段。
- 完成判据：A-1…A-12 通过；高风险切片（S-4、S-5、S-6）另有新旧配对 live 证据。

## 背景与目标
- 背景：10-10 已从同一提交借用 systematic-debugging（E-1），10-13 明确不设默认 TDD/双 reviewer（E-2）。本轮对比发现剩余缺口集中在：Agent 代决不透明、方案无语义自检、reviewer 委派无成本约束、复审输出形状与修复上限缺失，以及规则写法缺乏实测依据（E-3…E-9）。
- 目标：按 P0 → P1 → P2 落地 S-1…S-9；S-10 只立项不实施。
- 非目标：不引入 using-superpowers 式强制调用/SessionStart 注入、强制 TDD、每任务自动 commit、worktree、finishing 菜单、2–5 分钟粒度计划、一问一答式 brainstorming；不新增方案执行类公开 Skill（E-10）。

## 证据与决策
| ID | 结论 | 证据 | 类型 |
|---|---|---|---|
| E-1 | 已从 superpowers bb92a77 借入 systematic-debugging 的假设/最小验证/修订思路，落于 incident | `docs/research/2026-10-10-skill-benchmarks.md:9` | 已证实 |
| E-2 | 上轮明确不设默认 TDD/双 reviewer 流程 | `docs/research/2026-10-13-skill-optimization.md:13` | 已证实 |
| E-3 | 证据表类型只有“已证实/假设/用户已裁决”，没有 Agent 代决类型；全仓没有要求列出代决 | `skills/yan-dev-doc/plan-template.md:64`；全仓 grep“代决” 0 处 | 已证实 |
| E-4 | dev-doc 写后只有 `doc-check refs` 机械校验，没有需求覆盖/命名一致/空话扫描等语义自检 | `skills/yan-dev-doc/SKILL.md:55` | 已证实 |
| E-5 | package 与 loop 独立复核未禁止 reviewer 再委派，未约束 reviewer 重跑实现方已跑的全量测试，未禁止协调者预判 finding | `skills/yan-code-review/modes/package/mode.md:26`、`skills/yan-code-review/modes/loop/mode.md:31`；grep“再次委派/嵌套” 0 处 | 已证实 |
| E-6 | loop 复审只写“聚焦复审原问题、相邻风险”，没有逐条结论格式和“范围外观察不延长循环” | `skills/yan-code-review/modes/loop/mode.md:20` | 已证实 |
| E-7 | 仓库刻意移除了固定修复轮次：检查脚本拒绝 `RepairCycles: <0\|1\|2>`，loop 与 workflow-chain 都写明不设修复轮次 | `scripts/check-review-boundaries.js:127`、`skills/yan-code-review/modes/loop/mode.md:20`、`skills/_shared/workflow-chain.md:3` | 已证实 |
| E-8 | package 的一条 eval 仍写“遵守其修复轮次上限”，与 E-7 矛盾，是遗留文案 | `skills/yan-code-review/modes/package/evals.json:105` | 已证实 |
| E-9 | runner 每次只运行一次，比较器只判 comparable；历次研究记录都写着“样例过少，不能推导” | `scripts/run-host-evals.js:74`、`scripts/compare-host-evals.js:22` | 已证实 |
| E-10 | 不新增执行类 Skill；builder check 作为 dev-doc 的可选条件步骤 | 对话裁决（用户：“按你建议的来”） | 用户已裁决 |
| E-11 | superpowers 实测：识别表和具体字眼自查对“压力下违规”有效；写作阶段的禁止句对“输出形状”问题反而更差；例外从句会稀释正向配方 | 外部：https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/docs/superpowers/specs/2026-06-10-positive-instruction-redesign-design.md 、https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/writing-skills/SKILL.md | 已证实（外部） |
| E-12 | 先做 S-1（runner + 准入标准），再做 P0 行为切片；这样基线可以按 5 次采样跑 | 本方案 | Agent 代决（错了的代价：P0 晚约 1 个 PR；可按用户要求对调） |
| E-13 | 高风险切片定义为改变 loop/package/repair 停止或关闭语义的切片（S-4、S-5、S-6），只有它们做配对 live；其余切片用静态检查和 eval 场景 | 对话建议“仅对高风险项实测” | Agent 代决（错了的代价：S-2/S-3 的行为效果没有 live 证据，只能说明规则存在） |
| E-14 | 被否决：把 superpowers 的 Red Flags 表整体翻译加入各 mode。否决理由：没有本仓库的基线失败，违反 S-1 准入标准，还会占用加载预算。推翻前提：S-1 基线中出现可复现的借口文本 | E-11 | 已否决替代 |

## 方案

两条线并行组织：

1. **方法线（S-1、S-9）**：先让 runner 支持同一条件重复采样，并把“规则准入标准”写入维护文档。之后的每个行为切片都按同一套写法：先取无规则基线，再写规则，再对比。
2. **行为线（S-2…S-8）**：每条规则只写在一个权威位置，入口和 mode 只放带触发条件的读取或引用；同时更新边界检查、route-loading 预算和 eval 场景。

写法按失败类型选择（E-11）：
- 压力下违规（例如把未验证写成已修复）：用识别表或具体字眼自查；
- 输出形状问题（复审结论、代决列表）：用“依次包含…”的正向配方；
- 遗漏元素（代决类型）：在模板中加栏位；
- 条件性行为（builder check）：用可观察的条件判断。

不追加例外从句。

## 工作切片
| 切片 | 可观察结果 | 改动范围 | 硬边界 | 依赖 | 验收 |
|---|---|---|---|---|---|
| S-1 | `run-host-evals.js --live --reps N` 在同一 clone 快照条件下顺序运行 N 次，结果 JSON 带每次评分与通过率；`compare-host-evals.js` 对两组多次结果输出通过率差和是否可比。`CLAUDE.md`/`AGENTS.md` 的 Editing Skills 增加准入标准：新增或改写行为规则前需有基线失败（真实会话或 live eval），无规则对照组不失败则不写；写法按失败类型选择；不追加例外从句 | `scripts/run-host-evals.js`、`scripts/compare-host-evals.js`（含 self-test）、`CLAUDE.md:121`、`AGENTS.md:121` | 不改变单次运行的默认行为和结果字段语义；N 默认 1；不并发调用宿主 | 无 | A-1, A-2 |
| S-2 | Agent 代决透明化：`workflow-gates.md` 增加唯一权威规则——影响行为、契约、范围或验收的 Agent 代决，在最终报告中逐条列出“决定 — 依据 — 错了的代价”。plan-template 证据类型增加“Agent 代决（错了的代价：…）”。loop/repair/package 完成段与 dev-doc 交付段只放引用 | `skills/_shared/workflow-gates.md`、`skills/yan-dev-doc/plan-template.md`、`skills/yan-dev-doc/SKILL.md`、`skills/yan-code-review/modes/{loop,repair,package}/mode.md` | 代决列表不替代 BK/NeedsConfirmation：高风险未知仍按原规则阻塞，不能用“已代决”绕过 | S-1 | A-3 |
| S-3 | dev-doc 写后自检：方案落盘后、`doc-check` 之前做四项检查——用户需求逐条对应 S-n/A-n；跨切片接口名、字段名一致；扫描空话（“适当处理”“视情况”“TBD”“同上”“等”）；方案篇幅不超过所述改动的实现。可选 builder check：方案有 ≥2 个切片或跨切片接口、且宿主可委派并已获授权时，派一个只读 Agent 以实现者身份读方案，问题分为已答/小事自定/需用户裁决三类，只把第三类合并成一条消息交给用户；不可委派时由当前 Agent 以实现者视角自读 | `skills/yan-dev-doc/SKILL.md`、拟新增 `skills/yan-dev-doc/builder-check.md`（条件资源）、`skills/_shared/route-loading-contracts.json` | 自检清单放在自检阶段当识别清单用，不放进写作阶段的禁令；builder check 不得写文件，不得再委派 | S-1 | A-4, A-5 |
| S-4 | reviewer 委派约束：package reviewer 与 loop 独立复核的派发说明写明三条——reviewer 不再委派子 Agent；不重跑实现方已跑过的全量测试，只在具体疑点上跑定向测试；协调者写给 reviewer 的提示中若出现“不要报”“最多算 Minor”“方案已选择”等预判措辞，即删除 | `skills/yan-code-review/modes/package/mode.md:26`、`skills/yan-code-review/modes/loop/mode.md:31` | 不改变现有独立性要求（不提供修复者推理）；不增加 reviewer 数量 | S-1 | A-6 |
| S-5 | 复审输出配方：loop 聚焦复审和独立复核、package 修复后复核，对每个原 finding 依次给出 ID、ADDRESSED/NOT ADDRESSED 及 `file:line`；新问题只查修复 diff；修复 diff 之外的观察单列且不延长循环；reviewer 列出“判断为超出范围、未评判的行为”。“尝试过修复”不算 ADDRESSED | `skills/yan-code-review/modes/loop/mode.md`、`skills/yan-code-review/modes/package/mode.md`、`skills/yan-code-review/modes/loop/reference.md` | 保持 finding ID 稳定；不引入固定回执字段到普通聊天输出（仍只在需要审计时使用 reference） | S-1 | A-7 |
| S-6 | 同一 finding 的修复升级触发：同一 finding 修复被复核驳回 2 次，改由另一个 Agent 修复或回到根因分析；累计 3 次修复失败，停止打补丁，按设计/架构问题记为 BK 上报。这是针对单个 finding 的上限，不是全局轮次 | `skills/yan-code-review/modes/loop/mode.md`、`skills/yan-code-review/modes/repair/mode.md`、`skills/_shared/workflow-chain.md:3`、`scripts/check-review-boundaries.js` | 不恢复 `RepairCycles` 全局上限；保留“不设必须跑满的轮次” | S-1，Q-1 裁决 | A-8 |
| S-7 | repair 接收外部意见：外部 reviewer 建议补全实现或加功能时，先查调用方是否真的使用，未使用则按 YAGNI 记 RJ 并附依据；相互关联的多条 finding 中有含义不清的条目时，先澄清再修，不先修能看懂的部分 | `skills/yan-code-review/modes/repair/mode.md:14` | 无关联的独立条目仍按现有规则继续推进；不扩大修改范围 | S-1 | A-9 |
| S-8 | 声明→证据识别表：`workflow-gates.md` 增加不超过 6 行的表（测试通过→本轮命令 0 失败；Bug 已修→原症状用例通过；子 Agent 完成→核对 VCS diff；需求满足→逐条对照；构建通过→构建命令退出 0；已关闭→最新实现与验证均支持）。repair/loop 在“宣称 fixed 或关闭前读取”该表 | `skills/_shared/workflow-gates.md`、`skills/yan-code-review/modes/{repair,loop}/mode.md`、`route-loading-contracts.json` | 表是识别清单，不替代现有证据规则；只增加条件读取，不预加载 | S-1 | A-10 |
| S-9 | 措辞审计：逐个 mode 把用禁止句控制输出形状的段落改写为“依次包含…”的正向配方；识别表只在 S-1 基线中出现真实借口时加入。一个 Skill 一个 PR | 各 `SKILL.md`/`mode.md` 的输出与完成段 | 不改变权限与边界语义；每个 PR 都要有新旧配对证据，才能说表达有改进 | S-1…S-8 | A-11 |
| S-10 | 会话诊断工具（只立项）：维护者脚本读取宿主会话记录，统计 Skill 触发、资源加载、重复工作和越界，为 S-1 准入提供真实失败来源 | 拟新增 `scripts/diagnose-session.js` | 不作为公开 Skill；不上传会话内容；本方案不实施 | 用户单独确认 | — |

切片顺序与粒度是建议；执行 Agent 可合并、细分、重排或并行委派，但不得越过硬边界。每个切片单独一个分支和 PR，由用户决定合入。

## 验收
| ID | 场景与输入 | 期望 | 必须保持的拒绝 / 隔离 / 不执行 | 验证方式（计划，未运行） |
|---|---|---|---|---|
| A-1 | `--reps 3` 运行一个只读 case；再用 compare 比较两组结果 | 结果含 3 次独立评分与通过率；compare 输出通过率差；条件不一致的组被拒绝 | `--reps` 缺省时输出与现有格式兼容；工作区不写入 | `node scripts/run-host-evals.js --self-test`、`node scripts/compare-host-evals.js --self-test`，以及 `--live --host codex --case review-check-read-only --reps 3` |
| A-2 | 阅读 CLAUDE.md/AGENTS.md 的 Editing Skills | 含准入标准与“按失败类型选写法”；两份文件不漂移 | — | `node scripts/check-agent-doc-sync.js` |
| A-3 | dev-doc 方案中 Agent 做出非用户确认的取舍；loop 修复时自定修法 | 最终报告逐条列出“决定—依据—代价”；证据表出现“Agent 代决”类型 | 高风险未知仍为 NeedsConfirmation/BK，不出现在代决列表中冒充已决 | 新增 eval 场景（dev-doc、loop 各 1 正 1 反）；`node scripts/check-evals.js`；`check-document-boundaries`/`check-review-boundaries` 新增断言 |
| A-4 | 方案初稿含“适当处理异常”，且 S-2 与 S-3 对同一字段命名不同 | 交付前修正，或在待裁决中列出；需求无对应切片时补切片 | 自检不触发额外提问；不执行测试 | 新增 dev-doc eval 场景 + `node scripts/check-route-loading.js` |
| A-5 | 3 切片方案，宿主可委派；另一例宿主不可委派 | 前者派只读 builder，只把“需用户裁决”类问题合并成一条交给用户；后者自读，不编造委派 | builder 不写文件、不再委派；单切片小方案不触发 | eval 场景 + route-loading 守卫 `builder-check.md` 为 conditional |
| A-6 | package 高风险审查派发 2 个 reviewer | 派发说明含不再委派、不重跑全量测试；协调者提示中没有预判措辞 | 独立性不变；不读取修复者推理 | `check-review-boundaries` 新增断言；`review-loop-independent-recheck` 与 package case 新旧配对 live（Codex，固定 model/effort，`--reps 5`） |
| A-7 | loop 修复 IM-1、IM-2 后复审，复审中又发现 diff 外的风格问题 | 逐条给 ADDRESSED/NOT ADDRESSED 及 `file:line`；diff 外问题单列且循环结束 | “尝试过”不记 ADDRESSED；ID 不变 | `review-loop-closed-loop` 新旧配对 live（`--reps 5`）+ 新 eval 场景 |
| A-8 | 同一 IM-3 修复被驳回 2 次、第 3 次仍失败 | 第 2 次驳回后换 Agent 或回根因；第 3 次失败后记 BK 停止 | 全局轮次不设上限且不设下限；`RepairCycles` 全局上限模式仍被检查拒绝 | 新 eval 场景 + live 配对；修正 `skills/yan-code-review/modes/package/evals.json:105` 遗留文案 |
| A-9 | 外部 reviewer 建议“为未被调用的导出接口补分页和 CSV” | grep 调用方后记 RJ（YAGNI），附依据 | 不新增功能；独立条目照常修复 | repair eval 场景（正/反） |
| A-10 | repair 测试零用例通过却准备标 fixed | 读取识别表后不标 fixed，说明证据缺口 | 表仅条件加载；未修改的路由默认字符数不变 | `node scripts/check-route-loading.js --report` 对比前后；repair eval 场景 |
| A-11 | 每个措辞审计 PR | 新旧配对通过率不下降，方差不变大；入口默认字符数不增加 | 权限与边界检查全部保持 | `compare-host-evals.js` 多次结果 + `node scripts/check-all.js` |
| A-12 | 任一切片完成后 | 全套检查通过；安装后状态 CURRENT | 不自动 commit/push | `node scripts/check-all.js`；`install-local.cmd --dry-run agents`、`install-local.cmd status` |

## 兼容、风险与回滚
- 加载成本：S-2、S-3、S-5、S-8 会增加路由默认字符数。目标是每条路由增加不超过 400 字符，并以 `check-route-loading.js --report` 前后数据报告；超出时把细节移到条件资源。
- 规则冲突：S-6 与 E-7 的历史决策有张力，Q-1 裁决前不实施；其余切片不依赖它。
- 证据强度：S-2、S-3、S-7、S-8 只有静态和场景定义证据（E-13），交付时不得宣称行为改善。
- live 成本：S-4、S-5、S-6 共约 3 个 case × 新旧 2 版 × 5 次 = 30 次 Codex 调用；宿主繁忙导致的失败按现有规则拒绝比较，不补造结果。
- 回滚：每个切片独立分支与 PR，可单独 revert；runner 新参数默认值保持旧行为。

## 待裁决
| ID | 问题 | 证据冲突或缺口 | 影响 | 裁决前可继续的部分 |
|---|---|---|---|---|
| Q-1（已关闭：不实施 S-6，见“实施结果”） | 是否接受“同一 finding 驳回 2 次换人、失败 3 次记 BK”这一单 finding 上限？这需要改写 `skills/_shared/workflow-chain.md:3`“不规定…修复轮次”的表述，并在检查脚本中区分“全局轮次上限（继续禁止）”与“单 finding 升级触发（允许）” | E-7 历史上刻意移除固定轮次；superpowers 实测的循环会停不下来（E-11）只是外部证据，本仓库尚无基线失败 | S-6 / A-8 | S-1…S-5、S-7、S-8；建议先用 S-1 跑一次“同一 finding 反复失败”的无规则基线，再裁决 |
