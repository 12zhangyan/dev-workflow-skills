---
name: yan-project-analysis
description: 统一处理低频但相邻的项目分析任务，并按目标读者与产物选择 understanding（代码地图、调用链、接口兼容影响；可零写入）、incident（Bug 现象、复现、根因证据和修复边界文档）或 business（面向测试/产品的业务流、数据流、状态机和测试关注点）模式。用户要求理解代码结构/影响、记录事故或 Bug、梳理业务流程时使用；不直接实现功能、不执行 review findings 修复。兼容旧名称 code-reading、bug-fix、biz-flow。
---

# Project Analysis 统一入口

## 目标

把三个低频分析入口收敛为一个名字，但保持读者、产物和写权限差异。先选模式，再只读取一个 mode。

## 模式选择

| 用户期望 | 模式 | 默认产物 |
|---|---|---|
| 理解调用链、代码结构、接口契约或兼容影响；生成代码地图 | `understanding` | 影响分析默认聊天零写入；明确要求代码地图时生成文档 |
| 记录单次故障/事故，沉淀现象、复现、根因证据和修复边界 | `incident` | `docs/bugs/...` |
| 给测试/产品讲清角色入口、业务流、数据流、状态和阶段数据变化 | `business` | `docs/biz-flow/...` |

旧名称映射：

- `code-reading` → `understanding`
- `bug-fix` → `incident`
- `biz-flow` → `business`

分界规则：

- “正常业务怎么走、怎么测”是 `business`；“这次为什么坏、如何复现”是 `incident`。
- “哪些调用方受影响、代码怎么串起来”是 `understanding`；“怎么实施改造”交给 `yan-dev-doc`。
- 用户只要聊天解释一个简单方法且不需要系统性追踪时，不触发本 skill。
- 用户要求直接改代码时退出本 skill；已有 review findings 交给 `yan-code-review repair`。

## 路由与证据失败分支

| 触发条件 | 一线处理 | 仍失败时的兜底 |
|---|---|---|
| 两个及以上模式都可能命中 | 先按用户要求的主要产物和目标读者选择，并输出选择依据；此时不预加载任何 mode | 若歧义会改变写权限、产物路径或分析边界，交互会话只问一个阻塞问题；非交互运行输出 `Blocked: AnalysisModeAmbiguous`，保持零写入 |
| 关键代码、日志、接口或状态证据缺失、不可读 | 只用可复核证据标记已证实项，把缺口列为待确认，不跨 mode 猜测 | 若证据不足以支撑该 mode 的核心结论，`understanding` 只给最小取证清单，`incident` 只给诊断计划，`business` 只给草稿/blocker；不得编造调用链、根因或业务闭环 |
| 用户在分析过程中要求直接实现或修复 | 立即停止分析产物写入，按已有授权路由普通实现流程或 `yan-code-review repair` | 修改授权、findings 或实施边界不完整时保持只读，列出缺失输入；不得把分析请求升级为代码修改授权 |
| 选定的 `mode.md` 缺失或不可读 | 输出 `Blocked: AnalysisModeResourceUnavailable` 和目标资源路径，不加载其他 mode 代替 | 做一次最小路径复核后仍不可读则终止该 skill，保持零写入，不用根入口臆造子模式流程 |

## 渐进加载

先遵循 [三端宿主能力协议](../_shared/host-capabilities.md)，不臆造 Claude Code、Cursor 或 Codex 的工具名。

路由和执行都遵循 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)；输入或输出含 `【Workflow Brief】` 时同时遵循 [../_shared/workflow-brief.md](../_shared/workflow-brief.md)，把 Brief 当作证据索引而不是事实证明。

选定模式后只读取：

- `understanding`：[modes/understanding/mode.md](modes/understanding/mode.md)
- `incident`：[modes/incident/mode.md](modes/incident/mode.md)
- `business`：[modes/business/mode.md](modes/business/mode.md)

模板和示例仅在对应 mode 要求时读取其同目录 `reference.md` / `examples.md`。

## 统一边界

- 启动时输出 `ProjectAnalysisMode` 和选择依据。
- 所有模式只做分析和知识产物，不直接实现或修复代码。
- `understanding` 的 ImpactAnalysis 必须零写入；只有明确要求代码地图/持久化产物时才写文档。
- `incident` 根因未证实时只能给诊断计划，不得把推断写成确定修复方案。
- `business` 缺少闭环入口、状态或数据证据时输出草稿/blocker，不编造业务流程。
- HTML 看板沿用所选 mode 的既有规则：`incident`、`business` 和 `understanding` 的 CodeMap 登记看板；ImpactAnalysis 严格不写。模板不可用时显式记录跳过原因。
- 数据库只读；不执行 DDL 或数据修复。
- 旧产物路径保持不变：`docs/code-reading/...`、`docs/bugs/...`、`docs/biz-flow/...`。

## 输出

```text
ProjectAnalysisMode: <understanding|incident|business>
LegacyAlias: <none|code-reading|bug-fix|biz-flow>
BoardPublishStatus: <Published|SkippedUnavailable|NotApplicable>
```

其余内容使用对应 mode 的输出模板。
