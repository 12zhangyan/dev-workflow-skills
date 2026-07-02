# review-fix Reference

> SKILL.md 的详细模板：Review 任务包、多 AI 审查提示、findings 回收格式、可选修复交接。

---

## Review 任务包模板

````markdown
# <任务名> Review 任务包

> 日期：<YYYY-MM-DD>
> 来源：<dev-doc / patch / code-reading / 上下文>
> 分支/路径：<branch 或 SVN path>
> 阶段：等待其他 AI Review

---

## 一、审查目标

请其他 AI 基于本任务包做 code review，目标是发现会导致线上缺陷、业务偏差、数据错误、回归、安全风险或维护风险的问题。

本次重点确认：
- [ ] 实现是否符合需求/方案文档
- [ ] 关键业务分支、状态流转、异常处理是否正确
- [ ] 本次改动是否引入兼容性、事务、并发、性能、安全问题
- [ ] 测试是否能证明改动正确

---

## 二、证据包

| 类型 | 路径/内容 | 给其他 AI 的使用方式 |
|------|-----------|----------------------|
| 需求/方案文档 | <path 或无> | 对照目标、范围、技术方案 |
| 代码地图 | <path 或无> | 理解调用链、状态机、关键位置 |
| diff/patch | <path 或粘贴位置> | 审查实际改动 |
| 关键源码 | <文件路径列表> | 定位风险和证据 |
| 测试命令 | <mvn test / ./gradlew test / npm test / 待补充> | 判断验证方式 |

---

## 三、统一 Review 清单

| 类别 | 检查点 |
|------|--------|
| 正确性 | 主流程是否符合 dev-doc；返回值、状态流转、异常分支是否正确 |
| 边界 | null、空集合、空字符串、非法枚举、超长、临界值 |
| 事务 | `@Transactional` 边界、跨服务调用、异常回滚、分页状态清理 |
| 并发 | 重复提交、幂等、锁粒度、批量更新、竞态条件 |
| 安全 | 权限校验、越权、敏感信息日志、SQL/表达式注入、明文凭证 |
| 前端鉴权 | 路由守卫、token 刷新队列、登录跳转、管理员权限判断 |
| SSE/流式 | EventSource token、error/done 事件、连接中断、重复消费、loading 收尾 |
| 富文本/预览 | `v-html` 消毒、iframe 地址、生成内容预览边界、静态资源访问 |
| AI 文件沙箱 | 文件读写路径限制、覆盖写前读取、生成/修改模式、部署回滚 |
| 性能 | 循环内远程/DB 调用、N+1 查询、全表扫描、缺索引风险 |
| 兼容 | 接口签名、返回结构、枚举值、配置默认值是否破坏调用方 |
| 配置部署 | CORS、JWT、Redis、LLM profile、Docker、CI 与运行文档是否一致 |
| 可维护性 | 命名、重复逻辑、异常被吞、魔法值、职责边界 |
| 测试 | 是否覆盖正常、异常、边界、回归；测试是否能证明修复有效 |

---

## 四、分发给 Codex 的审查提示

```text
如果当前环境已安装 dev-workflow-skills，请优先直接运行：
/review-check <当前 Review 任务包路径>

如果不能运行 skill，请按下面要求手工审查。

请作为代码审查者，基于以下材料做 review：
1. 需求/方案文档：<dev-doc路径或无>
2. 代码地图：<code-reading路径或无>
3. diff/patch：<patch路径或粘贴内容>
4. 重点源码：<文件路径列表>

审查重点：
- 实现是否符合需求和方案
- 是否存在正确性、边界、事务、并发、安全、性能、兼容性、测试覆盖问题
- 是否有会影响线上稳定性或数据正确性的风险

输出结构化 findings，只关注有证据的问题：
- Severity: Critical / Important / Minor
- File/Line: 文件路径和行号；没有行号则写方法名
- Problem: 问题是什么
- Evidence: 从 diff/源码/文档看到的证据
- Impact: 可能造成什么后果
- Fix: 建议怎么修
- Verify: 如何验证

不要输出泛泛建议，不要要求重构无关代码，不要回滚用户已有改动。
```

---

## 五、分发给 Cursor 的审查提示

```text
如果 Cursor 已加载 dev-workflow-skills，请优先直接运行：
/review-check <当前 Review 任务包路径>

如果不能运行 skill，请按下面要求手工审查。

请在当前工程中按文件上下文审查本次改动。重点看：
- diff 是否符合 <dev-doc路径或功能描述>
- 是否有空指针、边界、事务、并发、权限、性能和接口兼容风险
- 是否缺少测试或验证路径

请按以下 JSON-like 列表输出：
[
  {
    "severity": "Critical|Important|Minor",
    "file": "...",
    "lineOrMethod": "...",
    "problem": "...",
    "evidence": "...",
    "impact": "...",
    "fix": "...",
    "verify": "..."
  }
]

只列可操作问题；没有证据的猜测请放到 notes，不要当 finding。
```

---

## 六、分发给 Claude 的审查提示

```text
如果 Claude 已加载 dev-workflow-skills，请优先直接运行：
/review-check <当前 Review 任务包路径>

如果不能运行 skill，请按下面要求手工审查。

请读取给定 patch / 文档 / 关键源码，做一次偏业务正确性的 code review。
请优先找：
1. 方案和实现不一致
2. 状态、金额、库存、权限、事务、异常处理错误
3. 循环内远程/DB 调用和批量处理问题
4. 测试没有覆盖但风险较高的分支

输出按 Critical / Important / Minor 分组。每条必须包含证据、影响、修复建议、验证方式。
如果认为某条只是风格偏好，请明确标为 Minor 或 notes。
```

