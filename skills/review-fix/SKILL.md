---
name: review-fix
description: 根据当前上下文生成面向 Codex/Cursor/Claude 等 AI 的代码审查清单，汇总多方 review 结果，产出可执行修复文档与可直接交给任意 AI 执行的"修复操作码"。当用户显式 /review-fix，或要求"让多个 AI review 后生成修复文档/修复提示/修复交接"时使用
argument-hint: [dev-doc路径 | diff/patch路径 | 功能描述]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# Review 修复交接

## 任务定位

把"代码审查"从一次性聊天变成可交接的修复流水线：

1. 基于当前上下文整理 **Code Review 清单**，让 Codex / Cursor / Claude 等 AI 可以按同一标准审查。
2. 汇总多方 review 结果，去重、分级、判断是否接受。
3. 生成 `docs/review-fix/<日期>/<任务名>.md` 修复文档。
4. 输出一段 **AI 修复操作码**，可直接交给任意 AI 执行修复。

与相邻 skill 的分工：
- `/code-reading`：只生成代码地图，不判断问题。
- `/requesting-code-review`：执行一次 AI review。
- `/review-fix`：组织多 AI review、汇总结果、产出修复文档和修复操作码。
- `/bug-fix`：面向线上/测试 Bug 的现象、根因、修复记录。

## 执行流程

### Step 0：入口检测

`$entry` 为空时询问：

> "这次要基于什么做 review-fix？可以给 dev-doc 路径、patch/diff 路径、code-reading 路径，或一句功能描述。"

入口模式：
- 含 `.patch` / `.diff` 或路径名含 `changes.patch` → **patch 模式**
- 含 `.md` 且路径在 `docs/` 下 → **文档模式**
- 其他自然语言 → **上下文模式**

告知用户："检测到入口模式：[模式名]，开始整理 review 清单。"

### Step 1：静默收集上下文

执行以下命令，结果仅用于文档和提示生成，不展示给用户：

```bash
if git rev-parse --git-dir 2>/dev/null; then
  git branch --show-current 2>/dev/null
  git diff --name-status 2>/dev/null
else
  svn info 2>/dev/null | grep -E "^(Relative URL|Revision):"
  svn diff --summarize 2>/dev/null
fi
ls pom.xml build.gradle package.json 2>/dev/null
```

按入口读取：
- 文档模式：Read `$entry`，并尝试读取同日期/同任务的 `docs/code-reading/` 文档。
- patch 模式：Read patch/diff 文件，提取文件列表、变更类型和关键 hunks。
- 上下文模式：用 Grep/Glob 查找候选入口；不确定时问用户确认入口或改用 dev-doc/patch。

### Step 2：生成 Review 清单和多 AI 审查提示

