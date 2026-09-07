---
name: yan-project-analysis
description: 统一处理低频但相邻的项目分析任务，并按目标读者与产物选择 understanding（代码地图、调用链、接口兼容影响；可零写入）、incident（Bug 现象、复现、根因证据和修复边界文档）或 business（面向测试/产品的业务流、数据流、状态机和测试关注点）模式。用户要求理解代码结构/影响、记录事故或 Bug、梳理业务流程时使用；不直接实现功能、不执行 review findings 修复。兼容旧名称 code-reading、bug-fix、biz-flow。
---

# Project Analysis 统一入口

按读者与结果选择最小分析模式；本 Skill 只分析和产出知识材料，不直接实现或修复代码。

## 模式选择

| 用户期望 | 模式 | 默认产物 |
|---|---|---|
| 理解调用链、代码结构、接口契约或兼容影响；生成代码地图 | `understanding` | 影响分析默认聊天零写入；明确要求代码地图时生成文档 |
| 记录单次故障/事故，沉淀现象、复现、根因证据和修复边界 | `incident` | `docs/bugs/...` |
| 给测试/产品讲清角色入口、业务流、数据流、状态和阶段数据变化 | `business` | `docs/biz-flow/...` |

`code-reading / bug-fix / biz-flow` 分别映射到 `understanding / incident / business`。简单解释单个方法不触发；要求实施时退出本 Skill，开发方案交给 `yan-dev-doc`，已有 review findings 交给 `yan-code-review repair`。

## 自主路由

- 单一结果只选一个 mode。复合请求可按不同读者、产物或写权限拆成独立切片；互不依赖的只读取证可并行委派给任意数量、任意角色的 Agent，不预设角色名或步骤。
- 同一产物只由一个 Agent 整合写入；合并前核对各切片的证据范围、版本和冲突。业务口径、授权或写入边界不因拆分而改变。
- 证据缺失时保留可证实部分：`understanding` 给影响边界或取证项，`incident` 给诊断计划，`business` 给草稿或 blocker，不编造调用链、根因或闭环。
- 只有歧义会改变写权限、路径或结论边界且证据不能裁决时才提问；无人值守先完成安全的只读部分，受影响写入标 `Blocked`。
- 选定的 `mode.md` 缺失或不可读时报告 `Blocked: AnalysisModeResourceUnavailable`，不加载其他 mode 代替。

## 渐进加载

仅当宿主差异实际影响可用能力、写权限或委派方式时，才读取 [三端宿主能力协议](../_shared/host-capabilities.md)，不臆造工具名。

需要提问、处理证据冲突或无人值守缺材料时，才读取 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)。输入或输出实际使用 `【Workflow Brief】` 时才读取 [../_shared/workflow-brief.md](../_shared/workflow-brief.md)，把 Brief 当作证据索引而不是事实证明。

选定模式后只读取：

- `understanding`：[modes/understanding/mode.md](modes/understanding/mode.md)
- `incident`：[modes/incident/mode.md](modes/incident/mode.md)
- `business`：[modes/business/mode.md](modes/business/mode.md)

模板和示例仅在对应 mode 要求时读取其同目录 `reference.md` / `examples.md`。

## 统一边界

`ImpactAnalysis` 严格零写入；`incident` 不把未证实假设写成根因；`business` 不编造入口、状态或数据闭环。HTML 看板仅在用户明确要求或 Brief 明确要求同步时发布，且 ImpactAnalysis 始终不写。数据库只读，不执行 DDL 或数据修复；不自动 add、commit 或 push。持久产物路径仍为 `docs/code-reading/...`、`docs/bugs/...`、`docs/biz-flow/...`。

## 输出

按实际结果报告模式、证据边界、产物或零写入结论、未决项和下一目标；只在旧名称或看板实际参与时补充对应状态，不制造固定回执。
