# Yan Code Review Package Task Template

## Review 任务包模板

````markdown
# <任务名> Review 任务包

> 日期：<YYYY-MM-DD>
> 来源：<yan-dev-doc / bug/business 文档 / patch / 当前工作区>
> 审查对象：<方案 / 实现 / 修复交接>
> 验证证据：<命令与结果 / 未运行及原因>

## 一、目标与结论边界

- **要确认的结果**：<本次 Review 成功的可观察判据>
- **范围**：<模块、接口、状态、finding 或方案章节>
- **不在范围**：<明确排除项>
- **结论边界**：<PlanReview 不评价实现；ImplementationReview 必须核对实际 diff；未运行测试不写通过>

## 二、证据索引

| 类型 | 路径/命令 | 已核对状态 | 用途 |
|------|-----------|------------|------|
| 需求/方案 | <path 或无> | <已读/缺失> | 目标与约束 |
| 实际 diff/status | <VCS owner + command/path> | <已读/缺失> | 实现与提交完整性 |
| 关键源码/测试 | <paths> | <已读/待 reviewer 深挖> | 风险定位 |
| 验证 | <command + result> | <状态> | 证明目标逻辑 |

### 假设、冲突与阻塞

| ID/类型 | 内容 | 证据 | 是否阻塞 |
|---------|------|------|----------|
| <assumption/conflict/BK-n> | <内容> | <路径:行/命令> | <是/否> |

## 三、Reviewer ledger

只分配能独立降低风险的互补视角。主 Agent 更新这一张表，不另建重复的回收状态表。

| Reviewer | ReviewFocus | 原因与证据范围 | 状态 | Source IDs → Canonical IDs | 覆盖缺口 |
|----------|-------------|----------------|------|----------------------------|----------|
| <角色/来源> | <业务正确性 / 事务并发 / 安全 / 测试有效性 / 其他> | <为何需要；路径/方法/测试> | <待执行/完成/失败> | <原编号 → CR/IM/MI/RJ/BK> | <无/未覆盖边界> |

## 四、跨宿主便携审查提示

```text
请独立完成本次审查；返回结果前不要读取或参考其他 reviewer 的 findings。

任务包：<当前 Review 任务包路径>
ReviewFocus：<分配的视角；未分配则做全局高风险审查>

先核对审查对象、证据索引和验证边界，再读取与视角有关的实际 diff/源码/测试。若当前环境已安装本仓库 Skill，可使用 yan-code-review mode=check；否则直接按任务包审查。初审结果只返回协调者，不自行发布看板或修改产物。

只报告有可复核证据、可能影响正确性、业务语义、数据、安全、并发、兼容或验证有效性的问题。可以报告视角外的 Critical，但不要为了覆盖清单制造问题，不要修改代码/正式文档，不要执行数据库写入。

每条 finding 返回：
- Severity: Critical | Important | Minor
- File/Line: 路径:行或方法名
- Problem / Evidence / Impact / Fix / Verify

材料不足时返回 MaterialStatus: insufficient、缺失证据和无法判断的边界；不要用“未发现问题”代替材料不足。
```

## 五、Workflow Brief

<按共享格式写入唯一一份 Brief；聊天只返回本任务包路径。若生成 fix-handoff，则由 fix-handoff 接替为最新 Brief 所在产物。>

````