加载模板：[reference.md](reference.md#review-清单模板)

产出三部分：

1. **统一审查清单**：按正确性、边界、事务、并发、安全、性能、兼容性、可维护性、测试覆盖分类。
2. **多 AI 审查提示**：分别给 Codex、Cursor、Claude，要求它们基于同一上下文输出结构化 findings。
3. **证据包清单**：列出需要提供给其他 AI 的文件：dev-doc、patch/diff、code-reading、关键源码路径、测试命令。

如果用户尚未提供其他 AI 的 review 结果，先输出审查提示并询问：

> "请把 Codex/Cursor/Claude 任一或多个 review 结果贴回来；我会继续汇总成修复文档。"

用户已经贴了 review 结果时，继续 Step 3。

### Step 3：汇总 Review 结果

加载模板：[reference.md](reference.md#汇总规则)

处理规则：
- 只接受有文件/方法/行为证据的问题；纯风格偏好默认降为 Minor 或拒绝。
- 多个 AI 提到同一问题时合并，保留最清晰的复现/影响描述。
- 按 `Critical / Important / Minor / Rejected` 分级。
- 每条 accepted finding 必须包含：问题、证据、影响、修复建议、验证方式。
- 对不修的问题写清拒绝原因：误报、无证据、超范围、收益低、与项目规范冲突。

### Step 4：生成修复文档

路径：

```bash
d=$(date +%F) && mkdir -p "docs/review-fix/$d" && echo "$d"
```

文件：`docs/review-fix/<日期>/<任务名>.md`

冲突处理：Read 检查目标文件是否存在。
- 存在 → AskUserQuestion：A 覆盖 / B 时间戳后缀 / C 取消。默认建议 A。
- 不存在 → 直接 Write。

文档模板见：[reference.md](reference.md#修复文档模板)

### Step 4.5：登记到 HTML 看板

将 review-fix 文档作为普通文档条目登记到看板，`type` 固定为 `"代码审查"`，`status` 固定为 `"草稿"`。

字段：

| JS 字段 | 取值 |
|---------|------|
| `service` / `module` | 优先复用 dev-doc 看板条目；否则询问 `服务/模块` |
| `title` | `<任务名> Review 修复交接` |
| `date` | Step 4 日期 |
| `type` | `"代码审查"` |
| `complexity` | accepted findings 数量：0-2 简单，3-6 中等，7+ 复杂 |
| `status` | `"草稿"` |
| `branch` | Step 1 检测值 |
| `docPath` | Step 4 文档路径 |
| `background` | 本次 review 的上下文、审查来源、为什么需要修 |
| `goals` | accepted findings 的修复目标 |
| `scopeIn` / `scopeOut` | 本次修复范围 / 明确不修问题 |
| `solution` | 修复批次与总体策略 |
| `coreDesign` | 分级、取舍、拒绝项原因 |
| `keyImpl` | 前 5 个 accepted findings → `{title, desc}` |
| `changeList` | 需要修改或重点检查的文件 |
| `todos` | AI 修复操作码中的执行步骤 |

看板创建、升级、写入、构建流程与 `/dev-doc` Step 5.5 / 5.6 相同：使用 `project-html/board-add.js` 写入，禁止手工重写 `data/changes.js`。

### Step 5：输出 AI 修复操作码

加载模板：[reference.md](reference.md#ai-修复操作码模板)

操作码必须包含：
- 任务目标
- 输入文档路径
- 必修 / 可选 / 拒绝问题清单
- 修改边界
- 执行顺序
- 验证命令
- 完成后回填要求

结尾提醒：

> 将下面的"AI 修复操作码"粘贴给任意 AI（Codex / Cursor / Claude）即可开始修复；修复后重跑验证，再用 `/code-reading` 或人工 review 做最终确认。

## 规则

- **只读数据库**：不得要求 AI 执行写库 SQL；涉及 DDL/数据修复只输出建议和 DBA 申请说明。
- **不吞拒绝项**：不采纳的 review 意见必须写入 Rejected，说明理由。
- **不让 AI 自由发挥**：修复操作码必须限定文件、问题、顺序、验证。
- **先验证再修复交接**：如果当前项目有测试命令，操作码必须要求修复后运行。
- **尊重现有改动**：修复操作码必须提醒不要回滚无关本地改动。

## 检查清单（生成前确认）

- [ ] 已识别入口模式并收集 dev-doc / patch / code-reading / diff 上下文
- [ ] 已生成统一 review 清单和 Codex/Cursor/Claude 审查提示
- [ ] 已汇总至少一个 AI review 结果；若没有结果，已停在 Step 2 等用户贴回
- [ ] findings 已分为 Critical / Important / Minor / Rejected
- [ ] 每条 accepted finding 有证据、影响、修复建议、验证方式
- [ ] 修复文档已写入 `docs/review-fix/<日期>/<任务名>.md`
- [ ] AI 修复操作码已生成，且包含修改边界和验证命令
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`，并已运行 `node project-html/build.js`

## 相关资源

- 详细模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 工作流背景：仓库 `docs/workflow-guide.md`
- 相邻 skill：`/dev-doc`、`/code-reading`、`/bug-fix`
