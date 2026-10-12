# 第二轮：从具体示例完善开发工作流 Skill

核查日期：2026-10-10。继续使用超过 1,000 stars、非 fork、未归档的筛选条件，本轮新增 6 个仓库，选取 18 份 Skill/参考文件。stars 为 GitHub API 当次快照，来源均固定到读取时的 commit。上轮来源与对照结果见 [第一轮记录](2026-10-10-skill-benchmarks.md)。

## 来源与取舍

| 新增仓库 | Stars 快照 | 本轮有用的示例与采用边界 |
| --- | ---: | --- |
| garrytan/gstack | 135,757 | 新枚举/输入范围扩大会破坏未改消费者；采用按实际调用链核对。测试价值审计的保留依据用于补充示例，不引入自动删测试、自动修复或固定双轮审查。 |
| affaan-m/ECC | 276,083 | Java Service mock 与数据库集成的证明边界；采用分清验证层次，不引入固定六阶段、80% 阈值或一律全量构建。 |
| wshobson/agents | 40,312 | 最小复现、正常/异常对照、可证伪假设；补充缩减复现时保留关键触发条件。假设并行部分已有覆盖，不强制委派。 |
| github/awesome-copilot | 39,875 | test-gap-audit 的真实断言、mock 边界、间接覆盖与负向行为；采用有证据的覆盖判断，不引入每次全仓扫描或固定上下文地图。 |
| OthmanAdi/planning-with-files | 27,365 | 失败记录与恢复示例；已有 handoff/incident 规则覆盖，增加历史验证失效案例，不重复引入三份常驻文件、固定操作次数或重试次数。 |
| Jeffallan/claude-skills | 11,802 | 缺失需求、过度实现、解释偏差及从代码提炼行为；补强验收对照和当前实现/批准期望的区分，不照搬固定两阶段审查。 |

固定版本材料：

