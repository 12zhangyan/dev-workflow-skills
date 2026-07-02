---
name: review-fix
description: 根据当前上下文生成可分发给 Codex/Cursor/Claude 等 AI 的代码审查清单、证据包和 review 提示；当用户显式 /review-fix，或要求"列出 code-review 清单/让其他 AI review/生成 AI 审查提示"时使用。仅在用户贴回 review 结果或明确要求汇总修复时，才继续生成修复交接文档和修复操作码
argument-hint: [dev-doc路径 | diff/patch路径 | 功能描述]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# Review 清单生成与修复交接

## 任务定位

默认目标：**先给出一份可以交给其他 AI 的 Code Review 任务包**，让 Codex / Cursor / Claude 等 AI 按同一标准去审查。

任务包包含：
1. 审查上下文：需求文档、代码地图、diff/patch、关键源码、测试命令。
2. 审查清单：正确性、边界、事务、并发、安全、性能、兼容性、测试覆盖等检查点。
3. 分发提示：分别给 Codex / Cursor / Claude 的可复制 review prompt。
4. 回收格式：要求其他 AI 用结构化 findings 返回，便于后续汇总。

第二阶段才做：当用户贴回其他 AI 的 review 结果，或明确说"汇总/生成修复文档/生成修复操作码"时，再去重分级，生成 `docs/review-fix/<日期>/<任务名>-fix-handoff.md` 和 AI 修复操作码。

与相邻 skill 的分工：
- `/code-reading`：只生成代码地图，不判断问题。
- `/code-review`：根据本 skill 生成的任务包执行一次只读审查，输出可回收 findings。
- `/requesting-code-review`：执行一次通用 AI review（Git 项目）。
- `/review-fix`：先生成 review 任务包；可选地汇总 review 结果并交接修复。
- `/bug-fix`：面向线上/测试 Bug 的现象、根因、修复记录。

## 执行流程

### Step 0：入口检测

`$entry` 为空时询问：

> "这次要基于什么生成 review 清单？可以给 dev-doc 路径、patch/diff 路径、code-reading 路径，或一句功能描述。"

入口模式：
- 含 `.patch` / `.diff` 或路径名含 `changes.patch` → **patch 模式**
- 含 `.md` 且路径在 `docs/` 下 → **文档模式**
- 其他自然语言 → **上下文模式**

告知用户："检测到入口模式：[模式名]，开始整理 review 任务包。"

### Step 1：静默收集上下文

执行以下命令，结果仅用于生成 review 任务包，不展示给用户：

```bash
vcs_root="$PWD"
vcs_type="none"
while [ "$vcs_root" != "/" ]; do
  if [ -e "$vcs_root/.git" ]; then vcs_type="git"; break; fi
  if [ -d "$vcs_root/.svn" ]; then vcs_type="svn"; break; fi
  parent=$(dirname "$vcs_root")
  [ "$parent" = "$vcs_root" ] && break
  vcs_root="$parent"
done
case "$vcs_type" in
  git)
    echo "VCS_TYPE=git"
    git -c "safe.directory=$vcs_root" -C "$vcs_root" branch --show-current 2>/dev/null
    git -c "safe.directory=$vcs_root" -C "$vcs_root" diff --name-status 2>/dev/null
    ;;
  svn)
    echo "VCS_TYPE=svn"
    svn info "$vcs_root" 2>/dev/null | grep -E "^(Relative URL|Revision):"
    svn diff --summarize "$vcs_root" 2>/dev/null
    ;;
  *) echo "VCS_TYPE=none" ;;
esac
ls pom.xml build.gradle package.json 2>/dev/null
```

判断规则：先按目录结构识别 Git/SVN，不要用"git 命令失败"推断为 SVN 或无 VCS。Git 出现 dubious ownership / safe.directory 报错时，只使用 `git -c "safe.directory=$vcs_root"` 做本次只读命令，不修改全局 git 配置。

按入口读取：
- 文档模式：Read `$entry`，提取需求目标、范围、代码变更清单、测试要点；尝试读取同日期/同任务的 `docs/code-reading/` 文档。
- patch 模式：Read patch/diff 文件，提取文件列表、变更类型、关键 hunks。
- 上下文模式：用 Grep/Glob 查找候选入口；不确定时问用户确认入口或改用 dev-doc/patch。

### Step 2：生成 Review 任务包

