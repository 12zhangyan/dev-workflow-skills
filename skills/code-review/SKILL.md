---
name: code-review
description: 根据 /review-fix 生成的 Review 任务包、dev-doc、patch/diff 或当前工作区变更执行一次只读代码审查，按统一清单输出结构化 findings。仅在用户显式 /code-review，或要求"按审查清单 review/执行 review/输出 findings 给 review-fix 汇总"时使用；不得修改代码或生成修复交接文档
argument-hint: [review-task路径 | dev-doc路径 | diff/patch路径 | 功能描述]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# 代码审查执行

## 任务定位

执行一次**只读 code review**。它回答的是："这批改动有没有会导致缺陷、回归、安全风险或维护风险的问题？"

与相邻 skill 的分工：
- `/review-fix`：生成 Review 任务包，回收多方 findings，并产出修复交接。
- `/code-review`：拿任务包或 diff 执行一次审查，只输出 findings，不修代码。
- `/code-reading`：生成代码地图，只梳理结构，不判断问题。

## 执行流程

### Step 0：入口识别

`$entry` 为空时询问：

> "这次要审查什么？请给 Review 任务包路径、dev-doc 路径、patch/diff 路径，或一句功能描述。"

入口模式：
- 路径包含 `review-task.md` 或文档标题含 `Review 任务包` → **任务包模式**
- 含 `.patch` / `.diff` 或文件名含 `changes.patch` → **patch 模式**
- 含 `.md` 且路径在 `docs/` 下 → **文档模式**
- 其他自然语言 → **上下文模式**

告知用户："检测到入口模式：[模式名]，开始只读审查。"

### Step 1：收集审查材料

静默执行，只用于审查，不完整展示给用户：

```bash
if git rev-parse --git-dir 2>/dev/null; then
  git branch --show-current 2>/dev/null
  git diff --name-status 2>/dev/null
  git diff --stat 2>/dev/null
else
  svn info 2>/dev/null | grep -E "^(Relative URL|Revision):"
  svn diff --summarize 2>/dev/null
fi
ls pom.xml build.gradle package.json 2>/dev/null
```

按模式读取：
- 任务包模式：Read `$entry`，提取审查目标、证据包路径、关键源码、测试命令和回收格式。
- patch 模式：Read patch/diff，提取文件列表、关键 hunk、接口/状态/事务相关改动。
- 文档模式：Read dev-doc，提取目标、范围、代码变更清单、测试关注点；必要时读取同日期的 `docs/code-reading/`。
- 上下文模式：用 Grep/Glob 查找候选入口；不确定时询问用户补充 dev-doc、patch 或入口类。

优先读取：
1. 变更文件中被修改的 Java/SQL/XML/YAML 配置。
2. Controller/Service/Mapper/Repository/DTO/枚举/配置类。
3. 任务包或 dev-doc 明确点名的关键文件。

### Step 2：按清单审查

加载清单：[reference.md](reference.md#审查清单)

审查顺序：
1. **需求一致性**：实现是否符合 dev-doc / Review 任务包目标。
2. **业务正确性**：主流程、状态流转、金额/数量/权限/库存等关键规则。
3. **边界与异常**：null、空集合、非法枚举、重复提交、异常分支。
4. **事务与并发**：回滚边界、跨服务调用、幂等、锁、分页状态。
5. **安全与敏感信息**：越权、敏感日志、注入、明文凭证。
6. **性能与兼容**：N+1、循环远程调用、接口签名/响应结构变更。
7. **测试与验证**：测试是否覆盖正常、异常、边界、回归。

### Step 3：判定 finding

只输出满足以下条件的问题：
- 能定位到文件、方法、接口、配置或数据路径。
- 有来自 diff/源码/文档的证据。
- 能说明影响。
- 有可执行修复建议。
- 有验证方式。

分级：
- `Critical`：可能造成数据错误、核心流程不可用、安全漏洞、生产事故。
- `Important`：高概率缺陷、重要回归、边界/异常会失败，修完再继续。
- `Minor`：维护性、局部测试增强、命名/重复逻辑等不阻塞问题。
- `Notes`：不确定观察或非阻塞建议，不进入 findings。

### Step 4：输出结构化结果

按模板输出：[reference.md](reference.md#输出格式)

要求：
- findings 按 `Critical / Important / Minor` 分组。
- 每条包含 `File/Line`、`Problem`、`Evidence`、`Impact`、`Fix`、`Verify`。
- 没有明确问题时，输出"未发现有证据的阻塞问题"，并列出已检查范围。
- 不输出大段源码，不复述全部 diff。

### Step 5：结束提醒

结尾输出：

```text
可将以上 findings 原样贴回 /review-fix，用于生成修复交接文档。
```

## 禁止事项

- 不修改代码，不写文件，不运行修复命令。
- 不执行数据库写操作或 DDL；涉及数据库只允许只读分析。
- 不把风格偏好包装成严重问题。
- 不因为"可能"就输出 finding；证据不足放入 Notes。
- 不要求重构无关模块，不回滚用户已有改动。

## 检查清单

- [ ] 已识别入口模式
- [ ] 已读取任务包 / dev-doc / patch / 关键源码
- [ ] 已按审查清单覆盖正确性、边界、事务、并发、安全、性能、兼容、测试
- [ ] 每条 finding 都有证据、影响、修复建议、验证方式
- [ ] 未修改任何代码或文档
- [ ] 输出可直接贴回 `/review-fix`

## 相关资源

- 审查清单与输出模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 组织多 AI review 与修复交接：`/review-fix`
- Review 前代码地图：`/code-reading`
