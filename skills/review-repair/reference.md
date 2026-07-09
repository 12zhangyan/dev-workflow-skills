# review-repair Reference

> `review-repair` 的 findings 归一化、修复结果输出和示例。该 skill 会修改代码，不能用于只读审查。

---

## Findings 归一化

| 类别 | 判定 | 处理 |
|------|------|------|
| accepted | 有文件/方法/行为证据，有明确修复和验证方式 | 直接修复 |
| needs-confirmation | 涉及业务语义、权限、状态、接口契约、DB 结构、数据修复或证据冲突 | 暂停并问一个阻塞问题 |
| rejected | 误报、无证据、超范围、纯风格偏好、与项目规范冲突 | 不修，说明原因 |
| deferred | Minor 或低收益建议，修复会扩大范围 | 记录，不默认处理 |

## 修复计划模板

```markdown
## 修复计划

| ID | 级别 | 文件/位置 | 问题 | 修复动作 | 验证方式 |
|----|------|-----------|------|----------|----------|
| CR-1 | Critical | <path:line/method> | <问题> | <最小修复动作> | <命令/用例> |
```

## 完成输出格式

```text
修复结论：Fixed / PartiallyFixed / Blocked
工作流阶段：Review Repair 已完成；下一步回到 Verification Gate / 二次 review-check / Submit Gate

处理结果：
| ID | 来源 | 状态 | 文件/位置 | 处理说明 | 验证 |
|----|------|------|-----------|----------|------|
| CR-1 | review-check | fixed | <path:line/method> | <改了什么，为什么能关闭> | <命令 + 结果> |
| IM-1 | review-check | blocked | <path:line/method> | <阻塞原因> | <待确认> |

修改文件：
- <path>：<本次修复承担的角色>

验证结果：
- <命令>：<通过/失败/未运行 + 摘要>

VCS 完整性：
- <git status --short / svn status 摘要>
- 新增文件纳管提醒：<无 / 需 git add / 需 svn add>

后续建议：
- <是否需要二次 review-check；是否可进入 code-reading / 人工 review / Submit Gate>

【Skill 反馈给 Codex】
- skill：review-repair
- 本次场景：<findings/fix-handoff/自然语言问题清单>
- 运行评价：<顺畅 / 有小问题 / 有阻塞>
- 建议：
  1. <无，或一条可落地的 skill 改进建议>
- 证据：
  - <本次多问/漏问/误判/模板不足的具体表现；没有则写 无>
```

## 示例 1：review-check findings 后直接修复

输入：
```text
Critical:
1. Severity: Critical
   File/Line: src/main/java/.../OrderService.java:88
   Problem: null customerId 会继续查询并触发 NPE
   Fix: 入参校验并返回业务异常
   Verify: mvn -pl order-service test
```

输出要点：
- 读取 `OrderService` 和相邻异常处理模式。
- 最小修改入参校验。
- 补或调整单元测试覆盖 `customerId == null`。
- 运行模块级测试。
- 输出 `CR-1 fixed`，附验证结果。

## 示例 2：需要阻塞确认

输入：
```text
Important:
File/Line: AssetService#reject
Problem: 驳回时应该把状态从 VRF 改回 ELM
Fix: 修改状态流转
```

处理：
- 如果现有状态机/字典显示 `VRF -> ELM` 语义不明确，不能猜着改。
- 输出 `blocked`，只问一个问题：驳回后是否恢复到编辑态 `ELM`，还是进入单独驳回态。

## 示例 3：Rejected 不处理

输入：
```text
Minor: 建议把所有 if 改成 Optional 链式写法
```

处理：
- 如果没有缺陷证据，归为 `rejected` 或 `deferred`。
- 不做风格重构。
