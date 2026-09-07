---
name: yan-code-review-repair
description: 根据已有 code review findings、fix-handoff 或明确问题清单修改代码并验证；没有可定位问题时不进入修复。由 yan-code-review 根入口的 repair mode 加载。
---

# 按 Findings 修复

## 目标与权限

在用户授权范围内关闭有证据的问题，并用最新 diff、验证结果和 VCS 状态证明结果。可修改 accepted finding 所需的代码和测试；不提交、不写数据库、不覆盖或格式化无关改动。

输入必须包含可定位的问题。只有方案、review task 或未形成 finding 的 diff 时不修复；用户要求从审查开始则回到 `check` 或 `loop`。

## 裁决 Findings

从原始 finding 和当前证据判断哪些可以执行：

- 有定位、证据、期望行为和验证方式的项可接受；已有 canonical ID 原样保留。
- 业务、权限、状态、API/数据结构或证据冲突不能自主裁决时，保留 `BK-n`，只阻塞相关项。
- 误报、无证据、超范围或纯风格项保留 `RJ-n` 和依据；暂不处理的真实问题说明 deferred 边界。
- 同一 ID 指向不同根因时停止覆盖；共享根因可以合并修复，但保留来源。

复杂归一化或需要审计回执时才读取 [补充参考](reference.md)。需要处理冲突时读取 [交互策略](../../../_shared/interaction-policy.md)，需要解释 Gate 口径时读取 [工作流门禁](../../../_shared/workflow-gates.md)，实际收到或生成 Brief 时读取 [Workflow Brief](../../../_shared/workflow-brief.md)。

## 自主实施与验证

Agent 按依赖、风险、VCS owner、共享根因和可独立验证性合并、拆分、排序或并行处理，不按 finding 数、文件数或固定轮次执行。开始前识别各文件最近的 Git/SVN owner、status/diff 和已有改动；取证失败不能假定 clean。

只修改已接受问题所需范围。每个可独立裁决的切片在合适时机检查最新 diff，并运行能证明目标行为的验证；失败相关时继续定位，出现授权缺口、语义 blocker 或范围失控时停止受影响切片，其他独立项可继续。结束前复查实际 diff、未跟踪关键文件和敏感信息。

验证只报告本轮真实命令、结果及证明边界。命令成功但未执行/断言目标逻辑不算通过；默认 CI 依赖真实密钥或不可控服务是测试契约失败，不是环境阻塞，也不能伪造密钥。外部依赖分类只在失败归因或交接需要时输出。

是否再做独立 check 由公共契约、权限/状态/并发风险、改动幅度和验证缺口决定，不作为固定收尾步骤。

## 完成

loop/package 内部调用只向协调者回传，由协调者决定是否按根入口规则发布。结果说明实际修改、每个输入 ID 的事实性结果及依据、验证证据、VCS/未跟踪边界和剩余风险；可以使用 `fixed/rejected/deferred/blocked` 等词，但不为套枚举歪曲事实。只有实现与验证均能关闭问题时才标已修复；VCS 纳管状态另行判断，未关闭高风险项或验证失败时不宣称 Review/Submit 通过。