---

## 七、Review 结果回收格式

请把其他 AI 的结果贴回时尽量保持以下格式：

```text
来源：Codex / Cursor / Claude

Findings:
1. Severity:
   File/Line:
   Problem:
   Evidence:
   Impact:
   Fix:
   Verify:

Notes:
- <非阻塞建议或不确定观察>
```

````

---

## 汇总规则

### 分级

| 等级 | 判定 |
|------|------|
| Critical | 会导致数据错误、核心流程不可用、安全漏洞、生产事故，必须修 |
| Important | 高概率缺陷、重要回归、边界/异常会失败，修完再继续 |
| Minor | 可维护性、命名、局部测试增强，不阻塞但建议处理 |
| Rejected | 误报、无证据、超范围、与项目规范冲突、收益低 |

### 去重

同一文件/方法/根因的问题合并为一条，保留：
- 最明确的证据
- 最高严重度
- 最可执行的修复建议
- 所有来源 AI：`Codex` / `Cursor` / `Claude`

### 接受标准

Accepted finding 必须同时满足：
- 能定位到文件、方法、接口或数据路径
- 有证据，不只是"可能"
- 能说明影响
- 有修复方式
- 有验证方式

不满足时降级为 Minor 或 Rejected。

---

## 修复交接模板

````markdown
# <任务名> Review 修复交接

> 日期：<YYYY-MM-DD>
> Review 任务包：<docs/review-fix/YYYY-MM-DD/task-review-task.md>
> 状态：草稿

---

## 一、Review 结果汇总

### Critical（必须修）

| ID | 来源 | 文件/位置 | 问题 | 影响 | 修复建议 | 验证方式 |
|----|------|-----------|------|------|----------|----------|
| CR-1 | Codex/Cursor/Claude | | | | | |

### Important（修完再继续）

| ID | 来源 | 文件/位置 | 问题 | 影响 | 修复建议 | 验证方式 |
|----|------|-----------|------|------|----------|----------|
| IM-1 | | | | | | |

### Minor（可选）

| ID | 来源 | 文件/位置 | 问题 | 建议 |
|----|------|-----------|------|------|
| MI-1 | | | | |

### Rejected（不采纳）

| 来源 | 原建议 | 拒绝原因 |
|------|--------|----------|
| | | |

---

## 二、修复策略

- **修复批次**：先 Critical，再 Important，最后按时间处理 Minor。
- **修改边界**：只修改 accepted findings 涉及的文件和必要测试；不重构无关代码。
- **禁止改动**：<接口签名 / 数据结构 / 公共工具 / 无关本地改动>
- **数据库限制**：只允许只读查询；DDL / 数据修复只输出建议，不执行。

---

## 三、修复 Todo

- [ ] 修复 CR-1：<动词 + 文件/方法 + 可观察结果>
- [ ] 修复 IM-1：<动词 + 文件/方法 + 可观察结果>
- [ ] 补充/调整测试：<测试文件 + 覆盖场景>
- [ ] 运行验证命令：<命令>

---

## 四、AI 修复操作码

```text
<由本 skill 生成，可直接粘贴给任意 AI>
```
````

---

## AI 修复操作码模板

````text
你现在接手一次 code-review 修复任务。请严格按以下边界执行，不要自由扩展。

【输入文档】
- Review 修复交接文档：<docs/review-fix/YYYY-MM-DD/task-fix-handoff.md>
- Review 任务包：<docs/review-fix/YYYY-MM-DD/task-review-task.md>
- 需求/方案文档：<dev-doc路径或无>
- 代码地图：<code-reading路径或无>
- patch/diff：<patch路径或当前工作区 diff>

【目标】
修复 accepted findings 中的 Critical 和 Important；Minor 仅在不扩大范围时处理；Rejected 不处理。

【必须修复】
1. <CR/IM ID> <文件/方法>：<问题>。修复到：<期望结果>。验证：<验证方式>

【禁止处理】
- 不处理 Rejected 项。
- 不重构无关代码。
- 不回滚用户已有无关改动。
- 不执行数据库写操作或 DDL；需要时只输出 DBA 建议。

【执行顺序】
1. 先阅读 Review 修复交接文档和 Review 任务包。
2. 查看当前 diff，确认目标文件仍然处于预期状态。
3. 按 Critical -> Important -> Minor 顺序修改。
4. 每修完一类问题，运行对应测试或最小验证。
5. 最后运行总验证命令：<验证命令>。

【完成输出】
- 列出修改文件。
- 对照每个 finding 说明修复结果。
- 粘贴验证命令和结果。
- 如果有无法修复或判断为误报的项，说明原因并停止，不要静默跳过。
````

---

## 第一阶段完成后输出格式

```
✅ Review 任务包已生成：docs/review-fix/<日期>/<任务名>-review-task.md

如果目标 AI 已安装本仓库 skill，直接让它运行：
/review-check docs/review-fix/<日期>/<任务名>-review-task.md

否则请把任务包里的提示分别交给 Codex / Cursor / Claude 做审查。
等它们返回 findings 后，把结果贴回来，我再继续汇总并生成修复交接文档。
```

## 第二阶段完成后输出格式

```
✅ Review 修复交接文档已生成：docs/review-fix/<日期>/<任务名>-fix-handoff.md
📋 已汇总 review 结果：Critical <n> / Important <n> / Minor <n> / Rejected <n>

🤖 AI 修复操作码：
<可直接粘贴给 Codex / Cursor / Claude 的文本>
```

