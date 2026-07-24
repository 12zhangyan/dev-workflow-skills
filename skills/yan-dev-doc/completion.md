# Yan Dev Doc Completion and Recovery

## 精简模式完成输出

```text
✅ 文档：docs/<日期>/<任务名>.md（Compact）
📤 Apifox/OpenAPI：NotApplicable (Compact，无契约变化)
📚 看板/单页/索引：NotApplicable (Compact)
🧭 工作流阶段：Plan Gate 已完成，下一步直接进入 Implementation Gate

【Workflow Brief】
stage: PlanGate
task: <任务名>
source: <用户需求 + 两个以内代码证据点>
artifacts: docs/<日期>/<任务名>.md
changed: 无（方案阶段未改业务代码）
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管范围>; untracked=<精简 md 待纳管或 无>
tests: class=NotApplicable; command/result=未运行（方案阶段；计划命令=<模块级命令>）
api: spec=无; index=无; operationIds=无
openFindings: 无
next: 按 Compact 文档直接实现两个以内生产代码切点和聚焦测试；范围扩大时停止并升级 Standard
nextCommand: 读取 docs/<日期>/<任务名>.md，按“三、改动与执行顺序”和“五、实现 Todo 与评审点”实现并运行验证
tokenHint: 下一位 AI 先读本 Brief -> 精简 md -> 首轮最多 5 个文件（Compact 建议 3 个目标文件）；不要扩展到未列范围

🤖 交给当前 AI 宿主执行：
"读取 docs/<日期>/<任务名>.md，确认仍满足 Compact 资格后，按改动顺序直接实现并运行模块级验证。若发现契约、DB、权限、状态、事务、外部副作用或跨模块变化，立即停止并回到 yan-dev-doc Standard。完成后回填变更文件、验证结果和偏离项。"
```

---

## 完成后输出格式

先按真实结果选择状态，禁止固定宣称成功：

- **Passed**：Plan Gate 无 blocker/conflict，且列出的文件确实已生成并通过对应检查；才输出实现提示。
- **Blocked**：高风险未知、路径冲突、文件不可读或 DB 未确认；输出 `Plan Gate 未通过`、blocker 和下一步确认问题，不输出实现提示。非交互 blocker 不写任何产物。
- **EnvironmentBlocked**：方案文档已安全生成，但 Node/validator 等环境缺失导致单页、索引或深度校验未完成；只列真实产物，明确 `environment-blocked + 命令/版本/失败摘要`，不得把未生成文件写进 artifacts。