- **garrytan/gstack**：[test-audit/SKILL.md](https://github.com/garrytan/gstack/blob/20eb6202fa8ea83a882e7c0463b722cd8a31af1e/test-audit/SKILL.md)；[review/checklist.md](https://github.com/garrytan/gstack/blob/20eb6202fa8ea83a882e7c0463b722cd8a31af1e/review/checklist.md)；[context-restore/SKILL.md](https://github.com/garrytan/gstack/blob/20eb6202fa8ea83a882e7c0463b722cd8a31af1e/context-restore/SKILL.md)。
- **affaan-m/ECC**：[skills/springboot-verification/SKILL.md](https://github.com/affaan-m/ECC/blob/4eb71d92a39cab44ad40ac9d8a6a5ccb4029d6c2/skills/springboot-verification/SKILL.md)；[skills/verification-loop/SKILL.md](https://github.com/affaan-m/ECC/blob/4eb71d92a39cab44ad40ac9d8a6a5ccb4029d6c2/skills/verification-loop/SKILL.md)；[skills/search-first/SKILL.md](https://github.com/affaan-m/ECC/blob/4eb71d92a39cab44ad40ac9d8a6a5ccb4029d6c2/skills/search-first/SKILL.md)。
- **wshobson/agents**：[plugins/developer-essentials/skills/debugging-strategies/SKILL.md](https://github.com/wshobson/agents/blob/46891e7e60da0e52baf1050b7b6391b64e84c6d9/plugins/developer-essentials/skills/debugging-strategies/SKILL.md)；[plugins/agent-teams/skills/parallel-debugging/references/hypothesis-testing.md](https://github.com/wshobson/agents/blob/46891e7e60da0e52baf1050b7b6391b64e84c6d9/plugins/agent-teams/skills/parallel-debugging/references/hypothesis-testing.md)；[plugins/developer-essentials/skills/code-review-excellence/SKILL.md](https://github.com/wshobson/agents/blob/46891e7e60da0e52baf1050b7b6391b64e84c6d9/plugins/developer-essentials/skills/code-review-excellence/SKILL.md)。
- **github/awesome-copilot**：[skills/test-gap-audit/SKILL.md](https://github.com/github/awesome-copilot/blob/82701c24b99488536ca399ff4789a458b7a05db7/skills/test-gap-audit/SKILL.md)；[skills/context-map/SKILL.md](https://github.com/github/awesome-copilot/blob/82701c24b99488536ca399ff4789a458b7a05db7/skills/context-map/SKILL.md)；[skills/create-specification/SKILL.md](https://github.com/github/awesome-copilot/blob/82701c24b99488536ca399ff4789a458b7a05db7/skills/create-specification/SKILL.md)。
- **OthmanAdi/planning-with-files**：[skills/planning-with-files/examples.md](https://github.com/OthmanAdi/planning-with-files/blob/41f60aeca8bae0b145ec0e9421a7abd747ae2b69/skills/planning-with-files/examples.md)；[skills/planning-with-files/SKILL.md](https://github.com/OthmanAdi/planning-with-files/blob/41f60aeca8bae0b145ec0e9421a7abd747ae2b69/skills/planning-with-files/SKILL.md)。
- **Jeffallan/claude-skills**：[skills/spec-miner/SKILL.md](https://github.com/Jeffallan/claude-skills/blob/1be15d8064f88fc25216442406d40add8fd23b53/skills/spec-miner/SKILL.md)；[skills/spec-miner/references/analysis-process.md](https://github.com/Jeffallan/claude-skills/blob/1be15d8064f88fc25216442406d40add8fd23b53/skills/spec-miner/references/analysis-process.md)；[skills/code-reviewer/references/spec-compliance-review.md](https://github.com/Jeffallan/claude-skills/blob/1be15d8064f88fc25216442406d40add8fd23b53/skills/code-reviewer/references/spec-compliance-review.md)；[skills/debugging-wizard/references/common-patterns.md](https://github.com/Jeffallan/claude-skills/blob/1be15d8064f88fc25216442406d40add8fd23b53/skills/debugging-wizard/references/common-patterns.md)。

## 实际修改

- [只读审查](../../skills/yan-code-review/modes/check/mode.md)：从已确认验收检查遗漏与越界；新增状态或放宽输入时读取相关未改消费者；测试报告核对真实执行逻辑、mock 边界及已有间接覆盖。
- [审查补充参考](../../skills/yan-code-review/modes/check/reference.md)：加入 5 个相邻判断示例，包含“新增状态漏改标签”和“导出有意排除未完成状态”的区别、“mock 依赖有效”和“mock 目标方法无证明力”的区别。仍为原有条件加载资源，不增加默认资料数。
- [修复](../../skills/yan-code-review/modes/repair/mode.md)：零测试或过滤器未命中不能算验证成功；不通过跳过/放宽有效断言换取通过。批准需求确已变化时允许更新过期期望，保留仍有效的边界回归。
- [事故分析](../../skills/yan-project-analysis/modes/incident/mode.md)：精简复现保留原故障相关的版本、数据、权限、时序或并发前提；单线程不复现不能排除原并发故障。
- [业务说明](../../skills/yan-project-analysis/modes/business/mode.md)：分开写现状、已批准期望和建议，避免把现有缺陷固化为正确验收。
- [方案](../../skills/yan-dev-doc/SKILL.md)：权限、状态和副作用相关验收说明“应发生什么”与“哪些行为不得发生”。
- [问题标识语义](../../skills/_shared/workflow-chain.md)：根据本轮实测暴露的问题，明确首次 CR/IM/MI 分别对应 Critical/Important/Minor；复审严重度变化保留原 ID 并记录历史，check 入口同步说明。

沿用 4 个公开入口、11 条 entry/mode 路由及现有按需资料链接。没有复制上游完整流程、运行脚本或安装第三方技能，没有新依赖。源码 Markdown 保留 BOM，安装 SKILL.md 仍按既定规则去除前导 BOM。

## 新增示例及相邻反例

本轮新增 15 个场景定义，其中 3 个绑定可复现 fixture，另外 12 个补充判断边界：

| 示例 | 应有判断 | 必须避免的相邻误判 |
| --- | --- | --- |
| 新状态进入未改标签函数 | 沿真实消费者发现遗漏 | 不把只导出 COMPLETED 的批准规则报错 |
| Service stub 返回筛选后的结果 | 只证明当前 Service 层行为 | 不声称真实 SQL 通过，也不否定所有 mock |
| 上层参数化测试覆盖真实 Service | 按调用和断言确认间接覆盖 | 不因没有同名 Test 文件追加空洞测试 |
| 保存失败后 finally 仍发通知 | 对照“失败不发送”的明确验收 | 不用 happy-path/编译通过覆盖负向行为 |
| total 断言失败 | 修正真实分页和计数行为 | 不 skip、放宽断言或替换被测函数 |
| limit=0 的批准规则改变 | 更新已过期断言 | 不保留错误期望，也不删仍有效非法参数测试 |
| 测试过滤命令退出 0、运行数 0 | 重新定位实际目标测试 | 不报告验证通过 |
| 并发问题被改成单线程复现 | 记录复现前提变化 | 不排除原并发问题，不重放生产写请求 |
| 消息入队后源码立即标完成 | 现状与批准的异步回执契约分开 | 不把入队日志当最终业务完成 |
| 全状态撤回只是提议 | 作为未批准建议保留 | 不混入当前功能和正式验收 |
| 无权限/查询失败时不可发导出消息 | 验收包含拒绝与不执行副作用 | 不只验证成功响应 |
| revision A 通过，B 尚未验证 | 交接保留旧证据及当前缺口 | 不沿用旧通过关闭新任务 |

## 可复现的宿主评测

三个 fixture 均为本轮原创、无网络或数据库依赖的 Node.js/文本材料，位于 scripts/fixtures。复制所选 fixture 到临时目录，用本机测试身份初始化独立 Git 仓库并提交 fixture 基线，然后把该临时路径传给 runner。不得在业务仓库为测试创建提交。

| case | fixture | 关键核验 |
| --- | --- | --- |
| review-state-consumers | [状态消费者](../../scripts/fixtures/review-state-consumers/README.md) | 从 supplied patch 追到未改标签；识别绕过目标函数的测试；保留有意的导出过滤；零写入 |
| repair-query-contract | [分页修复](../../scripts/fixtures/repair-query-contract/README.md) | 修改真实筛选/计数逻辑，保留原断言，真实运行测试；只能修改 src/query.js 与新增回归测试 |
| business-async-contract | [异步状态](../../scripts/fixtures/business-async-state/README.md) | 分开当前 COMPLETED、批准的 QUEUED 到回执完成规则及消费失败日志；零写入 |

示例命令（真实模型调用，按需运行；修复案例另加 --allow-write）：

```text
node scripts/run-host-evals.js --live --host codex --case review-state-consumers --workspace <临时-fixture-Git-目录> --timeout-ms 240000 --output <仓库外结果.json>
```

自动文本断言只检查关键输出信号；结果还须复核源码定位、解释和误报边界。标准 runner 在结束后清理 clone，修复后需要独立重跑测试时可直接在另一个隔离 clone 中运行相同 Skill 快照与任务，并保留产物供检查；本轮采用此方式对修复结果做独立验证。


## 本轮验证结果

2026-10-10 完成以下验证。场景定义检查和静态宿主契约不等于真实模型逐条执行。

- `node scripts/check-all.js`：全部通过；4 个公开 Skill、11 套 eval、198 个场景定义（本轮新增 15 个）、30 条静态宿主契约、11 条路由和 24 个资源预算通过。
- 3 个新增隔离场景实际运行 Codex CLI，审查场景因首次编号问题又运行一次，共 4 次模型调用。以下记录区分首次结果、调整和最后结论。

| 场景 | 实际观察与最后结论 | 边界核验 |
| --- | --- | --- |
| 状态消费者审查 | 现有 3 项测试全过，仍找到 `status-label.js` 的 PARTIAL 显示遗漏和绕过真实实现的 `fakeSubmit`。首轮语义正确但误用 CR 配 P2；补充首次编号规则后重跑，得到 IM-1/Important 与 IM-2/Important。没有误报有意的 COMPLETED 导出过滤。最终 runner 自动检查通过。 | 全程零写入；HEAD、index、受保护 Git 元数据及文件哈希无漂移。最终 supplied patch 反向检查成功。 |
| 分页修复 | 初始 6 项测试中 2 通过、4 失败；修复后 6 通过、0 失败、0 跳过。保留修复产物，并由主会话独立重跑 `node --test test/query.test.js` 得到同样结果。 | 只修改隔离 clone 的 `src/query.js`；原测试 SHA-256 未变，README 与 Skill 快照未变，HEAD/index 未变。源码 fixture 故意保留初始缺陷。 |
| 异步状态说明 | 正确区分当前提前写 COMPLETED、批准的 QUEUED→匹配成功回执后 COMPLETED，以及同一消息消费失败的合成日志。原评分器只接受 `consumer.failed`，将中文“消费失败”误判；改为接受两种表达后，对保存的原输出重评通过，没有重跑模型或改写其答复。 | 零文件写入、HEAD/index/元数据无漂移；未把合成日志当生产落库或最终配送完成证明。 |

这些实测覆盖本轮关键决策，尚未对新增 15 个场景逐条进行真实模型评测，也没有本轮 Claude/Cursor 实跑或统计意义上的总体能力提升结论。其余示例是可复用的评测定义与判断边界。

安装验证：

- `install-local.cmd --dry-run agents`、`install-local.cmd agents` 均成功，`install-local.cmd status agents` 返回 `CURRENT`。
- 63 个安装文件逐项比对一致，仅公开 `SKILL.md` 按安装约定去前导 UTF-8 BOM。4 个公开 Skill 均通过 `skill-creator/scripts/quick_validate.py`。校验器依赖的 PyYAML 仅放在本轮临时目录；未增加项目依赖。
- 安装内容来自当前工作区，`sourceTreeHash` 为 `cd29cfdb8d40444cfc623bc521fc6f3f69c340aa0c82091257d385b5d96732f0`；本轮没有提交或推送。
