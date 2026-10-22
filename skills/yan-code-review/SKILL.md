---
name: yan-code-review
description: 代码审查与 findings 闭环。用于只读找问题、修复已有 findings、审查并修复，以及独立多 reviewer 或结果汇总；未授权修改时只读。兼容 review-check、review-repair、review-loop、review-fix。
---

# Code Review

## 目标

根据用户意图选择最小权限模式，用真实代码、diff、VCS 和验证证据发现或关闭问题。模式决定写权限，不规定 Agent 的审查顺序、角色数量、测试组合或表达格式。

## 路由

| 意图 | 模式 | 权限 |
|---|---|---|
| 只审查、找问题，或没有明确修改授权 | `check` | 只读 |
| 已有 findings/明确问题，只要求修复 | `repair` | 可改问题涉及的代码与测试 |
| 明确要求审查并按需修复（可附带已知 findings 作为首审输入） | `loop` | 可在授权范围内修改 |
| 独立多 reviewer、外部分发、汇总结果或修复交接 | `package` | 可写必要协作产物，不改业务代码 |

旧名称 `review-check / review-repair / review-loop / review-fix` 分别映射为以上四种模式。模糊的 review 请求选择 `check`；同任务 Brief 的 `next` 可在证据吻合时指向 `package`，但 Brief 不能授予修复权限。旧 Brief 字段只读兼容。

确定模式后只读取对应入口：

- [check](modes/check/mode.md)
- [repair](modes/repair/mode.md)
- [loop](modes/loop/mode.md)
- [package](modes/package/mode.md)

只有宿主能力影响执行时读取 [宿主能力](../_shared/host-capabilities.md)；需要提问或处理冲突时读取 [交互策略](../_shared/interaction-policy.md)；实际接收或生成 Brief 时读取 [Workflow Brief](../_shared/workflow-brief.md)。模式入口会说明其余资源的按需条件，不预加载其他模式。

## 不可越过的边界

- `check` 不改代码、测试或正式文档；`repair` 必须有可定位的问题；`loop` 必须有明确修改授权。
- 多 reviewer 保持独立，只汇总真实返回；委派失败不编造 findings。
- 看板：`repair`、`loop`、`package` 的发布所有者在稳定交付身份能匹配已有档案时默认同步审查/修复事件；`check` 只在用户明确要求记录生命周期时同步。身份为 `deliveryId` 或来源方案 `docPath`，用 `workflow-fs.js contains project-html/data/changes.js <身份值>` 判断（传具体值，不传字段名）；只从 PR/提交出发、没有方案文档时视为无身份；`kind:"bug"` 等其他条目不是交付档案。看板或档案不存在时不新建孤立 Review 条目；用户明确不要看板时跳过。届时才读取 [看板发布流程](../_shared/board-publish-flow.md)。内部 reviewer/repair 不发布，由协调者至多汇总写入一次；无发布动作时不输出看板状态字段。
- 数据库只读；不执行 DDL、数据修复，不写入或暴露凭据。
- 不自动 add、commit、push、merge、发布或回滚无关改动。
- finding 保留稳定 ID、定位、证据和影响；修复方向或验证建议只在有把握且有助于后续时给出。材料不足不冒充通过；审查中断、超限或部分失败也不能由零 findings 推导为通过。

## 输出

先给用户结论、关键证据、实际改动/验证和仍未关闭的风险。每条 finding 以 check mode 定义的稳定 ID 开头，后接严重度、定位、问题与当前状态，例如 `IM-1（Important）src/a.js:12 — 未校验归属 — 已修复`；不改用 `F1`、`#1` 等自拟编号。仅在路由可能含混、需要机器交接或用户要求审计格式时补 `CodeReviewMode`、状态标签或完整回执；下一动作按真实缺口给出，可以没有，也可以有多个可独立推进的动作。
