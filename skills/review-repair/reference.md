# review-repair Reference

> `review-repair` 的 findings 归一化、修复结果输出和示例。该 skill 会修改代码，不能用于只读审查。

---

## Findings 归一化

| 类别 | 判定 | 处理 |
|------|------|------|
| accepted | 有文件/方法/行为证据，有明确修复和验证方式 | 直接修复 |
| needs-confirmation | 涉及业务语义、权限、状态、接口契约、DB 结构、数据修复或证据冲突 | 暂停并问一个阻塞问题 |
| rejected | 误报、无证据、超范围、纯风格偏好、与项目规范冲突 | 不修，说明原因 |
| deferred | Minor 或低收益建议，修复会扩大范围 | 记录，不默认处理 |
| deferred-next-batch | 有证据但超过本轮批次上限，或属于另一个模块/根因 | 本轮不修，列入下一批 |

## 触发判定

| 用户意图 | 应使用 |
|----------|--------|
| “帮我 review / 审查一下 / 看看有没有问题” | `review-check` |
| “基于这个 dev-doc 生成多 AI review 任务包” | `review-fix` |
| “这些 findings 帮我直接修掉” | `review-repair` |
| “按 fix-handoff 直接改代码并验证” | `review-repair` |
| “只有 patch，没有 findings” | 先 `review-check`，不要直接 `review-repair` |

## ID 与追踪规则

