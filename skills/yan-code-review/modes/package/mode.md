---
name: yan-code-review-package
description: 组织共享证据边界下的独立多 reviewer 审查，或汇总已有 review 结果；仅在外部回传、延期恢复、审计留档或用户要求时生成任务包和修复交接。由 yan-code-review 根入口的 package mode 加载。
---

# 多 Reviewer 协作

## 目标与权限

按实际风险分配彼此独立的只读 reviewer，并把真实结果归一为可复核 findings。当前宿主能委派时直接并行协作，不要求先落盘任务包；不能委派时，只在确实需要外部继续时生成便携材料。

本模式不修改业务代码。reviewer 首轮独立取证，不写代码、测试、正式文档、看板、VCS 或数据库；协调 Agent 是协作产物的唯一写入者。收到结果后可针对冲突或证据缺口定向复核。委派不扩大用户原有权限。

## 共同证据边界

从用户输入、当前对话或 Brief 识别目标、方案、actual diff/status、变更文件、VCS owner、测试证据和已有 findings。方案审查必须说明未审实现；实现审查必须能读取实际实现证据；材料不足只列最小缺口，不创建貌似可执行的结论。

主 Agent 只预取足以界定范围、风险和 reviewer 视角的证据；reviewer 按焦点读取完整实现，主 Agent 聚合时复核 finding 指向的证据。VCS 命令失败保留错误，空输出不等于 clean。验证只报告实际命令、结果和证明边界；外部依赖分类仅在失败归因或交接有价值时使用。

需要处理冲突时读取 [交互策略](../../../_shared/interaction-policy.md)，需要解释 Gate 时读取 [工作流门禁](../../../_shared/workflow-gates.md)，实际接收或生成 Brief 时读取 [Workflow Brief](../../../_shared/workflow-brief.md)。

## 没有可聚合结果时

宿主能委派且证据足够时，Agent 自主选择能独立降低风险的互补视角，数量由风险面、可并行边界和可用容量决定；简单任务可以单视角，高风险复杂任务可以尽量并行。每个 reviewer 接收同一目标/范围/证据索引和独立焦点，返回有定位、证据与影响的 findings，并按把握补充修复或验证建议。

主 Agent 记录实际成功、失败和覆盖缺口，并验证返回证据。至少两个独立 reviewer 成功返回时才称为多 reviewer 结果；数量不足仍可保留有效结论，但必须披露覆盖边界，不用固定状态标签代替说明。

委派不可用、需要外部回传/延期恢复/审计留档，或用户明确要任务包时，才读取 [任务包模板](review-task-template.md#review-任务包模板)。尊重用户或项目路径约定；没有约定时才用 [workflow-fs.js](../../../_shared/scripts/workflow-fs.js) 创建 `docs/review-fix/<日期>/`，写入前检查路径状态，不默认覆盖。任务包只保留目标与边界、证据索引、按风险选出的视角、便携提示和真实协作状态。若没有继续协作需求，直接报告能力与覆盖缺口。

## 聚合与修复交接

收到当前委派或外部 review 结果后，才读取 [聚合规则](aggregation.md#汇总规则)。合并同一根因并保留来源别名；accepted finding 归一为 `CR/IM/MI`，误报/无证据/超范围为 `RJ`，待业务裁决为 `BK`。独立结果均无问题时，给出覆盖边界，不生成空 findings 或修复交接。

只有用户要求修复交接、需要另一 Agent/任务继续，或当前上下文不能直接消费 findings 时，才读取 [修复交接模板](fix-handoff-template.md#修复交接模板) 并生成 `*-fix-handoff.md`。交接只包含 accepted findings、blockers、修复边界、验证要求和可执行提示；不复制完整 reviewer 原文。`BK` 未裁决时不能下发对应修复。

## 发布与完成

默认直接汇报审查范围、reviewer 覆盖/失败、有效 findings、验证边界、实际产物和未决风险。需要正式审计回执时才读取 [完成格式](completion.md)。跨任务恢复时只保留一份 Brief。不要强制 `Packaged/PartiallyReviewed`、固定角色数、固定下一动作或任务包阶段；只报告真实发生的协作和最有价值的后续动作。
