# review-fix Reference

> SKILL.md 的详细模板：review 清单、多 AI 审查提示、汇总规则、修复文档、AI 修复操作码。

---

## Review 清单模板

### 审查目标

- 对照需求/开发文档确认实现是否偏离目标。
- 对照 diff/patch 找出会导致线上缺陷、数据错误、回归或维护风险的问题。
- 只输出有证据的问题，不输出泛泛建议。

### 审查范围

| 类别 | 检查点 |
|------|--------|
| 正确性 | 主流程是否符合 dev-doc；返回值、状态流转、异常分支是否正确 |
| 边界 | null、空集合、空字符串、非法枚举、超长、临界值 |
| 事务 | `@Transactional` 边界、跨服务调用、异常回滚、分页状态清理 |
| 并发 | 重复提交、幂等、锁粒度、批量更新、竞态条件 |
| 安全 | 权限校验、越权、敏感信息日志、SQL/表达式注入、明文凭证 |
| 性能 | 循环内远程/DB 调用、N+1 查询、全表扫描、缺索引风险 |
| 兼容 | 接口签名、返回结构、枚举值、配置默认值是否破坏调用方 |
| 可维护性 | 命名、重复逻辑、异常被吞、魔法值、职责边界 |
| 测试 | 是否覆盖正常、异常、边界、回归；测试是否能证明修复有效 |

### 多 AI 审查提示

#### Codex 审查提示

```text
请作为代码审查者，基于以下材料做 review：
1. 需求/方案文档：<dev-doc路径或无>
2. 代码地图：<code-reading路径或无>
3. diff/patch：<patch路径或粘贴内容>
4. 重点源码：<文件路径列表>

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

#### Cursor 审查提示

```text
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

#### Claude 审查提示

```text
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

## 修复文档模板

````markdown
# <任务名> Review 修复交接

> 日期：<YYYY-MM-DD>
> 来源：<dev-doc / patch / code-reading / 上下文>
> 分支/路径：<branch 或 SVN path>
> 状态：草稿

---

## 一、上下文

- **需求/方案文档**：<path 或无>
- **代码地图**：<path 或无>
- **diff/patch**：<path 或说明>
- **测试命令**：<mvn test / ./gradlew test / npm test / 待补充>

### 本次变更概述

<用 3-5 句说明这次改动做了什么、为什么需要 review-fix、哪些模块风险最高。>

---

## 二、Review 证据包

| 类型 | 路径/内容 | 用途 |
|------|-----------|------|
| dev-doc | | 对照需求与方案 |
| code-reading | | 理解调用链和状态流 |
| patch/diff | | 审查实际改动 |
| 源码 | | 定位问题 |

---

## 三、AI Review 清单

<粘贴或摘要 Codex/Cursor/Claude 的审查提示，便于复跑。>

---

## 四、Review 结果汇总

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

## 五、修复策略

- **修复批次**：先 Critical，再 Important，最后按时间处理 Minor。
- **修改边界**：只修改 accepted findings 涉及的文件和必要测试；不重构无关代码。
- **禁止改动**：<接口签名 / 数据结构 / 公共工具 / 无关本地改动>
- **数据库限制**：只允许只读查询；DDL / 数据修复只输出建议，不执行。

---

## 六、修复 Todo

- [ ] 修复 CR-1：<动词 + 文件/方法 + 可观察结果>
- [ ] 修复 IM-1：<动词 + 文件/方法 + 可观察结果>
- [ ] 补充/调整测试：<测试文件 + 覆盖场景>
- [ ] 运行验证命令：<命令>

---

## 七、AI 修复操作码

```text
<由本 skill 生成，可直接粘贴给任意 AI>
```

---

## 八、修复后回填

- [ ] 在本文档勾选已修 findings。
- [ ] 记录验证命令和结果。
- [ ] 如修复后仍有 review 意见，追加到「Review 结果汇总」。
- [ ] 修复验证后更新看板状态为 `已完成`。
````

---

## AI 修复操作码模板

````text
你现在接手一次 code-review 修复任务。请严格按以下边界执行，不要自由扩展。

【输入文档】
- Review 修复交接文档：<docs/review-fix/YYYY-MM-DD/task.md>
- 需求/方案文档：<dev-doc路径或无>
- 代码地图：<code-reading路径或无>
- patch/diff：<patch路径或当前工作区 diff>

【目标】
修复 accepted findings 中的 Critical 和 Important；Minor 仅在不扩大范围时处理；Rejected 不处理。

【必须修复】
1. <CR/IM ID> <文件/方法>：<问题>。修复到：<期望结果>。验证：<验证方式>
2. ...

【可选修复】
1. <MI ID> ...

【禁止处理】
- 不处理 Rejected 项。
- 不重构无关代码。
- 不回滚用户已有无关改动。
- 不执行数据库写操作或 DDL；需要时只输出 DBA 建议。

【执行顺序】
1. 先阅读 Review 修复交接文档和相关 dev-doc/code-reading。
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

## HTML 看板 entry 建议

```json
{
  "changelog": "新增 Review 修复交接：<title>",
  "entry": {
    "service": "<service>",
    "module": "<module>",
    "title": "<title> Review 修复交接",
    "date": "<date>",
    "type": "代码审查",
    "complexity": "<简单|中等|复杂>",
    "status": "草稿",
    "branch": "<branch>",
    "docPath": "<docPath>",
    "background": "<review 上下文和高风险区域>",
    "goals": ["修复 CR-1", "修复 IM-1"],
    "scopeIn": ["accepted findings 涉及的文件和测试"],
    "scopeOut": ["Rejected 项", "无关重构", "数据库写操作"],
    "solution": "<修复批次和总体策略>",
    "coreDesign": "<为什么接受/拒绝这些 review 意见>",
    "keyImpl": [
      { "title": "CR-1 <问题名>", "desc": "<证据 + 修复方向 + 验证方式>" }
    ],
    "changeList": [
      { "file": "<path>", "action": "修改", "desc": "<需要修复或重点检查的原因>" }
    ],
    "todos": ["修复 CR-1", "运行 <验证命令>"]
  }
}
```

---

## 完成后输出格式

```
✅ Review 修复交接文档已生成：docs/review-fix/<日期>/<任务名>.md
📋 已汇总 review 结果：Critical <n> / Important <n> / Minor <n> / Rejected <n>
📄 HTML 看板已更新：project-html/data/changes.js

🤖 AI 修复操作码：
<可直接粘贴给 Codex / Cursor / Claude 的文本>

下一步：
1. 把 AI 修复操作码交给任意 AI 执行修复
2. 修复后运行验证命令
3. 再运行 /code-reading 或人工 review 做最终确认
```
