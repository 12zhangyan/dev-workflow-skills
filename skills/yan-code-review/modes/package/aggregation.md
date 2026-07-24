# Yan Code Review Finding Aggregation

## 汇总规则

### 分级

| 等级 | 判定 |
|------|------|
| Critical | 会导致数据错误、核心流程不可用、安全漏洞、生产事故，必须修 |
| Important | 高概率缺陷、重要回归、边界/异常会失败，修完再继续 |
| Minor | 可维护性、命名、局部测试增强，不阻塞但建议处理 |
| Rejected | 误报、无证据、超范围、与项目规范冲突、收益低 |

### 去重与 ID 归并

同一文件/方法/根因的问题合并为一条，保留：
- 最明确的证据
- 最高严重度
- 最可执行的修复建议
- 所有来源 AI：`Codex` / `Cursor` / `Claude`

Finding ID 规则（保证发现→修复→关闭全链路追溯；前缀语义见 [../../../_shared/workflow-chain.md](../../../_shared/workflow-chain.md#finding-id-命名体系全链路统一)）：
- 汇总后按最终严重度统一重编 `CR-n` / `IM-n` / `MI-n`，拒绝项标 `RJ-n`、阻塞项标 `BK-n`；在该条 finding 的「来源」里保留各 AI 的原始编号（如 `Codex#2 / Cursor#1`），便于回溯是谁提的。
- 多 AI 对同一问题给了不同 ID 时合并为一个最终 ID，不要产生两条。
- 修复交接、AI 修复操作码、回填表都用同一套最终 ID；`review-repair` 按此 ID 回填 fixed/deferred/deferred-next-batch/blocked/rejected，不得另起编号。

### 接受标准

Accepted finding 必须同时满足：
- 能定位到文件、方法、接口或数据路径
- 有证据，不只是"可能"
- 能说明影响
- 有修复方式
- 有验证方式

不满足时降级为 Minor 或 Rejected。

### 材料不足

如果 review 结果指出关键证据缺失（例如没有 diff、没有关键源码、yan-dev-doc 与代码不匹配、状态/权限语义未确认），先归入 `OpenQuestions` 或 `blockers`，不要生成可直接执行的修复操作码。只有证据补齐或用户明确确认口径后，才能进入修复交接。

---
