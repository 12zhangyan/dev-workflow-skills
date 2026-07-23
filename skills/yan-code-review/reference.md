# yan-code-review Router Reference

## Mode contract

| Mode | Required input | Write authority | Detailed instruction |
|------|----------------|-----------------|----------------------|
| `package` | yan-dev-doc、diff、现有 findings 或多 reviewer 目标 | 只写 Review 任务包/修复交接，不改业务代码 | `modes/package/mode.md` |
| `check` | review-task、diff、patch 或当前工作区 | 严格只读 | `modes/check/mode.md` |
| `repair` | 有稳定 ID、定位和修复边界的 findings | 可修改 findings 指向的文件并验证 | `modes/repair/mode.md` |
| `loop` | 明确要求同一 AI 审查并修复 | 最多两轮修复；不提交、不推送 | `modes/loop/mode.md` |

## Accuracy boundary

- 材料不足时输出 `InsufficientMaterial`，不得声称实现没有问题。
- 模糊的 review 请求固定进入 `check`，不得把“审查”推断为修改授权。
- `repair` 没有明确 findings 时停止并转 `check`；`loop` 才允许从无 findings 开始。
- 只加载选中 mode 的 `mode.md`；跨 mode 文件仅在该 mode 明确要求时读取。

## Legacy aliases

`review-fix / review-check / review-repair / review-loop` 仅作为 `package / check / repair / loop` 的迁移别名，不再是独立公开 skill。
