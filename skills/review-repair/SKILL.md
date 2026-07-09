---
name: review-repair
description: 根据 review-check / code review findings 或 review-fix 修复交接直接修改代码并验证；当用户说"review 后直接修"、"按 review 结果修复"、"修复这些 findings"、"code review 后直接改代码"、"使用 review-repair skill"时使用。此 skill 会执行修复，不是只读审查；只在已有 findings、fix-handoff、review 结果或明确问题清单时触发。
argument-hint: [findings文本 | review结果路径 | fix-handoff路径 | review-task路径]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# Review 后直接修复

## 任务定位

本 skill 用于 **Code Review 之后直接修代码**。它接收 `review-check` findings、其他 AI 的 code review 结果、`review-fix` 生成的 fix-handoff，或用户粘贴的问题清单，然后在当前工作区内完成修复、补必要测试、运行验证并输出闭环结果。

与相邻 skill 的分工：
- `review-check`：只读审查，只输出 findings，不改代码。
- `review-fix`：生成 review 任务包、汇总多 AI findings、产出修复交接和操作码。
- `review-repair`：拿已明确的问题直接修复，并证明修复结果。
- `code-reading`：生成代码地图，不判断问题，不修代码。

## 共享协议

先遵循 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)：证据预填、只问阻塞问题、显式记录需求/实现/状态/权限/数据归属冲突。

同时遵循 [../_shared/workflow-gates.md](../_shared/workflow-gates.md)：本 skill 位于 Review Gate 之后、Verification Gate 之前；修完必须回到 Verification Gate，并输出每条 accepted finding 的处理结果。

## 执行流程

### Step 0：入口识别

`$entry` 为空时只问一个问题：

> "请贴 review findings，或给 `docs/review-fix/...-fix-handoff.md` / `...-review-task.md` 路径。"

入口模式：
- 路径含 `fix-handoff.md` → **修复交接模式**，优先读取其中的 Critical / Important / Minor / Rejected。
- 路径含 `review-task.md` → **任务包模式**，读取任务包；若没有 findings，要求用户补 review 结果，不直接修。
- 文本含 `Severity:`、`Critical`、`Important`、`Findings`、`File/Line` → **findings 文本模式**。
- 文本是自然语言问题清单 → **问题清单模式**，只处理能定位到文件/方法/行为的问题；证据不足的列为待确认。

告知用户："检测到入口模式：[模式名]，开始直接修复；不会提交代码，也不会执行数据库写操作。"

### Step 1：静默收集工作区证据

执行 VCS 与项目类型检测，结果用于保护本地改动和选择验证命令，不完整展示给用户：

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
    git -c "safe.directory=$vcs_root" -C "$vcs_root" status --short 2>/dev/null
    git -c "safe.directory=$vcs_root" -C "$vcs_root" diff --name-status 2>/dev/null
    ;;
  svn)
    echo "VCS_TYPE=svn"
    svn status "$vcs_root" 2>/dev/null
    svn diff --summarize "$vcs_root" 2>/dev/null
    ;;
  *) echo "VCS_TYPE=none" ;;
