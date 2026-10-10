# 2026-10-10 优化基线与验证

本基线收束当天已经在工作区中的 Skill 能力修订，以及中断审查后的确定性修复。保留四个公开入口、按需加载和现有共享安装方式，不增加运行依赖。

## 已收束的改动

- 审查按已确认契约追踪未改消费者、区分有效测试与绕开实现的 fake；修复保留输入 finding ID 和现有有效断言。事故调查、业务分析和交接保持证据来源、版本与权限边界。
- 看板外壳 29 限制 catalog/detail 写入路径，拒绝详情身份冲突，并用排他锁防止并发丢记录。发布输入由共享 helper 为每次操作单独分配在看板 data 目录下；不共用固定 JSON，也不把临时写入扩展到授权目录外。
- 安装回滚失败时保留恢复副本；文件存在性判断不再把不可读或断链当成缺失。
- 宿主进程失败不能得到通过评分。真实输出、独立行为评分、工作区漂移分别记录；原生自然触发与提示中提供目录的选择分开验证。
- 比较工具要求已固定的模型、入口、fixture、任务和 grader。一次匹配样例只支持未见回归，不代表总体正确率或成本改善。

具体前期研究和修复依据见 [文献与验证记录](2026-10-10-agent-literature.md)、[真实样例记录](2026-10-10-more-examples.md)。

## 当前验证

- `node scripts/check-all.js` 全套通过：33 个脚本、4 个公开 Skill、11 个 eval suite、204 个场景定义、33 个三宿主静态契约。场景定义数量不代表真实模型运行次数；本次为 Windows / Node 24.21.0 本地验证，未触发远端 CI。
- 看板回归覆盖两份输入在发布前均已准备、两份记录均保留；原有写锁、路径边界、迁移和安装恢复失败回归继续通过。
- 最终当前版本的 3 个真实 Codex 样例通过：原生自然审查、原生无技能反例、目录选择审查。统一请求 `gpt-6-astra` / `high`，只读 fixture 的文件、HEAD、索引及受保护元数据均未漂移。代码审查准确定位 `limit - 1`，并未把 Java 静态推导冒充实际运行。
- 最终旧版对照因服务端持续繁忙而超时，没有模型最终答复。比较工具按预期拒绝该组结果，耗时差留空；不宣称新版本提升或旧版本退化。探索轮的通过结果及中文分号导致的评分误判也保留，未从记录中剔除。
- `install-local.cmd --dry-run agents`、安装和 `status agents` 成功，状态 `CURRENT`。63 个安装文件与源码逐字节一致，仅入口 SKILL.md 按约定去 BOM；源码树 SHA-256 为 `438c0e6b48b4de6add0379bcbca5535dfbae077ca1f89e3bc2cace72487b8f58`。
- 评测条件、Skill/任务/grader 指纹、全部 8 次运行结果和比较拒绝原因见 [机器可读结果](2026-10-10-host-eval-results.json)。本轮原始结果保存在仓库外的 workflow-finish-bLreYS 临时证据目录；版本化索引不保存用户配置或宿主诊断。
- 未将临时证据目录作为永久发布渠道；本地 Git 基线保留实现、评分器、fixture 和结果索引，后续可从确定提交导出完整 skills 树重新测试。

## 重现入口

以 scripts/fixtures/review-preview 的内容建立一个独立 Git 仓库并提交初始快照。运行器只克隆该快照，不使用 fixture 工作区内的未提交变更。以下输出路径均放在该 fixture 之外：

```text
node scripts/run-host-evals.js --probe --json
node scripts/run-host-evals.js --live --host codex --case natural-review-selection --invocation native --workspace <fixture> --model gpt-6-astra --effort high --output <new.json>
node scripts/run-host-evals.js --live --host codex --case natural-no-skill-control --invocation native --workspace <fixture> --model gpt-6-astra --effort high --output <negative.json>
node scripts/run-host-evals.js --live --host codex --case natural-review-selection --invocation catalog --workspace <fixture> --model gpt-6-astra --effort high --output <catalog.json>
node scripts/run-host-evals.js --live --host codex --case natural-review-selection --invocation native --workspace <fixture> --skill-source <saved-skills> --model gpt-6-astra --effort high --output <old.json>
node scripts/compare-host-evals.js <old.json> <new.json>
```

原生发现支持以本次 Codex 命令事件核验实际读取；catalog 可用三个 CLI 适配器执行，其自报加载证据不等同于宿主原生发现。只读样例不需 --allow-write。可写样例必须显式授权并使用受信任 fixture。

## 环境限制

2026-10-10 本机 Cursor CLI 的 status 返回 Not logged in；Claude CLI 未找到。这两项需要具备对应宿主和登录状态后才能补真实模型结果，不计入通过。仓库中的三宿主离线契约通过与真实跨宿主运行是两种证据。

## 版本与恢复

提交包含本页、相关实现、回归测试与当天的研究/fixture。可用 git log --oneline -- docs/research/2026-10-10-optimization-baseline.md 定位基线提交，再用 git show <提交>:<路径> 查看当时版本。需要完整旧版对照时，从该提交导出 skills 树并传给 --skill-source；不重置现有工作区。这里只建立本地版本基线。
