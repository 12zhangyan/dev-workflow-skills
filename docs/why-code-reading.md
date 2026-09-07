# 什么时候需要 yan-project-analysis understanding

代码地图不是 Review 或开发的必经阶段。只有调用链、状态、副作用、契约或跨模块关系足够复杂，结构化解释能显著降低理解成本时，才使用 `yan-project-analysis mode=understanding`。

简单方法解释、范围清楚的实现和已有充分证据的 Review 可以直接完成，不默认生成代码地图。

## 两种交付方式

| 模式 | 适用目标 | 副作用 |
|---|---|---|
| `ImpactAnalysis` | 判断调用方、契约兼容性或影响范围 | 聊天交付，仓库零写入 |
| `CodeMap` | 用户明确需要持久化的调用链、状态、副作用或代码位置地图 | 写 `docs/code-reading/...`；看板另按授权决定 |

意图不清时优先副作用更小的 `ImpactAnalysis`。只有落盘与否会实质改变用户目标时才询问。

## 证据决定深度和表示法

Agent 从用户指定入口、符号、契约、当前 diff 或最可信搜索候选开始，只追踪到足以解释目标行为和影响边界。遇到动态分派、跨服务或不可见实现时明确停止位置，不按固定文件数、调用层数、变量读写次数或图表数量继续扩张。

流程图、状态图、表格和文字都是可选表达。关系复杂时用最小有用视图；一句话和路径索引已经足够时不要制图。

## 与开发和 Review 的关系

- understanding 只解释结构和影响，不把观察包装成 Bug，也不修改代码。
- 需要实施方案时使用 `yan-dev-doc`；已有 findings 的修复使用 `yan-code-review mode=repair`。
- 代码 Review 可以直接依据实际 diff、源码、契约和测试进行；是否先生成代码地图由当前风险和读者需要决定。
- 需要多个独立 reviewer 时，可直接按证据面委派；同工作区协作不要求先生成持久任务包。

CodeMap、Review、测试和人工验收可以按当前任务合并、重排、并行或省略不适用部分。数据库只读、秘密脱敏、写入授权和结论可复核性仍是硬边界。

## 按需产物

- CodeMap md 只在用户要求持久化时生成。
- HTML 看板只在用户或同任务交付约定明确要求时更新。
- Workflow Brief 只在真实跨 Agent、跨任务或延期恢复时生成。
- 本模式自包含运行，不依赖外部方法论 Skill。

## 自定义

- 修改路由和边界：`skills/yan-project-analysis/SKILL.md`
- 修改只读影响输出：`skills/yan-project-analysis/modes/understanding/impact-output.md`
- 修改持久代码地图骨架：`skills/yan-project-analysis/modes/understanding/codemap-template.md`

自定义时优先保留目标、证据边界和验收价值，不重新引入固定阶段、固定图数或按代码规模触发的阈值。
