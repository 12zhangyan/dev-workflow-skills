# review-fix Examples

## 示例 1：先生成给其他 AI 的 Review 任务包

用户调用：

```text
/review-fix docs/2026-07-01/sms-login.md
```

输出重点：

```text
✅ Review 任务包已生成：docs/review-fix/2026-07-01/sms-login-review-task.md

如果目标 AI 已安装本仓库 skill，直接让它运行：
/review-check docs/review-fix/2026-07-01/sms-login-review-task.md

否则请把任务包里的提示分别交给 Codex / Cursor / Claude 做审查。
等它们返回 findings 后，把结果贴回来，我再继续汇总并生成修复交接文档。
```

任务包里会包含：

- 审查目标：确认短信登录实现是否符合 dev-doc。
- 证据包：dev-doc、code-reading、diff、关键源码、测试命令。
- 统一审查清单：正确性、边界、事务、并发、安全、性能、兼容、测试。
- 技能化入口：可直接交给其他 AI 执行 `/review-check <review-task路径>`。
- 三份提示：Codex 审查提示、Cursor 审查提示、Claude 审查提示。
- 回收格式：要求其他 AI 返回结构化 findings。

## 示例 2：贴回 AI review 结果后再汇总修复

用户贴回：

```text
来源：Codex
Severity: Critical
File/Line: SmsLoginService.sendCode()
Problem: 没有限制同一手机号 60 秒内重复发送。
Evidence: diff 中新增 sendCode() 只写入验证码，没有检查频控 key。
Impact: 可能导致短信轰炸和成本异常。
Fix: 发送前检查 Redis 频控 key，发送成功后写入 60 秒 TTL。
Verify: 连续调用两次发送接口，第二次返回频控错误。
```

`/review-fix` 第二阶段会生成：

- `docs/review-fix/2026-07-01/sms-login-fix-handoff.md`
- Critical / Important / Minor / Rejected 汇总表
- 可直接交给 Codex / Cursor / Claude 的 AI 修复操作码

