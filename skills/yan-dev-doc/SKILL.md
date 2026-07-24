---
name: yan-dev-doc
description: 在编码前生成有证据、可执行、可验收的开发方案。用户明确要求开发/改造/实施方案、先设计再编码，或接口、权限、状态、DB、事务、跨模块决策尚未裁决时使用；需求和验收已清楚且用户要求直接实现时不要触发。Bug/事故、业务流、代码影响分析使用 yan-project-analysis；代码审查与 findings 修复使用 yan-code-review。
---

# Yan Dev Doc

把需要先评审的开发需求落成 `docs/YYYY-MM-DD/<任务>.md`。本 skill 只完成 Plan Gate，不实现功能、不执行数据库写入、不自动提交。

## 触发边界

使用本 skill：

- 用户明确要“开发方案 / 改造方案 / 实施文档 / 先设计再编码”；
- 接口、权限、状态机、数据归属、DB、事务、回滚或跨模块发布仍需裁决；
- 用户给出既有 yan-dev-doc，要求形成增量修订。

不要触发：

- 范围与验收已明确，用户要求直接实现；
- 只解释代码或回答单点问题；
- 记录 Bug/事故、梳理业务流、生成代码地图或影响分析：使用 `yan-project-analysis`；
- 审查、修复 findings 或审查并修复：使用 `yan-code-review`。

HTML 看板仅在用户明确要求，或项目级规则明确要求时发布。普通方案不初始化、不升级、不写看板。

## 共享协议

执行前按需读取：

- [三端宿主能力协议](../_shared/host-capabilities.md)：Claude Code、Cursor、Codex 工具适配；
- [交互策略](../_shared/interaction-policy.md)：证据预填、风险分级、只问阻塞问题；
- [工作流门禁](../_shared/workflow-gates.md)：Plan / VCS / Verification / Review Gate；
- [Workflow Brief](../_shared/workflow-brief.md)：下一位 Agent 的轻量证据索引。

数据库操作始终只读。结构变更必须先获得用户明确同意；只生成 DBA 申请草案、建议 DDL/回滚方案和只读验证 SQL，不得执行 DDL、数据修复。

## 文档模式

按证据选择一种模式：

- `Compact`：同一模块、最多 2 个生产代码切点和 1 个聚焦测试；仅向后兼容的解析/适配/分支支持；不涉及 API 契约、DB、权限、状态、事务、外部副作用、跨模块或 blocker/conflict。
- `IncrementalRevision`：用户提供一篇或多篇可读的既有 yan-dev-doc，只记录相对变化并链接全部前置文档。
- `Standard`：其他需要正式方案评审的任务。

`Compact` 只生成 md，OpenAPI、看板和索引均为 `NotApplicable (Compact)`。范围扩大时立即升级为 `Standard`。

## 执行流程

### 1. 确认任务和环境

任务名为空时只问一句。文件名规则：英文转小写并用 `-` 分隔；中文保留；`/ \ : * ? " < > |` 和多余空格替换为 `-`。

静默收集：

1. 运行 `node <helper> detect-vcs`，记录 `VCS_TYPE` / `VCS_ROOT`。
2. Git 读取分支、`status --short`、最近 3 条日志；SVN 读取 revision 和最近 3 条日志。命令失败记录 `VCSStatusUnknown`，不把空输出当 clean。
3. 用宿主搜索能力在 root 下最多 3 层查找 `pom.xml`、`build.gradle`、`package.json`，识别模块和验证命令。

Git dubious ownership 只对本次只读命令使用 `git -c "safe.directory=<VCS_ROOT>"`，不改全局配置。

### 2. 建立证据草稿

先读用户指定的需求、现有文档和候选代码，再填：

- 目标、范围、非目标、服务/模块；
- 当前入口、调用链、状态/权限/数据归属；
- 接口分类、事务/副作用、兼容性和回滚；
- 改动文件、测试关注点和验收标准；
- `assumptions`、`conflicts`、`blockers`、`openQuestions`。

能从证据确定的直接填；低风险未知写显式假设；高风险未知暂停并一次只问一个。非交互/无人值守运行中不等待提问：缺少阻塞决策时输出 `Blocked`，不写 md、OpenAPI、看板或索引。

既有多篇文档必须全部读取并逐项标注承接范围。口径冲突按证据优先级记录；用户已否决的旧方案保留为 `conflicts(status=resolved)`，写清旧口径、否决证据、最终口径和实现禁令，不再计入 blocker。

### 3. 核对关键决策

