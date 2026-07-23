# review-fix Examples

## 示例 1：先生成给其他 AI 的 Review 任务包

用户调用：

```text
使用 yan-code-review skill，mode=package，基于 docs/2026-07-01/sms-login.md 生成 Review 任务包
```

输出重点：

```text
✅ Review 任务包已生成：docs/review-fix/2026-07-01/sms-login-review-task.md

如果目标 AI 已安装本仓库 skill，直接让它运行：
使用 yan-code-review skill，mode=check，审查 docs/review-fix/2026-07-01/sms-login-review-task.md

否则请把任务包里的提示分别交给 Codex / Cursor / Claude 做审查。
等它们返回 findings 后，把结果贴回来，我再继续汇总并生成修复交接文档。
```

任务包里会包含：

- 审查目标：确认短信登录实现是否符合 yan-dev-doc。
- 证据包：yan-dev-doc、code-reading、diff、关键源码、测试命令。
- 统一审查清单：正确性、边界、事务、并发、安全、性能、兼容、测试。
- 技能化入口：可直接交给其他 AI 使用 `yan-code-review mode=check` 审查任务包。
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

`yan-code-review mode=package` 第二阶段会生成：

- `docs/review-fix/2026-07-01/sms-login-fix-handoff.md`
- Critical / Important / Minor / Rejected 汇总表（统一 ID，保留来源编号）
- 可直接交给 Codex / Cursor / Claude 的 AI 修复操作码

汇总表里 ID 归并示例（Codex 和 Cursor 都提了同一个频控问题，合并为一条，来源列保留各自原始编号）：

```text
### Critical（必须修）
| ID | 来源 | 文件/位置 | 问题 | 影响 | 修复建议 | 验证方式 |
|----|------|-----------|------|------|----------|----------|
| CR-1 | Codex#1 / Cursor#2 | SmsLoginService.sendCode() | 未做手机号 60s 频控 | 短信轰炸/成本异常 | 发送前查 Redis 频控 key，成功后写 60s TTL | 连续发两次，第二次返回频控错误 |
```

这条 `CR-1` 会一路传到 AI 修复操作码、`review-repair` 回填和二次 review-check，全程用同一 ID，不重新编号。
