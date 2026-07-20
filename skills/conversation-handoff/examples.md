# conversation-handoff Examples

以下路径、类名和命令结果均为虚构的格式示例。实际运行必须回到当前对话、文件和命令输出取证；示例不能替代证据。

## 示例 1：PartiallyComplete 证据分层移交

场景：对话中已修改订单超时处理，用户曾说“测试通过”，但当前会话没有测试命令输出；只读 `git status --short` 确认两个文件有修改，配置检查还看到 `payment.api-key` 键但不记录其值。

````markdown
# 订单超时处理 对话移交

- 移交状态：PartiallyComplete
- 交接对象：下一段 AI 对话
- 生成时间：2026-07-18 19:00 +08:00
- 范围：仅订单服务超时分支和聚焦测试；不包含支付服务配置修改

## 1. 当前目标与结论

目标是完成订单超时补偿并进入只读审查。实现文件已有本地修改，但当前会话没有可复核的测试输出，因此不能写“验证通过”。

| 级别 | 内容 | 依据 |
|---|---|---|
| 已证实 | `OrderTimeoutService` 与对应测试有本地修改 | `git status --short` 显示两个 `M`；文件路径见下节 |
| 推断 | 修改意图是避免补偿事件重复发送 | `OrderTimeoutService.java:96` 新增幂等键检查；尚未运行并发测试 |
| 待确认 | 聚焦测试是否通过 | 对话中有口头声明，但当前没有命令、退出码或测试报告 |

## 2. 已完成动作与产物

| 动作 | 结果 | 证据 |
|---|---|---|
| 修改超时补偿逻辑 | 完成，未验证 | `order-service/src/main/java/com/acme/order/OrderTimeoutService.java:96` |
| 增加重复事件测试 | 完成，未运行 | `order-service/src/test/java/com/acme/order/OrderTimeoutServiceTest.java:71` |
| 检查配置敏感项 | 已脱敏 | 仅记录 `application.yml` 的 `payment.api-key` 键名；未转录值 |

## 3. 工作区与验证

- 变更文件：`OrderTimeoutService.java`、`OrderTimeoutServiceTest.java`
- VCS 状态：`git status --short` 已检查；上述两个文件为 tracked modified
- 验证：`mvn -pl order-service -Dtest=OrderTimeoutServiceTest test` - NotRun；当前会话没有命令输出
- 敏感信息：已脱敏；若真实凭据曾进入 VCS，需由有权限人员轮换

## 4. 未完成项、风险与阻塞

1. P1 验证缺口：运行聚焦测试并保存命令、退出码和摘要；失败时不得进入 Review Gate 通过结论。
2. P2 并发证据：确认幂等键在并发触发下只发送一次补偿事件。

## 5. 接手步骤

1. 先读本移交文档。
2. 按最小读取顺序核对两处改动，不从摘要推断未读代码。
3. 运行聚焦测试并记录真实结果；失败则先定位，不把口头声明当证据。
4. 验证通过后使用 review-check skill 做只读审查。

## 6. 最小读取顺序

1. `docs/handoffs/2026-07-18/order-timeout-handoff.md`
2. `order-service/src/main/java/com/acme/order/OrderTimeoutService.java`
3. `order-service/src/test/java/com/acme/order/OrderTimeoutServiceTest.java`

首轮 3 个文件；只有测试或调用链证据不足时再扩展，并记录原因。

## 7. 可复制给新对话的提示

```text
请先阅读 docs/handoffs/2026-07-18/order-timeout-handoff.md，按最小读取顺序核对原始证据。先运行其中的聚焦测试并记录真实结果；不要把“推断”或对话中的口头测试声明当成已验证事实，不要回显 payment.api-key 的值。
```

【Workflow Brief】
stage: VerificationGate
task: 订单超时补偿幂等处理
source: 当前对话 + OrderTimeoutService.java:96 + git status --short
artifacts: docs/handoffs/2026-07-18/order-timeout-handoff.md
changed: OrderTimeoutService.java, OrderTimeoutServiceTest.java
vcs: owner=<Git 仓库根>; tracked=上述两个 modified 文件; untracked=无
tests: class=Hermetic; command/result=mvn -pl order-service -Dtest=OrderTimeoutServiceTest test / NotRun（当前无输出）
api: spec=无; index=无; operationIds=无
openFindings: BK-1 聚焦测试结果待复核
next: 先完成 Verification Gate，再使用 review-check skill 只读审查
nextCommand: 运行聚焦测试并记录结果；通过后使用 review-check skill 审查当前实现
tokenHint: 下一位 AI 先读本 Brief -> 移交文档 -> 两个 changed 文件；首轮最多 5 个文件

````

关键点：`PartiallyComplete` 只描述交接材料状态；没有测试输出就写 NotRun。配置只记录键名和风险，不出现秘密值。

## 示例 2：无人值守 Blocked 分支

场景：`-p`/无人值守运行，用户没有说明要移交哪一段工作，候选目标文件又已存在且无法确认是否覆盖。

```text
移交状态：Blocked
保存结果：NotWritten
原因：移交范围不明确；docs/handoffs/2026-07-18/current-task-handoff.md 已存在，当前无法等待覆盖确认。
最小补充项：明确任务范围，并选择“使用时间戳新文件”或在交互会话确认覆盖。
保留状态：未修改已有 handoff，未登记看板，未把候选范围写成事实。
```

完整输出仍使用 reference 模板并包含 12 字段 Workflow Brief；其中 `artifacts` 写“无（Blocked，未写入）”，`changed` 写“无”，`openFindings` 写阻塞项，`nextCommand` 写需要用户确认的人工动作。不得等待式提问、自动选默认项或覆盖文件。
