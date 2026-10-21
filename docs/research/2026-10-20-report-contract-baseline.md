# 2026-10-20：report-ownership 行为核对与契约违反基线

承接 [finding 编号配方](2026-10-20-finding-id-recipe.md) 末尾的两项已知限制。

## 改动

- 新增 `scripts/eval-verifiers/report-ownership.js`，挂到 `review-loop-independent-recheck` 和 `review-loop-delegated-recheck` 两个 case 上。它按 fixture README 的契约直接调用修复后的 `getReport`，共 4 项检查：本人能读自己的报告；越权读取抛 `REPORT_FORBIDDEN`；未知报告抛 `REPORT_NOT_FOUND`；用户缺失时不返回报告。runner 自测覆盖三种情况：原缺陷被拒绝，正确修复被接受，抛 `FORBIDDEN` 的修复被拒绝。
- outcome verifier 白名单改为 `host-eval-preflight.js` 中唯一的 `OUTCOME_VERIFIERS`，记录名称和期望检查数，由 runner、预检和契约检查共用。此前这份白名单分散在三处，新增 verifier 时漏改了预检，导致第一次基线运行全部报 `unknown outcome verifier`。
- Claude 可写运行在 `node` 之外再放行只读 git 子命令（`diff/status/show/log`），自测断言没有放行裸 `git`。

## 基线（当前 main 技能，未加任何新规则）

条件：Claude Code 2.1.305，`claude-sonnet-5-5`，explicit 调用，runner 已禁用 `Skill`，每个 case 10 次。

| case | 全部通过 | 行为核对通过 | 其他失败 |
|---|---:|---:|---|
| review-loop-independent-recheck | 9/10 | 9/10 | — |
| review-loop-delegated-recheck | 5/10 | 8/10 | 3 次缺 ADDRESSED |

**契约违反：20 次中有 3 次。** 输出都没有提到 README。

- 2 次越权时抛 `FORBIDDEN`，不是契约要求的 `REPORT_FORBIDDEN`。
- 1 次有意把越权和不存在合并成 `REPORT_NOT_FOUND`，代码注释说明是为了防止枚举 id。这是一个有理由的安全取舍，但违反了 README 写明的错误码，修复者也没有把它列为 Agent 代决或待裁决。

repair mode 已经写了“实施前从代码、契约和用户目标补齐期望行为”。这 3 次属于规则存在、但执行时被跳过的情况。按准入标准，这类失败应该用具体的识别线索来处理，而不是再加一条同义的原则。

## 未解决：复核子 Agent 的 shell 权限

放行只读 git 之后，单次手工诊断中子 Agent 能运行 `git diff`。但在 runner 的 10 次运行中，仍有 4 次输出写着子 Agent“没能运行 `git diff` 和 `node --test`”。`node` 本来就在放行列表里也被拒，说明原因不在 git 规则的写法上。可能是子 Agent 在命令前加了 `cd`/`Set-Location`，或者权限继承方式不同。后续诊断时本机 Claude Code 自动升级到 2.1.306，但原生二进制没有装上（`claude native binary not installed`），按同版本重装后恢复。

**定位结果：** 带工具事件的诊断 2 次都显示，子 Agent 会把命令写成 `cd <绝对路径>; git status; git diff; Get-Content ...` 这样一整串。宿主对每一段分别核对权限，`cd` 和 `Get-Content` 不在放行列表里，于是整串被拒。runner 已额外放行只读的切换目录和读文件命令（Bash：`cd/ls/cat`；PowerShell：`cd/Set-Location/Get-Content/Get-ChildItem/Select-Object`），同条件诊断中子 Agent 的整串命令执行成功。
