# review-repair Examples

## 示例：完整修复输出

```text
修复结论：Fixed
工作流阶段：Review Repair 已完成；下一步回到 Verification Gate，通过后可进入 code-reading / 人工 Review
TestEvidenceStatus: Passed；mvn -pl order-service test 实际调用并断言目标逻辑

【Workflow Brief】
stage: ReviewRepair
task: 订单 customerId 空值校验修复
source: review-check findings CR-1 / IM-1
artifacts: 本次直接修改代码；无新增文档
changed: src/main/java/com/acme/order/OrderService.java；src/test/java/com/acme/order/OrderServiceTest.java
vcs: owner=Git 仓库根; tracked=OrderService.java、OrderServiceTest.java; untracked=无
tests: class=Hermetic; command/result=mvn -pl order-service test：通过
api: spec=无; index=无; operationIds=无
openFindings: 无
next: 二次 review-check 后进入 code-reading / 人工 Review
nextCommand: 使用 yan-code-review skill，mode=check，对当前修复执行二次只读审查
tokenHint: 下一位 AI 先读本 Brief -> 两个 changed 文件 -> 必要时回看 CR-1 / IM-1 原始 finding；首轮最多 5 个文件

处理结果：
| ID | 来源 | 状态 | 文件/位置 | 处理说明 | 验证 |
|----|------|------|-----------|----------|------|
| CR-1 | review-check | fixed | src/main/java/com/acme/order/OrderService.java:88 | 增加 customerId 空值校验，复用当前模块 BusinessException 口径，避免继续查询触发 NPE | mvn -pl order-service test：通过 |
| IM-1 | review-check | fixed | src/test/java/com/acme/order/OrderServiceTest.java | 新增空 customerId 用例，覆盖异常路径 | mvn -pl order-service test：通过 |

修改文件：
- src/main/java/com/acme/order/OrderService.java：补入参校验。
- src/test/java/com/acme/order/OrderServiceTest.java：补异常路径测试。

Diff 范围：
- 修复前：OrderService.java 已在本次任务 diff 中；测试文件已存在。
- 修复后：仅 OrderService.java 和 OrderServiceTest.java 发生变化。
- 范围判断：只覆盖 CR-1 / IM-1 和必要测试。

验证结果：
- mvn -pl order-service test：通过。

VCS 完整性：
- git status --short 显示 2 个修改文件，无未跟踪新增文件。

后续建议：
- 本次只改 Critical / Important，建议使用 `yan-code-review mode=check` 做二次只读复查；通过后进入 `yan-project-analysis mode=understanding` 和人工 Review。
- 若还有 deferred-next-batch，下一轮按 IM/MI 顺序继续运行 review-repair。

可复制回贴块：
【Review Repair 回填】
修复结论：Fixed
已关闭：CR-1, IM-1
未关闭：无
验证：mvn -pl order-service test：通过
Diff 范围：只覆盖 accepted findings 和必要测试
VCS：无未跟踪新增文件
二次 review-check：建议，原因：修复包含 Critical 且改动了业务校验逻辑

```