```
✅ 文档：<已生成 docs/<日期>/<任务名>.md / 未生成 + 原因>
📤 Apifox/OpenAPI：<真实路径 + 校验状态 / 本次无接口变更 / 未生成 + 原因>
📚 Apifox 索引：<真实路径 / 未生成 + 原因>
📚 文档总索引：<真实路径 / environment-blocked + 原因>
📤 独立单页：<真实路径 / environment-blocked + 原因>
🧭 工作流阶段：<Plan Gate 已完成，下一步进入 Implementation Gate / Plan Gate 未通过 / Plan Gate 已完成但派生产物 environment-blocked>

【Workflow Brief】
stage: PlanGate
task: <任务名>
source: <用户原始需求 / 参考文档 / 代码线索>
artifacts: <只列真实生成并检查过的路径；没有写 无>
changed: 无（方案阶段未改业务代码）
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管文件>; untracked=<开发文档、OpenAPI、看板/索引待纳管或 无>
tests: class=NotApplicable; command/result=未运行（方案阶段）
api: spec=<docs/apifox/<日期>/<任务名>.openapi.yaml 或 无>; index=<docs/apifox/INDEX.md 或 无>; operationIds=<新增/变更接口 ID 或 无>
openFindings: <仅列未裁决的阻塞项/需求冲突/待确认；已裁决冲突不进入；没有写 无>
next: <Passed：交给 AI/开发者实现并进入 VCS/Verification Gate；Blocked：回答 blocker 后重新运行；EnvironmentBlocked：补齐环境后生成缺失派生产物>
nextCommand: <Passed：读取 docs/<日期>/<任务名>.md 按 Todo 实现并执行验证；Blocked：补充 blocker 答案后重新运行 yan-dev-doc skill；EnvironmentBlocked：补齐环境或工具链后重新运行 yan-dev-doc skill 生成缺失派生产物>
tokenHint: 下一位 AI 先读本 Brief -> docs/<日期>/<任务名>.md 的技术方案、变更清单、Todo、验收标准 -> 只读取相关源码；首轮最多 5 个文件

📌 关键决策：
1. <一句话>
2. <一句话>
3. <一句话>

🤖 交给 Codex / Cursor / Claude Code 执行（仅 Passed 时输出；直接粘贴给当前宿主）：
"参考 docs/<日期>/<任务名>.md 实现技术方案。
先阅读「二、技术方案 / AI 执行口径」，确认前置条件、执行顺序、验收标准和禁止改动。
按「六、代码变更清单」逐项执行。
修改类条目先确认「最小影响分析」中的原因再动手。
按「十一、实现 Todo」逐项完成，每完成一项运行对应验证；若文档存在阻塞问题或阻塞型需求冲突，先输出确认问题，不得开始编码；低风险假设按文档记录执行。对“需求冲突（已裁决）”只采用最终口径，禁止从聊天或旧文档恢复已否决方案。
完成后必须回填执行结果对照表：已完成 Todo、未完成/偏离项、变更文件、验证命令、风险/疑问。"

📁 纳入版本控制并确认变更范围：
- [ ] Git: `git add docs/<日期>/<任务名>.md project-html/data/changes.js project-html/data/details/ docs/INDEX.md`；如生成接口规范，再加 `docs/apifox/<日期>/<任务名>.openapi.yaml docs/apifox/INDEX.md`
- [ ] SVN: `svn add <新文件>`；如生成接口规范，确认 `.openapi.yaml` 与 `docs/apifox/INDEX.md` 已纳入版本控制
- [ ] 查看完整变更：`git diff` / `svn diff`

🧪 先验证（没有绿灯不进 Code Review）：
- [ ] <验证命令>：**优先填 Step 1 探测到的构建文件对应的模块级命令**——多模块 Maven 用 `mvn -pl <改动模块> -am test` 或 `mvn -f <module-pom> test`，单模块用 `mvn test`；Gradle 用 `./gradlew :<module>:test`，Node 用 `npm test`。泛化的 `mvn test` / `./gradlew test` 只在无法定位改动模块时兜底。每条命令同时写 `TestDependencyClass` 和依赖；默认 CI 不得混入需要真实密钥的 `LiveExternal` 测试。
- [ ] 测试全绿 → 继续；有失败 → 先修复再验证

🤖 AI 代码审查（Review Gate；调用映射以 `skills/_shared/workflow-chain.md` 为准）：
- [ ] Claude Code / Codex / Cursor：`使用 yan-code-review skill，mode=package，基于 docs/<日期>/<任务名>.md 生成 Review 任务包`
- [ ] Claude Code / Codex / Cursor：`使用 yan-code-review skill，mode=check，审查 docs/review-fix/<日期>/<任务名>-review-task.md`
- [ ] 把 findings 交回 `review-fix` 汇总，或交给 `review-repair` 直接修复；Critical / Important 处理后重跑验证

👁 生成代码地图，自己 Review（Understanding Gate）：
- [ ] Claude Code / Codex / Cursor：`使用 yan-project-analysis skill，mode=understanding，基于 docs/<日期>/<任务名>.md 生成代码地图`
- [ ] 对照地图检查业务逻辑、事务边界、关键注意点
- [ ] /chinese-yan-code-review 整理评论话术（如有问题）

🏁 收尾（提交/合并后，让状态全员可见）：
- [ ] 看板里点状态标签只存浏览器本地；要让团队都看到，直接对当前 AI 宿主说：
      "把 project-html/data/changes.js 中标题为「<任务名>」的记录 status 改为 \"已完成\"，改完跑 node --check"

```

---

## 常见错误与恢复

仅在执行失败、产物异常或行为偏离预期时读取本节。先按现象匹配；未命中时返回 SKILL.md 的失败处理规则，显式报告失败与保留状态。