ID 前缀语义以 [../_shared/workflow-chain.md](../_shared/workflow-chain.md#finding-id-命名体系全链路统一) 为准（CR/IM/MI/RJ/BK）。

- 输入已有 ID 时原样保留，例如 `CR-1`、`IM-2`、`MI-3`。
- 输入没有 ID 时按严重级别补临时 ID：`CR-n`、`IM-n`、`MI-n`、`BK-n`、`RJ-n`。
- 输出表中每一行必须对应输入中的一条 finding 或一个明确问题点。
- 同一根因影响多个文件时可合并，但处理说明里要列出所有受影响文件。

## 修复计划模板

```markdown
## 修复计划

| ID | 级别 | 文件/位置 | 问题 | 修复动作 | 验证方式 |
|----|------|-----------|------|----------|----------|
| CR-1 | Critical | <path:line/method> | <问题> | <最小修复动作> | <命令/用例> |
```

## 批次规则

| 条件 | 处理 |
|------|------|
| accepted findings > 5 | 先修 Critical / Important，剩余标 `deferred-next-batch` |
| 涉及文件 > 8 | 优先按根因和模块拆批 |
| 跨 2 个以上服务/模块 | 按服务/模块分批，不一轮混改 |
| 同一根因多文件 | 可同批处理，但输出说明根因归并 |
| 修复中出现 blocker 或验证失败无法定位 | 停止后续 finding，输出当前批次结果 |

## 二次 review-check 触发条件

满足任一条件时，后续建议必须写“建议二次 review-check”：

- Critical / Important 修复跨越 2 个以上文件。
- 改动公共工具、公共 DTO、接口签名、权限、状态流转或事务边界。
- 新增测试文件但未能运行目标测试。
- 验证失败但判断为环境或既有问题。
- 输入 finding 本身来自多个 AI 且结论互相冲突。

## 完成输出格式

```text
修复结论：Fixed / PartiallyFixed / Blocked
工作流阶段：Review Repair 已完成；下一步回到 Verification Gate / 二次 review-check / Submit Gate

【Workflow Brief】
stage: ReviewRepair
task: <任务名或 findings 来源>
source: <review-check findings / fix-handoff / Workflow Brief / 用户问题清单>
artifacts: 本次直接修改代码；如生成测试或文档列出路径
changed: <本次修改的源码/测试/配置/OpenAPI 文件>
vcs: <git/svn status 摘要；新增文件是否已纳入 VCS>
tests: <验证命令 + 结果；未运行写原因>
api: <OpenAPI YAML/INDEX 路径；无接口变更写 无>
openFindings: <未关闭/blocked/rejected/deferred-next-batch ID；没有写 无>
next: <二次 review-check / code-reading / 人工 review / 继续下一批 review-repair>
tokenHint: 下一位 AI 先读本 Brief -> changed 文件 -> 未关闭 finding 证据；不要重复读取已关闭 finding 的全文

处理结果：
| ID | 来源 | 状态 | 文件/位置 | 处理说明 | 验证 |
|----|------|------|-----------|----------|------|
| CR-1 | review-check | fixed | <path:line/method> | <改了什么，为什么能关闭> | <命令 + 结果> |
| IM-1 | review-check | blocked | <path:line/method> | <阻塞原因> | <待确认> |
| IM-2 | review-check | deferred-next-batch | <path:line/method> | <超过本轮批次或属于其他模块> | <下一批处理> |

修改文件：
- <path>：<本次修复承担的角色>

Diff 范围：
- 修复前：<git/svn status 或 diff 摘要>
- 修复后：<git/svn status 或 diff 摘要>
- 范围判断：<只覆盖 accepted findings / 包含需解释的额外改动>

验证结果：
- <命令>：<通过/失败/未运行 + 摘要>

VCS 完整性：
- <git status --short / svn status 摘要>
- 新增文件纳管提醒：<无 / 需 git add / 需 svn add>

后续建议：
- <是否需要二次 review-check；是否可进入 code-reading / 人工 review / Submit Gate>
- <如有 deferred-next-batch，列出下一批建议顺序>

可复制回贴块：
```text
【Review Repair 回填】
修复结论：<Fixed / PartiallyFixed / Blocked>
已关闭：<CR-1, IM-1>
未关闭：<BK-1 / deferred-next-batch / rejected>
验证：<命令 + 结果>
Diff 范围：<只覆盖 accepted findings / 有额外改动说明>
VCS：<无未跟踪新增文件 / 需 git add / 需 svn add>
二次 review-check：<建议 / 不需要，原因>
```

【Skill 反馈给 Codex】
- skill：review-repair
- 本次场景：<findings/fix-handoff/自然语言问题清单>
- 运行评价：<顺畅 / 有小问题 / 有阻塞>
- 建议：
  1. <无，或一条可落地的 skill 改进建议>
- 证据：
  - <本次多问/漏问/误判/模板不足的具体表现；没有则写 无>
```

## 示例 1：review-check findings 后直接修复

输入：
```text
Critical:
1. Severity: Critical
   File/Line: src/main/java/.../OrderService.java:88
   Problem: null customerId 会继续查询并触发 NPE
   Fix: 入参校验并返回业务异常
   Verify: mvn -pl order-service test
```

输出要点：
- 读取 `OrderService` 和相邻异常处理模式。
- 最小修改入参校验。
- 补或调整单元测试覆盖 `customerId == null`。
- 运行模块级测试。
- 输出 `CR-1 fixed`，附验证结果。

## 示例 2：需要阻塞确认

输入：
```text
Important:
File/Line: AssetService#reject
Problem: 驳回时应该把状态从 VRF 改回 ELM
Fix: 修改状态流转
```

处理：
- 如果现有状态机/字典显示 `VRF -> ELM` 语义不明确，不能猜着改。
- 输出 `blocked`，只问一个问题：驳回后是否恢复到编辑态 `ELM`，还是进入单独驳回态。

## 示例 3：Rejected 不处理

输入：
```text
Minor: 建议把所有 if 改成 Optional 链式写法
```

处理：
- 如果没有缺陷证据，归为 `rejected` 或 `deferred`。
- 不做风格重构。

## 触发评估用例

| Prompt | 期望 |
|--------|------|
| `使用 review-repair skill 按这些 findings 直接修复：CR-1 ...` | 触发，直接修复 |
| `review-check 输出了两个 Important，帮我改掉并跑测试` | 触发，直接修复 |
| `这里有 9 条 review findings，帮我都修了` | 触发，但应分批，超过上限标 `deferred-next-batch` |
| `帮我审查 docs/review-fix/xxx-review-task.md` | 不触发，应该用 `review-check` |
| `基于 dev-doc 生成 review 任务包` | 不触发，应该用 `review-fix` |
| `这里有 patch，看看有没有问题` | 不触发，应该用 `review-check` |
