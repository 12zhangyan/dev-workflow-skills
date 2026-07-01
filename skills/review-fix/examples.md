# review-fix Examples

## 示例：短信登录改造后的多 AI review 汇总

用户调用：

```text
/review-fix docs/2026-07-01/sms-login.md
```

### 其他 AI 返回的 findings 摘要

- Codex：`SmsLoginService.sendCode()` 没有限制同一手机号 60 秒内重复发送，可能绕过验证码频控。
- Cursor：`AuthController.smsLogin()` 新增接口没有复用现有登录审计日志。
- Claude：`SmsLoginRequest.phone` 只校验非空，没有校验手机号格式。
- Claude：建议把整个登录模块重构为 DDD 分层。

### 汇总结果

| ID | 等级 | 处理 |
|----|------|------|
| CR-1 | Critical | 增加发送频控，避免短信轰炸 |
| IM-1 | Important | 补登录审计日志，保持现有审计链路完整 |
| IM-2 | Important | 补手机号格式校验 |
| RJ-1 | Rejected | DDD 重构超出本次修复范围 |

### AI 修复操作码片段

```text
你现在接手短信登录 review 修复任务。只处理 CR-1、IM-1、IM-2，不做 DDD 重构。

必须修复：
1. CR-1 SmsLoginService.sendCode(): 增加同一手机号 60 秒内不可重复发送的 Redis 频控。验证：重复调用发送接口，第二次返回频控错误。
2. IM-1 AuthController.smsLogin(): 登录成功后复用现有 LoginAuditService 记录审计。验证：短信登录成功后审计表出现一条登录记录。
3. IM-2 SmsLoginRequest.phone: 增加手机号格式校验。验证：空值、非法格式、合法手机号三种用例。

禁止处理：
- 不做 DDD 重构。
- 不修改密码登录接口签名。
- 不执行数据库写操作或 DDL。
```