加载模板：[reference.md](reference.md#review-任务包模板)

产出一份文档，默认路径：

```bash
d=$(date +%F) && mkdir -p "docs/review-fix/$d" && echo "$d"
```

文件：`docs/review-fix/<日期>/<任务名>-review-task.md`

文档必须包含：
1. **审查目标**：这次 review 要确认什么。
2. **证据包**：其他 AI 需要读取/粘贴的文档、diff、源码、测试命令。
3. **统一审查清单**：按风险类别列出检查项。
4. **AI 分发提示**：Codex / Cursor / Claude 三份可复制 prompt。
5. **技能化审查入口**：提示安装了本仓库 skill 的 AI 可直接运行 `/code-review <任务包路径>`。
6. **回收格式**：要求其他 AI 按统一 JSON-like findings 返回。

冲突处理：Read 检查目标文件是否存在。
- 存在 → AskUserQuestion：A 覆盖 / B 时间戳后缀 / C 取消。默认建议 A。
- 不存在 → 直接 Write。

### Step 2.5：输出并停住

完成 Step 2 后输出：

```text
✅ Review 任务包已生成：docs/review-fix/<日期>/<任务名>-review-task.md

下一步：
1. 如果目标 AI 已安装本仓库 skill，直接让它运行：`/code-review docs/review-fix/<日期>/<任务名>-review-task.md`
2. 否则把任务包里的「Codex / Cursor / Claude 审查提示」分别交给对应 AI
3. 将它们返回的 findings 粘贴回来，再运行/继续 `/review-fix` 汇总
```

**如果用户没有贴回 review 结果，到这里停止，不要生成修复文档，不要编造 findings。**

### Step 3：汇总 Review 结果（仅在用户贴回结果后执行）

触发条件：
- 用户贴回 Codex/Cursor/Claude 任一或多个 review 结果。
- 用户明确说："汇总 review"、"生成修复文档"、"生成修复操作码"。

加载模板：[reference.md](reference.md#汇总规则)

处理规则：
- 只接受有文件/方法/行为证据的问题；纯风格偏好默认降为 Minor 或 Rejected。
- 多个 AI 提到同一问题时合并，保留最清晰的证据和最高严重度。
- 按 `Critical / Important / Minor / Rejected` 分级。
- 每条 accepted finding 必须包含：问题、证据、影响、修复建议、验证方式。
- 对不修的问题写清拒绝原因：误报、无证据、超范围、收益低、与项目规范冲突。

### Step 4：生成修复交接文档（第二阶段）

路径：`docs/review-fix/<日期>/<任务名>-fix-handoff.md`

文档模板见：[reference.md](reference.md#修复交接模板)

### Step 4.5：登记到 HTML 看板（第二阶段）

仅在生成修复交接文档时登记看板。将 review-fix 文档作为普通文档条目登记，`type` 固定为 `"代码审查"`，`status` 固定为 `"草稿"`。

看板创建、升级、写入、构建流程与 `/dev-doc` Step 5.5 / 5.6 相同：使用 `project-html/board-add.js` 写入，禁止手工重写 `data/changes.js`。

### Step 5：输出 AI 修复操作码（第二阶段）

加载模板：[reference.md](reference.md#ai-修复操作码模板)

操作码必须包含：
- 任务目标
- 输入文档路径
- 必修 / 可选 / 拒绝问题清单
- 修改边界
- 执行顺序
- 验证命令
- 完成后回填要求

## 规则

- **默认只生成 review 任务包**：没有其他 AI 的 findings 时，必须停在 Step 2.5。
- **不编造 review 结果**：不能自己假装 Codex/Cursor/Claude 已经审查。
- **只读数据库**：不得要求 AI 执行写库 SQL；涉及 DDL/数据修复只输出建议和 DBA 申请说明。
- **不吞拒绝项**：第二阶段不采纳的 review 意见必须写入 Rejected，说明理由。
- **不让 AI 自由发挥**：审查提示和修复操作码都必须限定材料、范围、输出格式和验证方式。
- **尊重现有改动**：提示中必须提醒不要回滚无关本地改动。

## 检查清单

### 第一阶段：Review 任务包

- [ ] 已识别入口模式并收集 dev-doc / patch / code-reading / diff 上下文
- [ ] 已生成证据包清单
- [ ] 已生成统一 review 清单
- [ ] 已生成 Codex / Cursor / Claude 审查提示
- [ ] 已提示可用 `/code-review <review-task路径>` 执行审查
- [ ] 已写明 findings 回收格式
- [ ] 没有 review 结果时已停住，没有生成修复文档

### 第二阶段：修复交接

- [ ] 用户已贴回至少一个 AI review 结果
- [ ] findings 已分为 Critical / Important / Minor / Rejected
- [ ] 每条 accepted finding 有证据、影响、修复建议、验证方式
- [ ] 修复交接文档已写入 `docs/review-fix/<日期>/<任务名>-fix-handoff.md`
- [ ] AI 修复操作码已生成，且包含修改边界和验证命令
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`，并已运行 `node project-html/build.js`

## 相关资源

- 详细模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 工作流背景：仓库 `docs/workflow-guide.md`
- 相邻 skill：`/dev-doc`、`/code-reading`、`/bug-fix`
