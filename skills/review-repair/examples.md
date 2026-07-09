# review-repair Examples

## 示例：完整修复输出

```text
修复结论：Fixed
工作流阶段：Review Repair 已完成；下一步回到 Verification Gate，通过后可进入 code-reading / 人工 Review

处理结果：
| ID | 来源 | 状态 | 文件/位置 | 处理说明 | 验证 |
|----|------|------|-----------|----------|------|
| CR-1 | review-check | fixed | src/main/java/com/acme/order/OrderService.java:88 | 增加 customerId 空值校验，复用当前模块 BusinessException 口径，避免继续查询触发 NPE | mvn -pl order-service test：通过 |
| IM-1 | review-check | fixed | src/test/java/com/acme/order/OrderServiceTest.java | 新增空 customerId 用例，覆盖异常路径 | mvn -pl order-service test：通过 |

修改文件：
- src/main/java/com/acme/order/OrderService.java：补入参校验。
- src/test/java/com/acme/order/OrderServiceTest.java：补异常路径测试。

验证结果：
- mvn -pl order-service test：通过。

VCS 完整性：
- git status --short 显示 2 个修改文件，无未跟踪新增文件。

后续建议：
- 本次只改 Critical / Important，建议运行 /review-check 做一次二次只读复查；通过后进入 /code-reading 和人工 Review。

【Skill 反馈给 Codex】
- skill：review-repair
- 本次场景：基于 review-check findings 直接修复 Java Service 空指针风险
- 运行评价：顺畅
- 建议：
  1. 无
- 证据：
  - 无
```
