---
name: yan-code-review-loop
description: 同一 Agent 在明确修改授权下，基于当前实现证据自主完成只读审查、必要修复、目标验证和聚焦复审；不生成无用任务包，不自动提交或推送。
---

# Review–Repair Loop

## 目标与边界

用于“审查并在必要时修复”，且尚无一组可直接交给 repair 的 findings。只读任务用 `check`，已有 findings 用 `repair`，需要独立多 reviewer 或外部聚合用 `package`。本模式是单 Agent 闭环，不能冒充独立交叉审查。

不执行数据库写入、DDL、add/commit/push，也不回滚无关改动。涉及业务语义、权限、状态、API/数据契约或数据归属且证据无法裁决时，只阻塞相关 finding；需要提问时读取 [交互策略](../../../_shared/interaction-policy.md)。

## 自主闭环

先用当前规则、代码、Git/SVN status、实际 diff、范围内未跟踪文件和测试证据判断是否有可审实现。没有实现证据时返回材料缺口；未跟踪文件仍可审查和修复，但必须保留纳管风险，不能擅自 add。

有实现证据时读取并执行 [check mode](../check/mode.md)，保持首审零写入。没有 accepted finding 就停止修复；存在 accepted finding 且在授权范围内时，读取并执行 [repair mode](../repair/mode.md)。内部模式按需加载自己的参考，本模式不预加载。

代码变化后选择能证明目标行为的真实验证，再读取最新 status/diff，聚焦复审原问题、相邻风险和测试有效性。Agent 可按新证据继续修复、拆分 blocker、调整测试或停止；不设为了流程完整而必须跑满的轮次。出现以下任一条件即停止受影响路径：

- 没有新证据或连续动作没有实质进展；
- 需要新的业务裁决、权限或明显扩大范围；
- 验证环境无法继续且没有安全替代证据；
- 剩余收益低于继续改动引入的风险。

需要解释 VCS、验证或 Gate 结论时才读取 [工作流门禁](../../../_shared/workflow-gates.md)。测试契约失败不能伪装成环境阻塞，也不能用假凭据换取通过。

## 完成与交接

finding ID 在审查、修复和复审间保持稳定；只有最新实现与验证证据都支持时才关闭。未关闭 Critical/Important、验证未满足用户验收要求或关键文件未纳管时，不宣称 Review/Submit 通过。

默认在聊天中简洁报告实际审查范围、findings 状态、修改、验证、VCS/未跟踪边界和剩余风险。只有用户要求持久审计格式或表达仍歧义时读取 [回执参考](reference.md)。无代码变化无需机械复审；未运行测试不是 finding，但可能意味着用户目标尚未完成。

真实跨 Agent、跨任务或延期恢复时才读取 [Workflow Brief](../../../_shared/workflow-brief.md)。仅在需要消除“单/多 Agent”歧义或供机器消费时输出 `ReviewAgentMode: SingleAgentReview` 等标签；不强制固定回执字段、修复轮次数或“唯一下一动作”。
