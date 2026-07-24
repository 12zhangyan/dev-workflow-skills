---
name: yan-code-review-loop
description: yan-code-review 的 loop 模式：同一 Agent 对当前实现执行只读审查、必要修复、目标验证和二次复审。小范围默认 quick；高风险、多模块或需要审计任务包时使用 standard。最多两个修复循环，不自动提交或推送。
---

# Loop mode

本 mode 编排 sibling `check`、`repair`、`package`，不复制它们的完整规则。只在进入相应阶段时读取对应 mode 和 reference。

## 进入条件

使用 loop：

- 用户明确要求“审查并修复 / 一键 review 并修复 / 修到没有 Critical 或 Important”；
- 当前没有现成 findings，需要同一 Agent 完成闭环。

不要使用：

- 只找问题、不修改：`check`；
- 已有明确 findings，只需修复：`repair`；
- 要分发多个 AI 或只生成审查任务包：`package`。

告知用户：将审查、必要修复、验证和复审；不会自动 commit/push，不会执行数据库写入。

## 固定协议

按需读取：

- [交互策略](../../../_shared/interaction-policy.md)
- [工作流门禁](../../../_shared/workflow-gates.md)
- [Workflow Brief](../../../_shared/workflow-brief.md)
- [loop 输出模板](reference.md)

数据库始终只读。不得执行 DDL、数据修复或伪造密钥。最多 2 个修复循环。

## 模式选择

默认 `quick`，满足任一条件时使用 `standard`：

- 契约、权限、状态机、事务、并发、DB 或安全高风险；
- 跨模块、改动范围不清、需要多 AI/审计证据包；
- 用户明确要求任务包；
- quick 首轮发现范围明显超出小改动。

`quick`：

```text
check 当前 diff → repair accepted findings → 验证 → 二次 check
```

`standard`：

```text
package 第一阶段任务包 → check → repair → 验证 → 二次 check
```

## VCS 和未跟踪文件

运行 `node <helper> detect-vcs`，按 [VCS 证据归属](../../../_shared/workflow-gates.md#vcs-证据归属) 确定每组文件最近的 `VCS_OWNER`。status/diff 必须合并未跟踪文件内容。

未纳管不等于不可审查、不可修复或不可验证，但在纳管前：

- 顶层结论保持 `Blocked / VCSGateBlocked`；
- 不得宣称 Review Gate 通过、finding `Fixed` 或进入 Submit Gate；
- 输出逐文件最小纳管清单。

`VcsAddPolicy`：

- `host-required`：项目明确规则要求 Agent 纳管时，只 add 本次清单中的精确文件；
- `user-authorize-only`：默认策略，用户看到清单并明确授权后才能 add；
- 两者都禁止 `git add .`、目录级兜底和顺带纳管无关文件。

策略冲突时，在第一次 VCS 操作前记录：

```text
PolicyConflict: review-loop-default-no-add -> host-required
VcsAddPolicySource: <证据路径>
```

任何策略都不授权 commit/push。

## 执行状态机

### 1. 建立范围

`$entry` 可以是 yan-dev-doc、Workflow Brief、review task、功能描述或当前工作区。

收集：

- VCS owner、status、tracked diff 和 untracked 内容；
- 需求/方案证据与改动文件；
- 已有测试命令、结果和依赖；
- `ReviewScopeType`、`TestDependencyClass`、`TestEvidenceStatus`。

找不到实际实现证据时停止为 `InsufficientMaterial`，不伪装成“未发现问题”。

### 2. Standard 可选任务包

仅 standard 读取 [package mode](../package/mode.md) 和 [package reference](../package/reference.md)，执行第一阶段，生成：

```text
docs/review-fix/<日期>/<任务>-review-task.md
```

新任务包始终使用 `yan-code-review package` 当前结构。旧 `docs/review-form/*` 只有用户显式提供时才作为输入证据；校验后迁移到新任务包，并记录：

```text
ReviewTaskTemplateSource: yan-code-review-package
LegacyReviewTaskInput: <path|none>
CompatibilityFlags: <legacy-review-form-input|none>
```

不得扫描其他宿主目录寻找旧 skill。Sibling package 不可读时输出 `Blocked / package-sibling-missing`。

### 3. 首轮只读审查

读取并执行 [check mode](../check/mode.md) 与 [check reference](../check/reference.md)。保持只读，输出稳定 finding ID：

- `CR-*` Critical
- `IM-*` Important
- `MI-*` Minor
- `RJ-*` Rejected
- `BK-*` Blocked

无证据不报 finding。记录 `ReviewReceipt`、首轮最大序号和审查范围。

### 4. 修复决策

没有 Critical/Important：跳过 repair，进入验证。

存在 Critical/Important：读取 [repair mode](../repair/mode.md) 与 [repair reference](../repair/reference.md)，只修复 accepted findings。保持 finding ID，分类 `Fixed / Rejected / Deferred / Blocked`，保留用户无关改动。

业务语义、权限、状态、数据归属或接口契约无法从证据裁决时停止，不猜测修复。

### 5. 目标验证

优先运行方案/finding 指定命令，再选择模块级命令。记录：

- 命令、退出码、关键输出；
- `TestDependencyClass: Hermetic | ServiceBacked | LiveExternal | Mixed`；
- `VerificationStatus` 与 `TestEvidenceStatus`；
- 测试是否真正触达修改逻辑。

失败先判断代码、工具链、路径映射还是外部依赖：

- 可安全恢复的工具链问题执行一次 `ToolchainRecovery` 后重试；
- Windows 源路径与 Maven/javac 报错路径不一致时记录 `WindowsTestSourcePathMismatch`，检查 walk/rglob、`testCompile` 和实际编译源；
- 受控 fallback 通过时写 `FallbackValidation=Passed`，仍保留原命令失败证据；
- LiveExternal 缺密钥不能伪造密钥或写成普通 `EnvironmentBlocked`。

### 6. 二次复审

只要修改过代码，必须重新读取最新 status/diff，按 check mode 复审：

- 原 finding 是否由证据关闭；
- 修复是否引入回归、范围扩张或新 Critical/Important；
- 测试是否有效；
- VCSGate 是否仍阻塞。

若仍有 Critical/Important 且修复循环少于 2，回到步骤 4；达到 2 次后停止并保留未关闭项。

### 7. 输出闭环

按 [loop reference](reference.md) 输出：

- `ReviewMode: quick|standard`
- `ReviewAgentMode: SingleAgentReview`
- `RepairCycles: 0|1|2`
- `ReviewReceipt`
- findings 状态表
- 验证证据与 TestDependencyClass
- VCSGate / blocker / 未纳管清单
- `ReviewTaskTemplateSource` / `LegacyReviewTaskInput` / `CompatibilityFlags`
- 自动提交：未执行
- `【Workflow Brief】`

仅当无未关闭 Critical/Important、目标验证通过且 VCSGate 不阻塞时，才写 Review Gate 通过。

## 最终检查

- [ ] quick/standard 选择有证据
- [ ] 首轮 check 保持只读
- [ ] 只修复 accepted Critical/Important
- [ ] 未跟踪文件已纳入审查和验证
- [ ] 修改后已二次 check
- [ ] 修复循环不超过 2
- [ ] 未自动 add/commit/push，未执行数据库写入
