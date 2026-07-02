# Java 后端开发工作流（Claude Code + SVN）

> 适用场景：Java Spring Boot / MVC 后端开发，团队使用 SVN，借助 Claude Code 或 Cursor 辅助开发。

---

## 一、工作流概览

```
【规划】          【执行】           【验收】              【提交】
/dev-doc  →  Claude/Cursor  →  读代码 + 测试 + Review  →  svn commit
```

---

## 二、安装 Skills

工作流依赖两个 skill 包，需要分别安装：

### 1. superpowers-zh（提供 brainstorming、code-review 等通用 skill）

```bash
npx superpowers-zh
```

### 2. dev-workflow-skills（提供 dev-doc、bug-fix、code-reading、biz-flow、review-fix）

```bash
# macOS / Linux / Git Bash
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

安装完成后重启 Claude Code 生效。

### 所需 Skills 一览

| Skill | 来源 | 用途 | 调用方式 |
|-------|------|------|---------|
| `/dev-doc` | dev-workflow-skills | 生成开发文档（工作流第一步） | 显式调用 |
| `/bug-fix` | dev-workflow-skills | 记录 Bug、搜代码定位根因、生成修复文档并登记看板 | 显式调用 |
| `/code-reading` | dev-workflow-skills | Review 前生成代码地图（调用链 + 状态机 + 代码位置） | 显式调用 |
| `/biz-flow` | dev-workflow-skills | 把一组接口捋成面向测试的业务流方案（业务流转/数据流/时序图） | 显式调用 |
| `/review-fix` | dev-workflow-skills | 生成可分发给多 AI 的 code-review 审查清单；贴回结果后再汇总修复交接和 AI 修复操作码 | 显式调用 |
| `/brainstorming` | superpowers-zh | 复杂需求分析，在 dev-doc 之前使用 | 显式调用 |
| `/requesting-code-review` | superpowers-zh | 派遣 subagent 自动做代码审查（Git 项目） | 显式调用 |
| `/chinese-code-review` | superpowers-zh | 整理中文 PR 评论话术 | 显式调用 |
| `/receiving-code-review` | superpowers-zh | 处理 review 反馈，判断是否接受 | 按需调用 |
| `/compact` | superpowers-zh | 上下文超 50% 时压缩，防止对话失焦 | 按需调用 |

---

## 三、简单任务（Bug 修复 / 小功能）

### Step 1　生成开发文档

```
/dev-doc [任务名称]
```

依次回答 Claude 的提问（任务类型、复杂度、需求背景等），文档自动保存到 `docs/YYYY-MM-DD/[任务名].md`。

### Step 2　交给 Claude/Cursor 执行

把文档末尾生成的「🤖 执行提示」直接粘贴给 Claude 或 Cursor：

```
"参考 docs/YYYY-MM-DD/[任务名].md 实现技术方案。
按「六、代码变更清单」逐项执行。
修改类条目先确认「最小影响分析」中的原因再动手。"
```

等待执行完成。

### Step 3　纳入版本控制

```bash
svn add <新增的文件>     # 新文件必须 add，否则不进版本历史
svn status              # 确认哪些文件变了
svn diff                # 快速扫一遍完整变更
```

### Step 4　阅读主要代码（不可跳过）

打开文档「六、代码变更清单」，**重点读"修改"类条目**，新增类可略读：

- 业务核心逻辑（计算、状态变更、条件判断分支）
- 对外接口（入参校验、响应结构）
- 事务、锁、并发相关代码

> 目的：发现方向性错误和业务逻辑偏差，这类问题测试和 AI Review 都不一定能发现。

### Step 5　运行测试（验证）

```bash
mvn test           # Maven 项目
./gradlew test     # Gradle 项目
```

**测试全绿才继续，有失败先修复。**

### Step 6　AI 代码审查

**SVN 项目：**
```bash
svn diff > /tmp/changes.patch
# 然后告诉 Claude："读取 /tmp/changes.patch，对照 docs/.../[任务名].md 做代码审查"
```

**Git 项目：**
```
/requesting-code-review
```

按返回的 Critical / Important / Minor 分级处理：
- Critical → 必须修复
- Important → 修复后再继续
- Minor → 记录，可稍后处理

如果希望让 Codex/Cursor/Claude 等多个 AI 独立审查，先运行：

```
/review-fix docs/YYYY-MM-DD/[任务名].md
```

它会先生成 `docs/review-fix/YYYY-MM-DD/[任务名]-review-task.md`，里面包含审查目标、上下文、代码变更入口、分级标准和可直接粘贴给其他 AI 的 review 提示。把这份任务包分别交给 Codex/Cursor/Claude 审查。

拿到多份 review 结果后，把结果贴回当前对话，再让 `/review-fix` 继续汇总。它会去重、分级、判断是否采纳，生成 `docs/review-fix/` 修复交接文档，并输出一段可直接粘贴给任意 AI 的修复操作码。

修复完成后重新跑一遍测试，确认全绿。

### Step 7　生成代码地图，自己 Review

```
/code-reading docs/YYYY-MM-DD/[任务名].md
```

或直接用入口类：

```
/code-reading [Controller类名]#[方法名]
```

地图文档保存到 `docs/code-reading/`，对照地图检查：
- 调用链是否符合预期
- 状态跳转是否正确
- 关键注意点（事务边界、并发、边界条件）

### Step 8　提交

```bash
svn commit -m "[任务类型] [任务名称]：简要说明"
```

---

## 四、复杂功能（跨模块 / 新业务流程）

在简单任务流程基础上，增加以下步骤：

### 0. 需求分析（在 dev-doc 之前）

```
/brainstorming
```

把模糊需求拆成清晰的技术方案，再进入 dev-doc。

### 2.5　上下文压缩

对话超过 50% 上下文时执行：

```
/compact
```

防止对话过长导致 Claude 遗漏前面的约定。

### 4. 阅读代码（更认真）

复杂任务不能略读，需要理解整体改动逻辑，特别是：
- 模块间的调用关系是否正确
- 事务边界是否合理
- 原有功能是否受影响（对照「最小影响分析」）

---

## 五、完整步骤对照表

| 步骤 | 简单任务 | 复杂任务 |
|------|---------|---------|
| 需求分析 | 跳过 | `/brainstorming` |
| 生成文档 | `/dev-doc` | `/dev-doc` |
| 上下文压缩 | 按需 | 推荐 `/compact` |
| AI 执行 | 粘贴执行提示 | 粘贴执行提示 |
| 纳入版本控制 | `svn add + status` | `svn add + status` |
| 验证 | `mvn test` | `mvn test` |
| AI Review + 修复 | `svn diff > patch` 后让 Claude 审查，必要时 `/review-fix` 生成审查清单并汇总修复 | `svn diff > patch` 后用 `/review-fix` 生成多 AI 审查任务包，贴回结果后汇总交接 |
| 代码地图 + 人工 Review | `/code-reading <doc路径>` | `/code-reading <doc路径>` |
| 提交 | `svn commit` | `svn commit` |

---

## 六、核心规则

| 规则 | 说明 |
|------|------|
| **测试全绿才进 Review** | Review 关注设计，不是排查编译失败 |
| **svn add 在测试前** | 测试要能找到新文件，否则测不完整 |
| **AI review 后才人工 review** | AI 先消除低级问题；多 AI 审查用 `/review-fix` 先生成审查清单，贴回结果后汇总成可执行修复交接，再用 `/code-reading` 地图关注业务逻辑和架构 |
| **AI 不会自动提交** | `svn commit` 永远由你触发，提交权在你手里 |
| **复杂任务先 brainstorming** | 方向错了，文档和代码都白费 |

---

## 七、一句话速记

```
写文档 → AI 执行 → add 新文件 → 读 diff → 跑测试 → /review-fix 审查清单 → 多 AI review → 汇总修复 → /code-reading → 人工 review → 提交
```