| 错误 | 原因 | 修复 |
|------|------|------|
| 文档生成后 AI 执行走偏 | 「六、代码变更清单」写得不够具体 | 每个条目加上「为何不能用扩展替代」说明 |
| Cursor / Claude Code / Codex 当前模式没有结构化提问工具 | 按产品名猜工具，或把工具缺失误当成可以采用默认项 | 交互会话降级为聊天单选；非交互运行把高风险问题记为 blocker 并停止；默认建议必须有证据 |
| 问答时用户回答"待定"太多 | 需求本身还不成熟 | 先用 `superpowers:brainstorming`（或宿主显示的同名入口）理清需求；结论回填到范围/非目标/blockers/conflicts/assumptions 后再运行 yan-dev-doc |
| 文档文件名冲突 | 同天同任务名重复运行 | 按提示选择 A/B/C/D/E 处理冲突 |
| Step 1 git 命令报 dubious ownership / safe.directory | 当前执行用户不是仓库拥有者 | 仍按 `.git` 判定为 Git；只在本次命令使用 `git -c "safe.directory=$vcs_root"`，不要改全局配置 |
| 看板写入后打不开 | entry 字段或既有数据语法异常 | 保留 `_entry.json` 和脚本错误，修正标准 JSON 后重跑 `board-add.js`；禁止手工改 `changes.js` 绕过保护 |
| 旧版单文件看板（数据内联在 index.html） | 看板是旧版结构 | Step 5.5 MISSING 分支自动迁移：数组搬入 `data/changes.js` 后覆盖外壳 |
| 同一任务重复运行产生重复看板条目 | 冲突选 A/E 后仍追加 | `board-add.js` 按 `docPath` 查重，命中即就地更新（保留原 status） |
| Apifox YAML 只写在 md 里，后续不好导入/维护 | 没有生成独立 OpenAPI 产物 | 接口变更时必须生成 `docs/apifox/<日期>/<任务名>.openapi.yaml`，更新 `docs/apifox/INDEX.md`，并在看板写入 `apiSpecPath` |
| 原接口只收紧行为却被全量写入 OpenAPI | 没有逐接口区分行为变更与契约变更 | 保留原接口契约不动，只在方案/兼容性/测试记录行为收紧；OpenAPI 和 `apis[]` 仅收新增或契约变更接口 |
| 给了旧 md 和一句增量仍重走完整新文档 | 未识别 `IncrementalRevision` | 读取旧文档并继承证据，只补增量槽位；纯行为变更跳过 API/OpenAPI 章节，契约有变化则自动恢复 |
| 两个小改动点仍生成完整方案、看板和索引 | 未识别低风险兼容扩展 | 满足全部资格条件时使用 `Compact`，只生成精简 md；发现契约/DB/权限/状态/跨模块风险则升级 `Standard` |
| 引用多篇旧 md 时执行方只读最近一篇 | 模板仍按单前置文档表达，未标明各文档承接范围 | 在文首列出全部前置文档的名称、相对链接和承接范围，并在 AI 执行口径中要求逐篇读取；冲突口径进入 `conflicts`，不按时间静默覆盖 |
| 用户中途否决旧口径，但实现方回读聊天后又采用 | 已裁决冲突从最终文档中消失 | 记录旧口径、用户否决证据、最终口径和实现禁令，标记 `conflicts(status=resolved)`；只按最终口径实施 |
| 接口索引没有接口但有 YAML 链接 | 生成了 `apiSpecPath`，但看板 `apis[]` 漏填 | 回填 `apis[]`，每条接口至少包含 `method`、`url`、`operationId`、`desc` |
| Apifox 导入失败 | YAML 结构不合法或缺少 `paths` / `operationId` | 按 Step 5.1 轻量校验修正后再输出完成信息 |
| 工作区外 `validate-openapi.js` 被宿主禁止启动 | skill 位于用户目录，当前沙箱只允许执行工作区内代码 | 运行 `publishing-openapi.md` 的工作区内无依赖静态校验，记录 `light:workspace-inline`；只在明确的路径访问受限时降级，YAML 内容失败仍须修复 |
| 外壳 cp 失败 | skill 不在默认安装路径（`~/.codex/skills`、`~/.claude/skills`、`~/.cursor/skills`、`~/.agents/skills`） | 降级 Read+Write 文本外壳（含 board-add.js），vendor 跳过走 CDN |
| `board-add.js` 报"记录数下降，已放弃写入" | 输入 entry 异常或现有文件已损坏 | 原文件未被改动，按提示排查输入 JSON / 现有 `data/changes.js` 后重试 |
| `build.js` 中止并提示"疑似数据被误覆盖" | `pages/` 现存单页数远多于 `data/changes.js` 当前记录数 | 先排查 `data/changes.js` 是否被误写小了（看 `.bak`），确认是有意删条目再设 `BOARD_FORCE_BUILD=1` 重跑 |

---
