# Yan Code Review Fix Handoff Template

## 修复交接模板

findings 只写在一张表里，按 Critical → Important → Minor 排序；“结果”列由 repair 回填，不另建 Todo 或回填表。没有 Rejected / Blocker 时删掉对应小表。

````markdown
# <任务名> Review 修复交接

> 状态：待修复 / 修复中 / 已修复待复核 / 已关闭 ｜ 日期：<YYYY-MM-DD>
> Review 任务包：<docs/review-fix/YYYY-MM-DD/task-review-task.md>
> 审查基线：<VCS 分支@修订 + 审查时的 diff 标识；修复前与当前工作区不一致时先报告漂移>

## Findings
| ID | 严重度 | 来源 | 位置 | 问题与影响 | 修复要求 | 验证 | 结果（repair 回填） |
|---|---|---|---|---|---|---|---|
| CR-1 | Critical | <reviewer#source-id> | <路径:行> | | <可观察结果> | <测试或命令> | <Fixed / Blocked / Rejected / Deferred；实际改动；命令、退出码与关键输出> |
| IM-1 | Important | | | | | | |
| MI-1 | Minor | | | | | | |

### Rejected
| ID | 来源 | 原建议 | 拒绝原因 |
|---|---|---|---|
| RJ-1 | | | |

### Blockers
| ID | 来源 | 证据 | 阻塞原因 | 最小确认问题 |
|---|---|---|---|---|
| BK-1 | | | | |

## 修复边界
- 修改范围：只修改 accepted findings 涉及的文件和必要测试；不重构无关代码。修复顺序由执行 Agent 按风险、依赖和共享根因决定。
- 禁止改动：<接口签名 / 数据结构 / 公共工具 / 无关本地改动>
- 待确认：`BK-n` 确认前不执行对应代码修改；DDL / 数据修复只输出建议，不执行。

## 下一动作

```text
使用 yan-code-review skill，mode=repair，读取 <本 fix-handoff 路径>；按 canonical finding ID 修复，并在 Findings 表“结果”列回填实际验证结果。
```

## Workflow Brief

<需要跨任务恢复时按共享格式写入唯一一份 Brief，next 使用上面的完整 repair 提示。>
````
