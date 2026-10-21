# 2026-10-20：finding 编号配方与 Claude 快照隔离修复

承接 [superpowers 借鉴记录](2026-10-20-superpowers-adoption.md) 中记为 S-9 第一项的基线失败：loop 的最终报告用 `F1`、`F-1`、`RV-1` 等自造编号，而不是 check mode 定义的 `CR-n / IM-n / MI-n`。

## 先修评测隔离

第一次 A/B（每组 10 次）结果为 main 2/10、新版 4/10，新版仍有 5 次用 `F1`。用 `--output-format stream-json` 单独诊断一次后发现，模型第一步调用宿主 `Skill` 工具，加载了 `~/.claude/skills/yan-code-review/SKILL.md` 中已安装的旧版入口，之后只从快照读取 loop/repair mode，快照里的 `SKILL.md` 和 check mode 都没有读取。因此这一轮 A/B 测不到根入口的改动，作废。

`scripts/run-host-evals.js` 现在对 Claude 传入 `--disallowedTools Skill`，并在自测中断言这个参数存在。同参数的诊断运行依次读取了快照中的 `SKILL.md`、loop、check、repair，没有调用 `Skill`。Codex 的 explicit 调用是否存在同类问题，本机没有 Codex，未验证。

## 改动

`skills/yan-code-review/SKILL.md` 的“输出”段增加正向配方：每条 finding 以稳定 ID 开头，后接严重度、定位、问题与当前状态，并给一个示例；同时写明不改用 `F1`、`#1` 这类自拟编号。按准入标准，这属于“输出形状错误 → 正向配方”。入口字符数从 1969 增加到 2088。

## 结果

条件：Claude Code 2.1.304，`claude-sonnet-5-5`，explicit 调用，case `review-loop-independent-recheck`，fixture `scripts/fixtures/report-ownership`，runner 已禁用 `Skill`，两侧 `--skill-source` 只有 `yan-code-review/SKILL.md` 不同，每组 10 次，每次使用独立隔离克隆。`compare-host-evals.js` 判定 comparable，无警告。

| 组 | 技能指纹 | 通过 | 首个编号 |
|---|---|---:|---|
| main | 62be2012 | 3/10 | CR-1 ×3，F-1 ×3，F1 ×2，无编号 ×2 |
| 新版 | 11e06369 | 10/10 | IM-1 ×7，CR-1 ×3 |

- 失败全部来自编号断言；两组所有运行都完成了越权修复、`node --test` 验证和独立复核/自验证关闭声明。
- 这是在已读取快照入口的条件下观察到的基线失败与修复后结果，差值为 70 个百分点，大于此前同版本约 40 个百分点的噪声。结论只适用于这个 case、这个模型和这个宿主。
- CR/IM 的严重度分歧（越权读取判为 Critical 还是 Important）在两组都存在，本轮不处理。

## 可委派复审 case

新增 case `review-loop-delegated-recheck`（`yan-code-review` eval 30）。prompt 与 eval 28 相同，只多一句“我授权你派发一个只读子 Agent 做独立复核”。此前的 case 在 Claude 非交互运行中没有派发授权，S-4/S-5 都无法触发。新 case 除原有断言外，还要求输出含 `ADDRESSED`。

stream-json 诊断一次：模型读取了快照中的 `SKILL.md`、loop、check、repair 和 `workflow-gates.md`，最终验证后调用 Agent 工具。派发说明只包含原 finding、`git diff` 位置和验证命令，没有修复者的推理，也没有“不要报”这类预判。复核子 Agent 自己跑了两次全量 `node --test`；这个 fixture 只有 4 个测试，代价可以忽略，但说明子 Agent 不会读取 check mode，S-4 的“不整套重跑”对它不生效。最终报告给出了 ADDRESSED 和 Agent 代决列表。

S-5 对照组（每组 6 次，其他条件同上）：

| 组 | 与 S-5 的差别 | 含 ADDRESSED |
|---|---|---:|
| 去掉 S-5 | 删除 check mode 复审段，以及 loop/package 中“按复审格式”的引用 | 0/6 |
| 当前 S-5（两次运行） | — | 2/6、3/6，合计 5/12 |
| S-5 加 loop 报告配方 | loop“完成与交接”加入 `IM-1 ADDRESSED — 位置` 行格式 | 4/6 |

- 第一轮 S-5 运行时 grader 写错了：契约里存的是 JSON 退格转义 `\b`，而不是正则单词边界。表中前两行按保存的输出重新判分，其余断言在全部运行中都已通过。修正后的“当前 S-5 第二次”和“加配方”两组由 `compare-host-evals.js` 判定 comparable。
- 去掉 S-5 时一次都没有出现逐条裁决；保留时约四成出现。这是 S-5 第一次有行为证据，但样本小。
- 加配方后 4/6，与 5/12 的差距在噪声内。按准入标准，这条配方没有证据支持，已撤回，没有合入。
- 有 1 次运行在已授权、也实际派发的情况下，仍写了“自验证关闭”。原因是复核子 Agent 在 `-p` 模式下没有 `git diff` 权限，转而读取当前文件。运行器只放行 `node`，子 Agent 不能运行 git，这是这个 case 的已知限制。
- 计划外发现：诊断运行中修复抛出的是 `FORBIDDEN`，fixture README 的契约是 `REPORT_FORBIDDEN`，复核者也没有发现。两个 recheck case 都没有 outcome verifier，文本断言抓不到这类契约偏差。
