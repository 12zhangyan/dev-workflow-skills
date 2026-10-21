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
