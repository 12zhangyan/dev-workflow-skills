# 2026-10-20：参考 superpowers 的 P0/P1 落地与重复采样证据

方案见 [参考 superpowers 优化 Skill 集](../2026-10-20/参考superpowers优化Skill集.md)。参考版本为 obra/superpowers v7.0.0（bb92a77），沿用 10-10 已引入的 systematic-debugging，不引入强制调用、强制 TDD、自动提交或第 5 个公开入口。

## 已落地

| 切片 | 内容 | 证据类型 |
|---|---|---|
| S-1 | `run-host-evals.js --reps N`、series 比较、两侧技能指纹相同时的 A/A 警告；AGENTS/CLAUDE 写入规则准入标准 | 自测 + 1 组 live（3/3） |
| S-2 | 审查报告与方案逐条列出 Agent 代决（决定 — 依据 — 错了的代价） | 静态守护 + eval 场景；无基线失败记录 |
| S-3 | dev-doc 落盘后自查；多切片时实现者试读（`builder-check.md`） | 静态守护 + eval 场景；无基线失败记录 |
| S-4 | 内部 reviewer 不再委派、不整套重跑测试；协调者删除预判措辞 | 静态守护 + live 回归样本 |
| S-5 | 复审逐条 ADDRESSED/NOT ADDRESSED，diff 外观察不延长循环 | 静态守护 + live 回归样本 |
| S-7 | repair 对外部建议先查调用方；关联 finding 含义不清时先澄清 | 静态守护 + eval 场景 |
| S-8 | workflow-gates“声明与证据”表，repair/loop 关闭前对照 | 静态守护 + eval 场景 |

S-6（同一 finding 修复升级触发）未实施：与历史上移除固定修复轮次的决定冲突，尚无本仓库基线失败。S-9、S-10 未开始。

## live 结果

条件：Claude Code 2.1.304，`claude-sonnet-5-5`，explicit 调用，case `review-loop-independent-recheck`，fixture `scripts/fixtures/report-ownership`（本轮补齐，之前该 case 缺少 fixture 无法运行），每组 5 次，每次独立隔离克隆。机器可读摘要见 [results.json](2026-10-20-superpowers-adoption-results.json)。

| 组 | 技能指纹 | 通过 |
|---|---|---:|
| main 基线 A | b49c7214 | 0/5 |
| main 基线 B（误作新版运行，见下） | b49c7214 | 2/5 |
| P0 | 606203e4 | 2/5 |
| P1 | 6e4224c4 | 2/5 |

- **同版本噪声已达 40 个百分点。** 基线 B 本应运行 P0，因 shell 分组只把 `cd` 作用于第一个后台任务，实际运行了 main 技能；两组完全相同的技能得到 0/5 与 2/5。比较器因此新增指纹相同警告。合并后 main 为 2/10，P0、P1 各为 2/5，差异在噪声范围内：**本轮只支持“未见回归”，不支持任何改善结论。**
- **所有失败都源于同一条断言：** 输出中没有 `CR-n/IM-n` 编号，改用 `F1` 等自造编号；15 次中 15 次都完成了越权修复、`node --test` 验证，并按规则声明独立复核或自验证关闭。这是 check mode 编号规则的真实基线失败，按准入标准属于“输出形状/遗漏元素”类，适合用正向配方或模板栏位处理，列为 S-9 的第一项。
- **S-4/S-5 规则未被这个 case 真正触发：** Claude 非交互运行未获派发授权，所有运行都走自验证关闭，没有派出 reviewer；P1 的 5 次输出均未出现 ADDRESSED 逐条格式。说明 loop 自身的聚焦复审没有采用 check mode 的复审格式，“按 check mode 的复审格式”这类跨文件引用可能不足以约束形状。需要能触发委派的宿主条件或专门的复审 case 才能评价。
- A-1：`review-check-minimal-loading` 在 main 上 `--reps 3` 为 3/3，用于确认运行器与比较器的真实文件路径。
- **更正（同日稍晚）：以上 Claude 样本都没有测到快照里的根入口。** 用 stream-json 诊断发现，模型先调用宿主 `Skill` 工具，加载了 `~/.claude/skills/yan-code-review/SKILL.md` 中已安装的旧版入口，然后只从快照读取 loop/repair mode，没有读取快照里的 `SKILL.md` 或 check mode。因此，S-2 中写在根入口的 Agent 代决，以及 check mode 的编号与复审格式，在这些样本里都没有生效；“未见回归”只对快照中实际读到的 mode 文件成立。runner 已改为对 Claude 传入 `--disallowedTools Skill`，后续结果见 [finding 编号配方](2026-10-20-finding-id-recipe.md)。

## 未覆盖

- Codex 本机不可用，本轮没有 Codex 样本，不与 10-10/10-13 的 Codex 结果直接比较。
- S-2、S-3、S-7、S-8 只有静态守护和 eval 场景定义，没有行为样本。
- 加载成本（`check-route-loading.js --report`，相对 main）：dev-doc 3495→3753，review 入口 1840→1969，check 2558→2796，repair 2096→2314，loop 2181→2337，package 2324→2431 字符。
