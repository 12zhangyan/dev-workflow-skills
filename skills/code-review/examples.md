# code-review Examples

## 示例 1：审查 Review 任务包

用户调用：

```text
/code-review docs/review-fix/2026-07-02/sms-login-review-task.md
```

输出片段：

```text
来源：Code Review
审查对象：docs/review-fix/2026-07-02/sms-login-review-task.md
审查范围：SmsLoginService.java, AuthController.java, SmsLoginRequest.java

Critical:
1. Severity: Critical
   File/Line: SmsLoginService.sendCode()
   Problem: 发送验证码前没有检查同一手机号 60 秒内重复发送。
   Evidence: Review 任务包要求保留短信频控，sendCode() 只写验证码，没有读取频控 key。
   Impact: 可能造成短信轰炸和成本异常。
   Fix: 发送前检查 Redis 频控 key，发送成功后写入 60 秒 TTL。
   Verify: 同一手机号连续调用两次发送接口，第二次返回频控错误。

可将以上 findings 原样贴回 /review-fix，用于生成修复交接文档。
```

## 示例 2：没有发现阻塞问题

```text
来源：Code Review
审查对象：changes.patch
审查范围：OrderQueryService.java, OrderQueryMapper.xml

未发现有证据的阻塞问题。

已检查：
- 需求一致性：patch 只修改查询条件，符合 dev-doc 的范围。
- 业务正确性：状态过滤仍复用原枚举，未改变主流程。
- 边界/事务/并发/安全/性能/兼容/测试：未发现可定位问题。

Notes:
- 建议人工确认测试数据是否覆盖空查询条件。
```
