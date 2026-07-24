---
name: yan-code-review
description: 统一处理代码审查相关任务，并根据用户是否允许修改、是否已有 findings、是否需要多 AI 分发，选择 check（只读审查）、repair（按现有 findings 修复）、loop（同一 AI 审查→修复→验证→复审）或 package（生成多 AI review 任务包/汇总 findings）模式。用户提到 review、代码审查、修复 findings、一键审查并修复、生成 review task、让多个 AI 独立审查时使用。仅说“看看有没有问题”必须保持只读 check；只有明确要求修改且有 findings 才用 repair，没有 findings 但明确要求审查并修复才用 loop。兼容旧名称 review-check、review-repair、review-loop、review-fix。
---

# Code Review 统一入口

## 目标

让用户只记住一个 Review 入口，同时保留原有只读、写修复、闭环编排和多 AI 分发边界。先确定模式和写权限，再只读取该模式的指令；不要一次加载全部 mode。

## 模式选择

按以下优先级选择且只选择一个模式：

| 用户意图/证据状态 | 模式 | 写权限 |
|---|---|---|
| 生成 review task、分发多个 AI、汇总返回的 findings、生成 fix-handoff | `package` | 只写审查文档，不改业务代码 |
| 已提供 findings / fix-handoff / 明确问题清单，并要求直接修复 | `repair` | 可改范围内代码和测试 |
| 没有现成 findings，明确要求同一 AI 审查、必要修复、验证并复审 | `loop` | 可改范围内代码和测试 |
| 只要求 review、检查、找问题、输出 findings，或没有明确修改授权 | `check` | 严格只读 |

旧名称确定性映射：

- `review-check` → `check`
- `review-repair` → `repair`
- `review-loop` → `loop`
- `review-fix` → `package`

“review 一下”“看看有没有问题”等模糊表达默认 `check`，因为只读是最小权限。只有模式会改变写权限且用户意图无法从原话确定时，才问一个问题确认是否允许修改。

## 渐进加载

路由和执行先遵循 [三端宿主能力协议](../_shared/host-capabilities.md)，再遵循 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)；输入或输出含 `【Workflow Brief】` 时同时遵循 [../_shared/workflow-brief.md](../_shared/workflow-brief.md)，把 Brief 当作证据索引而不是修改授权。

选定模式后只读取对应文件：

- `check`：[modes/check/mode.md](modes/check/mode.md)
- `repair`：[modes/repair/mode.md](modes/repair/mode.md)
- `loop`：[modes/loop/mode.md](modes/loop/mode.md)
- `package`：[modes/package/mode.md](modes/package/mode.md)

模式文件要求模板时，再读取同目录 `reference.md`；需要示例时只读同目录 `examples.md`。`loop` 仅在实际进入相应阶段时读取 `check / repair / package` mode，不预加载。

## 统一边界

- 启动时输出 `ReviewMode: check|repair|loop|package` 和选择依据。
- `check` 期间不得写文件或修改代码；若发现问题，只输出有证据的 finding。
- `repair` 必须有现成 finding/问题清单；没有时停止并建议 `check` 或 `loop`。
- `loop` 最多两个修复循环，不自动提交；小范围单模块默认 quick。
- `package` 没有外部 review 结果时只生成任务包，不编造 findings。
- 数据库始终只读；DDL、数据修复只生成 DBA 申请材料。
- 不自动 commit、push、merge、发布，不回滚无关本地改动。
- 旧产物路径继续兼容：`docs/review-fix/...`、`CR/IM/MI/RJ/BK` finding ID 和 Workflow Brief 字段不变。

## 输出

最终答复首行保留所选模式：

```text
CodeReviewMode: <check|repair|loop|package>
LegacyAlias: <none|review-check|review-repair|review-loop|review-fix>
```

其余输出严格使用对应 mode 的模板和门禁结论。