信息槽位见 [查漏槽位](planning-slots.md#step-3-查漏槽位)，它是查漏表，不是问卷。简单任务最多补 2 个槽位，其他任务最多补 5 个；可以 0 问。

接口逐个分类：

| 分类 | 判定 | 产物 |
|---|---|---|
| 新增接口 | 新 method/path | API 设计 + OpenAPI + 看板 `apis[]` |
| 契约变更 | 请求/响应/状态码/错误码/鉴权输入变化 | API 设计 + OpenAPI + 兼容影响 |
| 行为变更 | 契约不变，只改校验、路由、过滤、状态或副作用 | 技术方案和测试；不重写 OpenAPI |
| 仅调用 | 不修改既有契约和行为 | 只写调用关系 |

新增库/表/字段/索引/约束未获明确同意时记为 blocker，不进入 Implementation Gate。

### 4. 确定产物路径

运行：

```text
node <helper> prepare-date-dir docs
node <helper> file-state docs/<日期>/<任务名>.md
```

- `MISSING`：继续生成；
- `EXISTS_READABLE`：读取后让用户选择覆盖、时间戳后缀、版本后缀、取消或增量更新；
- `EXISTS_UNREADABLE_OR_UNKNOWN`：停止为 blocker，不猜测不存在。

非交互运行遇到已存在或未知状态时停止，不默认覆盖。写入 md 时优先局部修改；禁止用宿主文件能力整体重写不相关既有内容。

### 5. 生成方案

按模式只加载模板锚点：

- `Standard`：[Standard 文档模板](template-standard.md#文档模板)；
- `IncrementalRevision`：文档模板中的增量修订段；
- `Compact`：[Compact 文档模板](template-compact.md#精简文档模板)。

不要一次性读取整份 reference。[examples.md](examples.md) 仅在用户要示例、字段仍歧义或首次结果未通过格式校验时，读取当前模式的一个示例。

核心要求：

- 事实带证据；未知写 `待补充` 或假设；
- 技术方案写清前置条件、执行顺序、最小改动、禁止改动和完成判定；
- 开闭原则、兼容性、事务/并发、错误路径、回滚和可观察验收必须落到具体位置；
- Todo 不得包含数据库写入、DDL 或未获授权的数据修复；
- 验证命令标记 `TestDependencyClass: Hermetic | ServiceBacked | LiveExternal | Mixed`；
- 默认 test/verify 不得依赖真实 AI/SaaS 密钥。

### 5.1 可选发布

- 存在新增接口或契约变更时，才读取并执行 [OpenAPI/Apifox 发布流程](publishing-openapi.md)。纯行为变更或仅调用跳过。
- 用户或项目规则明确要求看板时，才读取并执行 [HTML 看板发布流程](publishing-board.md)。否则记录 `BoardPublishStatus: NotRequested`。
- `Compact` 跳过全部发布流程。

### 6. 完成输出

按 [完成输出与恢复](completion.md) 中当前模式的格式回复，至少包含：

1. md 与可选产物路径；
2. 3 句关键决策；
3. 当前 Gate、blocker/conflict/assumption；
4. 逐条验证命令及 TestDependencyClass；
5. VCS 未纳管清单；不得自动 `git add` / `svn add`；
6. 可复制的当前宿主执行提示；
7. `【Workflow Brief】`，字段遵循共享模板；
8. 下一步：实现 → 验证 → `yan-code-review` → `yan-project-analysis mode=understanding` → 人工 review。

存在 blocker/conflict 时写 `Plan Gate 未通过`，不输出可直接执行的编码提示。

## 最终检查

- [ ] 模式选择有证据，未把简单实现升级成文档流程
- [ ] 事实、假设、冲突、阻塞项已分层
- [ ] API 分类逐接口完成；行为变更未进入 OpenAPI
- [ ] 数据库门禁与只读边界已遵守
- [ ] 目标路径状态已确定，未静默覆盖
- [ ] 可选发布仅在进入条件成立时加载
- [ ] 验证命令、VCS 状态、Gate 和 Workflow Brief 完整
- [ ] 未实现代码、未执行数据库写入、未提交

## 资源

- [planning-slots.md](planning-slots.md)：仅证据预填后仍需查漏时读取
- [template-compact.md](template-compact.md)：仅 Compact 读取
- [template-standard.md](template-standard.md)：仅 Standard / IncrementalRevision 读取
- [completion.md](completion.md)：完成输出、Workflow Brief 和失败恢复
- [reference.md](reference.md)：兼容索引，不作为运行时模板加载
- [examples.md](examples.md)：按需示例
- [publishing-openapi.md](publishing-openapi.md)：条件 OpenAPI 发布
- [publishing-board.md](publishing-board.md)：条件看板发布
- [scripts/validate-openapi.js](scripts/validate-openapi.js)：确定性 OpenAPI 校验
