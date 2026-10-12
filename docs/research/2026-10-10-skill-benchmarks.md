# 开发工作流 Skill 参考与本轮优化

核查日期：2026-10-10。候选仓库均通过 GitHub 公开 API 确认超过 1,000 stars、非 fork 且未归档；stars 是本轮读取时的快照，会继续变化。选型依据是可复核的行为机制和本仓库已有缺口，stars 只作用户要求的筛选门槛。

## 参考来源

| 仓库 | Stars 快照 | 具体参考与本地应用 |
| --- | ---: | --- |
| [obra/superpowers](https://github.com/obra/superpowers) | 296,945 | systematic-debugging 的明确假设、最小验证和失败后修订假设，融入 incident 调查；保留本项目只读与证据边界。 |
| [trailofbits/skills](https://github.com/trailofbits/skills) | 7,455 | fp-check 的调用路径、防护与反证核验，补强 check 和 package 聚合，降低凭危险写法或最高评级误报的风险。 |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 283,083 | to-tickets 的完整可验收切片、真实阻塞关系和机械迁移例外；handoff 的证据指针，应用于方案拆分与接手上下文。 |
| [anthropics/skills](https://github.com/anthropics/skills) | 180,201 | skill-creator 的旧版快照与同题对照、按真实产物评估，应用于本轮真实宿主验证。 |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 104,144 | 区分结构检查、路由检查和行为实测，以及正负案例；沿用本仓库既有 runner，增加有实质判别力的审查样例。 |

读取的固定版本源码：

- Superpowers：[systematic-debugging](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/systematic-debugging/SKILL.md)。
- Trail of Bits：[fp-check](https://github.com/trailofbits/skills/blob/442fc9d6c89b1e937e6f7a477e7071ea75fcbea4/plugins/fp-check/skills/fp-check/SKILL.md)、[false-positive-patterns](https://github.com/trailofbits/skills/blob/442fc9d6c89b1e937e6f7a477e7071ea75fcbea4/plugins/fp-check/skills/fp-check/references/false-positive-patterns.md)。
- Matt Pocock：[to-tickets](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-tickets/SKILL.md)、[handoff](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/handoff/SKILL.md)。
- Anthropic：[skill-creator](https://github.com/anthropics/skills/blob/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/skill-creator/SKILL.md)、[grader](https://github.com/anthropics/skills/blob/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/skill-creator/agents/grader.md)。
- Addy Osmani：[evals](https://github.com/addyosmani/agent-skills/blob/1401c8b8030e023baeebb31781a6653fe8e93026/evals/README.md)、[context-engineering](https://github.com/addyosmani/agent-skills/blob/1401c8b8030e023baeebb31781a6653fe8e93026/skills/context-engineering/SKILL.md)。

## 落地范围

1. **审查质量**：[check](../../skills/yan-code-review/modes/check/mode.md) 对候选 finding 检查可达路径及真正生效的防护，不因一个安全入口忽略其他入口。[aggregation](../../skills/yan-code-review/modes/package/aggregation.md) 删除“取最高严重度”的聚合规则，按已证实影响校准；更严重后果未证实，不撤销已经成立的局部缺陷。命名偏好不列为 accepted Minor；未证实与已被反证排除分开记录。
2. **方案可验收**：[yan-dev-doc](../../skills/yan-dev-doc/SKILL.md) 跨层功能先考虑一条最小完整业务路径；拆分按真实依赖与可观察结果，保留机械迁移和无法独立验收时的集成边界，小改动不强拆。
3. **排障可裁决**：[incident](../../skills/yan-project-analysis/modes/incident/mode.md) 关联假设、支持证据、可推翻观察和最小区分动作；诊断与预期不符就修订假设，没有新证据时报告缺口。
4. **交接可恢复**：[handoff](../../skills/yan-conversation-handoff/SKILL.md) 仅在会改变下一动作时保留失败尝试或已排除方向、证据位置和重试前提，不复制长日志。
5. **可复现评测**：新增 10 个场景定义及隔离 [Java 预览样例](../../scripts/fixtures/review-preview/README.md)，增加 host contract `review-evidence-calibration`。结构检查只验证定义与边界，真实宿主输出另行审阅。

所有行为描述均按本项目需要重新编写；未复制第三方脚本或整套 Skill，也不新增运行依赖。继续保留 4 个公开入口、按需加载、Git/SVN 归属核验、数据库只读和共享 agents 安装根。参考仓库中的固定流程、默认外部发布或自动提交不迁入本项目。

## 对照验证方法

修改前保存当前工作树的 skills 快照，包含之前已授权的优化；对照组不是 Git HEAD 的旧版本。新旧组使用相同 Java fixture、任务提示、宿主配置和判分规则，分别在 runner 创建的独立 Git clone 中运行。

场景同时包含防御性复制带来的反证、真实的 limit - 1 缺陷，以及缺乏调用路径支持的生产影响升级。自动断言检查来源映射和 canonical ID，人工复核引用源码、结论与范围；仅命中标签不算充分证据。具体输入与期望存放在 [review evals](../../skills/yan-code-review/evals.json) 的 case 13。

复跑时把 fixture 复制到临时目录并初始化为独立 Git 仓库，使用本机测试身份创建一次 fixture 基线，再把其绝对路径作为 workspace 传给现有命令：

```text
node scripts/run-host-evals.js --live --host codex --case review-evidence-calibration --workspace <临时-fixture-Git-目录> --timeout-ms 180000 --output <仓库外结果.json>
```

此命令调用真实模型，按需执行。不要以本业务仓库替代 fixture，也不要为了此案例改用户仓库的 Git 状态。

## 本轮验证结果

- 全量 `node scripts/check-all.js` 通过：4 个公开 Skill、11 个 eval suite、183 个场景定义、27 条静态宿主契约；加载、BOM、文档链接、review/document 边界、安装事务及其他既有检查均通过。183 个定义并非 183 次真实模型执行。
- 真实 Codex CLI `codex-cli 0.162.0-alpha.17.2` 对照：同一 case 各 1 次，沿用宿主当前默认模型配置。

| 组别 | 退出码 | 自动断言 | 人工复核 | 最终工作区漂移 | 耗时 |
| --- | ---: | --- | --- | --- | ---: |
| 优化前工作树快照 | 0 | 通过 | 排除 A-1；A-2/B-1 合并为 Important，并引用复制逻辑和 limit - 1 | 无；HEAD、索引、受保护元数据及文件哈希未变 | 149.7s |
| 优化后快照 | 0 | 通过 | 排除 A-1；A-2/B-1 合并为 Important，并区分局部缺陷与未证实生产影响 | 无；HEAD、索引、受保护元数据及文件哈希未变 | 148.4s |

两组都正确处理了该样例。这个结果证明新版在本次抽样中未退化，**不能证明准确率或速度提升**；它支持保留一项可重复的行为回归用例。本轮改动的确定收益是消除“默认取最高严重度”与证据原则的矛盾，并明确此前欠具体的决策标准。没有把一次对照当成统计结论。

本轮未对 Claude/Cursor 执行真实模型评测。Java 代码仅作审查输入，两组均明确未编译或运行 Java；源码路径推演不代表线上复现。漂移核验是最终状态检查，不是无瞬态写入或无外部副作用的证明。

`install-local.cmd agents` 已更新共用安装，`install-local.cmd status agents` 返回 `CURRENT`；63 个安装文件按既定 SKILL.md 去 BOM 规则与源码逐字节一致。没有安装第三方整套 Skill，也未创建本仓库提交或外部发布。
