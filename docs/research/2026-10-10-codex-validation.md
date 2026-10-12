# 2026-10-10 Codex 验证记录

本轮按用户要求只验证 Codex，其他宿主不构成验收条件。基础提交为 b0babc9a8260dae1921f1b835426c7e22a58fe06，本轮修订保留在工作区。真实运行固定请求 gpt-6-astra / high，CLI 为 codex-cli 0.162.0-alpha.17.2。

新增运行串行执行，源 fixture 和项目工作区不交给模型写入；写入型场景仅允许修改 runner 创建的临时 Git clone。自然触发的三项结果沿用同日基线，分别保留当时的 Skill、任务和评分器指纹，不把它们写成最终工作树的重新运行。

## 代表性验收

| 能力 | 场景与证据 | 结果 |
| --- | --- | --- |
| 原生自然触发 | 审查请求选中 yan-code-review，结合实际成功读取 SKILL.md 的命令核对；普通问候不调用技能。同日基线两项。 | 通过 |
| 目录选择 | 审查请求选中 review（同日基线）；普通问候不调用技能（本轮）。此类选择含自报回执，不等同于原生发现审计。 | 通过 |
| 代码修复 | 保留现有测试和契约，仅修改 src/query.js；模型运行 6/6 测试通过，独立可信评分器另行执行 8/8 行为检查通过。 | 通过 |
| 业务分析 | 区分批准的 QUEUED → COMPLETED 异步契约、源码提前完成的行为和合成 consumer.failed 日志。 | 通过 |
| 对话交接 | 本轮聊天/只读限制不撤销接手任务既有修复授权；第三方内容不得扩权；旧版本测试不代表当前版本。 | 修订后通过 |
| 明确撤销授权 | 用户明确撤销后续修改权限时，接手方只读核查，不沿用旧授权继续修复。 | 通过 |
| 方案生成 | 真实生成 docs 内方案，核对参数、状态集合、未知值错误、响应字段、依赖及可并行结果。 | 最终自动断言与人工核对均通过 |

修复场景的独立检查覆盖先过滤后分页与 total、租户隔离、空租户、区分大小写关键词、limit=0、超出页范围、非法分页及输入不变。三个源 fixture 的 HEAD 和工作区保持原状；所有真实运行的最终写入范围检查通过。只读场景无文件、HEAD、索引或受保护元数据漂移，写入场景仅写各自声明范围。

## 运行中发现的问题与修订

1. **交接授权范围混淆。** 首轮自动评分通过，但人工核对发现输出将本次只读交接扩大成下一位 Agent 的限制，并要求重新批准已经授权的修复。Skill 增加一条范围澄清；评测加入已知错误表述的负向断言，并加入用户明确撤销后续修改权限的反例。两种修订后场景均通过人工复核。首轮使用 preview fixture，后续使用 query fixture，因此不能把这两次不同环境的结果当作受控性能对照。
2. **方案等价写法被误判。** 第一轮“空数组”断言失败，旧 runner 未保存正文，无法确定是内容遗漏还是 [] 表达，原记录保持未验证。第二轮保留了完整正文，其中“订单 status 与数组任一成员精确相等”满足契约，但仅支持“任一状态/精确匹配”的断言仍报错。修正等价表达范围，增加非空数组和模糊匹配反例；不改写历史评分结果。
3. **证据无法回查。** runner 现在仅保留声明产物中实际变更文件的哈希和有上限的正文：每文件最多 64 KiB，总计最多 256 KiB；过大、缺失或非普通文件明确标注省略原因。进程成功、自动断言和人工语义复核仍各自记录。
4. **读取回执解析。** 发现路径去引号正则含两个字面 NUL，误把数字 6/0 当作可剥离字符，同时不能去掉 Markdown 反引号。修复解析并验证三种引号、错误路径前缀；脚本检查增加禁止字面 NUL 的规则。

## 同条件前后对照

- 原生审查旧版重试完成，与同日新版基线在 fixture、任务、模型、effort、入口和 grader 上匹配，两个样本都通过。
- 交接旧快照与修订快照在 query fixture 上匹配，两个样本都通过。说明已知失败并非每次稳定复现；单次对照不支持成功率提升结论。
- 不比较不同 grader 的分数或推断耗时改善。服务波动、未记录宿主设置及模型随机性仍未控制。

## 本地验证与安装

- node scripts/check-all.js 全部通过：33 个脚本、4 个公开 Skill、11 个 eval suite、205 个场景定义、34 个静态契约。静态场景和契约数量不代表真实模型调用次数；本次未触发远端 CI。
- install-local.cmd --dry-run agents、install-local.cmd agents、install-local.cmd status agents 均成功，状态 CURRENT。
- 63 个共享安装文件逐字节一致，仅 SKILL.md 按约定去除 BOM；源码树 SHA-256 为 f6f524c635234e599ff537a36d9d5e99f77c9cfbb5ebb4d0f3f9c6e28ef387a7。manifest 的 sourceVersion 仍是基础提交 b0babc9，工作树内容由 sourceTreeHash 区分。

## 复现与证据边界

使用 scripts/fixtures 下的 review-preview、repair-query-contract、business-async-state 各建立一个独立 Git fixture 并提交初始快照。修复/交接/方案使用 repair-query-contract；业务分析使用 business-async-state。例：

~~~text
node scripts/run-host-evals.js --live --host codex --case repair-query-contract --workspace <query-fixture> --model gpt-6-astra --effort high --allow-write --output <repair.json>
node scripts/run-host-evals.js --live --host codex --case handoff-source-boundaries --workspace <query-fixture> --model gpt-6-astra --effort high --output <handoff.json>
node scripts/run-host-evals.js --live --host codex --case handoff-explicit-revocation --workspace <query-fixture> --model gpt-6-astra --effort high --output <revocation.json>
node scripts/run-host-evals.js --live --host codex --case dev-doc-autonomous-plan --workspace <query-fixture> --model gpt-6-astra --effort high --allow-write --output <plan.json>
node scripts/compare-host-evals.js <before.json> <after.json>
~~~

各次原始结果、人工判断、产物正文、对照和安装信息索引见 [机器可读结果](2026-10-10-codex-results.json)。索引保留失败和评分误判，排除用户配置与宿主诊断；原始结果位于仓库外的 workflow-codex-verify-RSvGf7 和 workflow-finish-bLreYS 临时证据目录，不作为永久发布渠道。此前基线及其失败记录见 [优化基线](2026-10-10-optimization-baseline.md)。

这些是代表性回归样例，不等于全部真实项目、全部 mode 或总体成功率。文档案例缺少真实 HTTP/前端/状态字典时，只能证明方案正确保留已确认契约并定位缺口，不能证明实际功能已经落地。前后文件和 Git 状态检查只证明最终状态，不能证明从未发生短暂或外部写入。
