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
| 生成 review task、分发多个 AI、汇总返回的 findings、生成 fix-handoff | `package` | 写审查文档与同一档案的看板事件，不改业务代码 |
| 已提供 findings / fix-handoff / 明确问题清单，并要求直接修复 | `repair` | 可改范围内代码和测试，并更新看板 |
| 没有现成 findings，明确要求同一 AI 审查、必要修复、验证并复审 | `loop` | 可改范围内代码和测试，并更新看板 |
| 只要求 review、检查、找问题、输出 findings，或没有明确修改授权 | `check` | 业务代码与正式文档只读；更新同一档案的看板事件 |

旧名称确定性映射：

- `review-check` → `check`
- `review-repair` → `repair`
- `review-loop` → `loop`
- `review-fix` → `package`

“review 一下”“看看有没有问题”等模糊表达默认 `check`，因为业务代码只读是最小权限。例外：当前输入只有未指定 mode 的统一入口（如仅发 `/yan-code-review`），且最近一份**同任务** `Workflow Brief.nextCommand` 明确指定 `yan-code-review mode=package`，同时 `source` / `artifacts` / `changed` 能与当前 yan-dev-doc 和实现 diff 对应时，优先跟随 Brief 选择 `package`，避免实现后先做一次纯 check 再生成审查任务包。显式要求 `check`/只读审查始终优先；Brief 跨任务、已过期、与当前 diff 不一致或多份 Brief 冲突时，不猜测继承，回退 `check` 并说明依据。该例外只授权选择不改业务代码的 `package`，不得据此进入 `repair` / `loop` 或扩大证据范围。

看板生命周期元数据是所有模式的标准产物，不视为修改业务实现的授权。只有模式会改变代码/正式文档写权限且用户意图无法从原话确定时，才问一个问题确认是否允许修改。

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
- `check` 期间不得修改业务代码或正式文档；若发现问题，只输出有证据的 finding，但必须按共享发布流程更新同一研发档案的 Review 事件。
- `repair` 必须有现成 finding/问题清单；没有时停止并建议 `check` 或 `loop`。
- `loop` 最多两个修复循环，不自动提交；小范围单模块默认 quick。
- `package` 没有外部 review 结果时只生成任务包，不编造 findings。
- 四种模式直接调用时都加载 [共享看板发布流程](../_shared/board-publish-flow.md)，优先凭 `deliveryId`、其次凭 `sourceDocPath` 更新同一档案；身份无法确定时显式输出 `BoardPublishBlocked: IdentityMissing`，不得创建 Review 孤岛。
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
