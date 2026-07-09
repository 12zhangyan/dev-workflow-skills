# 工作流串联速查（单一权威）

本表是"当前 skill 完成后，下一步跑什么"的唯一权威来源。各 skill 的完成输出、`Workflow Brief` 的 `next` 字段、workflow-guide 的下一步提示都以本表为准，避免各处叙述漂移。改动串联关系时只改这里。

## skill 一句话职责

| skill | 阶段 | 做什么 | 会改代码吗 |
|-------|------|--------|-----------|
| `dev-doc` | Plan Gate | 需求落成可执行开发文档 | 否 |
| `bug-fix` | Plan Gate | 记录 Bug 现象/根因/修复边界 | 否 |
| `biz-flow` | Plan Gate | 给测试的业务流/数据流/时序地图 | 否 |
| `review-fix` | Review Gate | 生成 review 任务包；回收 findings 后出修复交接 | 否 |
| `review-check` | Review Gate | 按清单执行一次只读审查，输出 findings | 否 |
| `review-repair` | Review Gate → Verification | 按 findings/fix-handoff 直接修复并验证 | 是 |
| `code-reading` | Understanding Gate | 生成调用链 + 状态机 + 代码位置地图 | 否 |

## 下一步映射（谁 → 下一步 + 可复制命令）

| 当前完成 | 默认下一步 | Claude Code | Codex |
|----------|-----------|-------------|-------|
| `dev-doc` | AI 实现 → VCS/验证 → `review-fix` | `/review-fix docs/<日期>/<任务>.md` | `使用 review-fix skill 基于 docs/<日期>/<任务>.md 生成 Review 任务包` |
| `bug-fix` | 确认根因后修复 → VCS/验证 → `review-fix` | `/review-fix docs/bugs/<日期>/<bug>.md` | `使用 review-fix skill 基于 docs/bugs/<日期>/<bug>.md 生成 Review 任务包` |
| `biz-flow` | 测试设计；或转 `dev-doc` 开发 | `/dev-doc <业务名>` | `使用 dev-doc skill 给 <业务名> 生成开发文档` |
| `review-fix`（任务包） | 多 AI 只读审查 | `/review-check docs/review-fix/<日期>/<任务>-review-task.md` | `使用 review-check skill 审查 docs/review-fix/<日期>/<任务>-review-task.md` |
| `review-check`（findings） | 贴回 `review-fix` 汇总，或交 `review-repair` 直修 | `/review-repair <粘贴 findings>` | `使用 review-repair skill 根据这些 findings 直接修复` |
| `review-fix`（修复交接） | `review-repair` 直修，或人工按交接修 | `/review-repair docs/review-fix/<日期>/<任务>-fix-handoff.md` | `使用 review-repair skill 根据 fix-handoff 直接修复` |
| `review-repair`（修复完） | 验证通过 → `code-reading` → 人工 review；改动大则二次 `review-check` | `/code-reading docs/<日期>/<任务>.md` | `使用 code-reading skill 基于 docs/<日期>/<任务>.md 生成代码地图` |
| `code-reading` | 人工 review → 提交 | 人工 | 人工 |

## Finding ID 命名体系（全链路统一）

review-check / review-fix / review-repair 共用同一套 ID 前缀，n 在各前缀内从 1 递增：

| 前缀 | 含义 | 谁产生 |
|------|------|--------|
| `CR-n` | Critical，必须修 | review-check 输出；review-fix 归并后沿用 |
| `IM-n` | Important，修完再继续 | 同上 |
| `MI-n` | Minor，建议处理不阻塞 | 同上 |
| `RJ-n` | Rejected，误报/无证据/超范围，不修但登记原因 | review-fix 汇总时标记 |
| `BK-n` | Blocker，需业务/DB/权限/接口确认后才能动 | 任一环节发现即标记，未解不进入修复 |

流转规则：review-check 首次分配 `CR/IM/MI`；review-fix 汇总多 AI 时**统一重编并在来源列保留各 AI 原始编号**，把拒绝项标 `RJ`、阻塞项标 `BK`；review-repair 按同一 ID 回填 `fixed / deferred-next-batch / blocked / rejected`，不得新起编号。

## 交接时带什么（省 token）

- 默认只复制上一轮的 `【Workflow Brief】` + 产物路径 + finding ID，不粘贴完整 dev-doc / review-task / fix-handoff / 长 diff。
- 下一位 AI 按 Brief 的 `tokenHint` 读取：先读 Brief → `source`/`artifacts` → `changed` 文件 → 必要验证输出。
- 遇到业务语义、权限、状态流转、接口契约、DB 结构、数据修复或证据冲突，必须回到原始文件核对，不能只凭 Brief 推断。
- finding ID 全链路保留：`review-check` 输出 ID → 贴回 `review-fix` 保留 → `review-repair` 按 ID 修复并在结果里回填同一 ID，保证发现→修复→关闭一一对应。

## 停机点（不带病进入下一步）

- Plan Gate 有阻塞 `blockers` / `conflicts` → 只出待确认文档，不给可执行编码提示。
- 没有实际 diff/patch/status → `review-fix` / `review-check` 只能审方案，不能声称审过实现代码。
- 没有明确 findings / fix-handoff / 问题清单 → `review-repair` 不凭空修复，先建议 `review-check`。
- 验证失败 → 回到实现修复并重跑，不进入 Review。
- `review-check` 出 Critical / Important 且未关闭 → 不进入 Submit Gate。
- 需要 DDL / 数据修复 → 停止直接执行，只输出 DBA 申请材料。
