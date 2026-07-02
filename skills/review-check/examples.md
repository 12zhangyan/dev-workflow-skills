# review-check Examples

## 示例 1：审查 Review 任务包

用户调用：

```text
/review-check docs/review-fix/2026-07-02/sms-login-review-task.md
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

## 示例 3：前端 SSE / Token 审查

```text
来源：Code Review
审查对象：docs/review-fix/2026-07-02/app-chat-review-task.md
审查范围：AppChatView.vue, request.ts, JwtAuthenticationFilter.java, AuthController.java

Important:
1. Severity: Important
   File/Line: AppChatView.vue eventSource.addEventListener('error')
   Problem: 前端没有读取 SSE 业务错误中的 code 字段，无法区分未登录、无权限和系统错误。
   Evidence: 后端 event:error data 包含 {"code": ..., "d": ...}；前端只读取 parsed.d 并统一 message.error。
   Impact: accessToken 过期或 SSE token 失效时，用户只看到生成失败，无法触发重新登录或权限提示。
   Fix: 解析 event:error 的 code；对 NOT_LOGIN/NO_AUTH 做登录跳转或权限提示，其余保留通用错误。
   Verify: 构造过期 token 调用 SSE，确认前端按 code 跳转登录或展示权限错误。

Notes:
- 已检查 EventSource 不支持自定义 Header 的限制，使用一次性 sseToken 是合理方案。
```