esac
find "$vcs_root" -maxdepth 3 \( -name pom.xml -o -name build.gradle -o -name package.json \) 2>/dev/null
```

判断规则：
- 先按目录结构识别 Git/SVN，不要用命令失败推断 VCS 类型。
- Git dubious ownership 时只在本次命令使用 `git -c "safe.directory=$vcs_root"`，不改全局配置。
- 修复前记录当前已改文件；不要回滚、覆盖或格式化与本次 finding 无关的本地改动。

### Step 2：归一化 findings

加载规则与输出模板：[reference.md](reference.md)

把输入整理成四类：
- `accepted`：有文件/方法/行为证据，能直接修复。
- `needs-confirmation`：涉及业务语义、状态流转、权限、接口契约、DB 结构、数据修复或用户口径冲突；先停下来问一个阻塞问题。
- `rejected`：误报、无证据、超范围、纯风格偏好或与项目规范冲突。
- `deferred`：Minor 或低收益建议，除非修复不扩大范围，否则只记录不处理。

直接修复门槛：
- 必须能定位到文件、方法、接口、配置或数据路径。
- 必须有明确期望行为或可验证结果。
- 不得要求执行数据库写操作、DDL、数据修复 SQL。
- 不得要求重构无关模块或回滚用户已有改动。

### Step 3：制定最小修复计划

对每条 accepted finding 写内部修复计划：

| ID | 文件/方法 | 修复动作 | 影响范围 | 验证方式 |
|----|-----------|----------|----------|----------|

计划原则：
- 先 Critical，再 Important，再低风险 Minor。
- 优先复用当前文件附近的模式、工具类、异常处理、测试风格。
- 能补测试就补测试；测试成本明显过高时，在输出里说明未补原因和替代验证。
- 如果同一文件存在 unrelated dirty changes，读清楚后在其基础上最小修改；无法区分时只问一个确认问题。

### Step 4：执行修复

使用 Edit/Write 修改代码和必要测试：
- 只改 accepted findings 需要的文件和必要测试。
- 不做顺手重构、统一格式化或大范围命名调整。
- 不执行 `git add` / `svn add` / commit，除非用户明确要求；但要报告新增文件是否需要纳入 VCS。
- 如果修复需要 DDL、数据修复或业务语义确认，停止对应 finding，输出 DBA/确认建议，不猜着改。

### Step 5：运行验证

优先使用 findings、fix-handoff、dev-doc 或项目结构里的验证命令。

常见兜底：
```bash
mvn test
./gradlew test
npm test
```

多模块 Java 项目优先尝试模块级命令：
```bash
mvn -f <module-pom> test
mvn -pl <module> -am test
```

验证失败时：
- 如果失败与本次修复相关，继续修到通过。
- 如果失败明显来自既有环境/无关模块，记录命令、失败摘要和判断依据。
- 不要把未运行或失败的验证写成通过。

### Step 6：VCS 完整性复查

修复后再次查看：
- Git：`git status --short`、`git diff --name-status`
- SVN：`svn status`、`svn diff --summarize`

检查：
- 新增源码/测试/配置是否未跟踪。
- 是否误改了无关文件。
- 是否出现敏感信息、临时 patch、日志、凭证文件。

### Step 7：输出修复结果

按 [reference.md](reference.md#完成输出格式) 输出：
- 修复结论：`Fixed` / `PartiallyFixed` / `Blocked`。
- 每条 finding 的处理状态：fixed / deferred / rejected / blocked。
- 修改文件。
- 验证命令和结果。
- VCS 完整性提示。
- 是否建议二次 `review-check`。
- `【Skill 反馈给 Codex】` 反馈块。

## 禁止事项

- 不在没有 findings / 问题清单 / fix-handoff 的情况下凭空修复。
- 不执行数据库写入、DDL、数据修复 SQL。
- 不提交、不 staged、不 push，除非用户明确要求。
- 不回滚用户已有无关改动。
- 不把材料不足的问题标成 fixed。
- 不把 Rejected / Notes 当成必须修。

## 检查清单

- [ ] 已识别入口模式并读取 findings / fix-handoff / review-task。
- [ ] 已收集 VCS 状态和项目类型。
- [ ] 已把 findings 分为 accepted / needs-confirmation / rejected / deferred。
- [ ] 阻塞型业务/DB/API/权限问题没有猜着修。
- [ ] 已按最小范围修改代码和必要测试。
- [ ] 已运行针对性验证；无法验证时已说明原因。
- [ ] 已复查 Git/SVN 状态和新增文件跟踪情况。
- [ ] 已输出每条 finding 的处理结果和后续建议。

## 相关资源

- 输出模板与示例：[reference.md](reference.md)
- 只读审查：`review-check`
- Review 任务包与修复交接：`review-fix`
- 完整工作流：仓库 `docs/workflow-guide.md`
