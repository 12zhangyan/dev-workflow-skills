---
name: bug-fix
description: 记录和分析 Bug，生成诊断/修复边界文档并追加到 HTML 看板，沉淀现象、复现、根因证据和修复范围。由 yan-project-analysis 根入口的 incident mode 加载。
argument-hint: [bug 名称]
arguments: task
disable-model-invocation: true
allowed-tools: Write, Read, Edit, Bash, Glob, Grep, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# Bug 修复文档生成

## 任务定位

记录 Bug 现象、分析根因、制定修复方案，生成独立 Bug 修复文档（`docs/bugs/`）并追加到 HTML 看板。
与 `/yan-dev-doc` 的设计文档分开存放，聚焦「现象 → 根因 → 修复」。

## 执行流程

### 共享交互协议

先遵循 [../../../_shared/interaction-policy.md](../../../_shared/interaction-policy.md)：证据预填、按风险分级、一次只问一个阻塞问题；发现业务/修复口径冲突时显式记录，不用猜测静默折中。

非交互/无人值守运行中不等待提问：缺少任务入口、文件冲突或高风险口径时输出 `Blocked` 和最小补充项，不写 Bug 文档、看板或执行型修复 Todo。

同时遵循 [../../../_shared/workflow-gates.md](../../../_shared/workflow-gates.md)：本 skill 完成 Bug 场景的 Plan Gate；根因未证实时不得进入 Implementation Gate，修复验证后优先交给 `yan-code-review mode=package` / `yan-code-review mode=check` 闭环。

### Step 0：参数检查

- `$task` 为空 → 询问："这个 Bug 叫什么名字？用一句话描述（如 '用户登录500错误'）"
- 名称规范化：中文保留原样；英文转小写、空格转 `-`；`/ \ : * ? " < > |` 及多余空格替换为 `-`

### Step 1：静默收集上下文（不展示给用户）

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
    git -c "safe.directory=$vcs_root" -C "$vcs_root" status --short 2>/dev/null
    ;;
  svn)
    echo "VCS_TYPE=svn"
    svn info "$vcs_root" 2>/dev/null | grep -E "^(Relative URL|Revision):"
    ;;
  *) echo "VCS_TYPE=none" ;;
esac
find "$vcs_root" -maxdepth 3 \( -name pom.xml -o -name build.gradle -o -name package.json \) 2>/dev/null
```

判断规则：先按目录结构识别 Git/SVN，不要用"git 命令失败"推断为无 VCS。Git 出现 dubious ownership / safe.directory 报错时，只使用 `git -c "safe.directory=$vcs_root"` 做本次只读命令，不修改全局 git 配置。

### Step 2：收集 Bug 信息（先从证据预填）

**规则：先从用户描述、报错、堆栈、日志、当前分支/改动和源码搜索中预填。不要机械按信息槽位逐条追问；只有缺失信息会影响复现、严重度、定位方向或修复范围时才问。确需询问时每次只问一个，并说明为什么这个答案会影响判断。封闭选项的问题（严重度、Step 4 冲突处理）用 AskUserQuestion 工具提问；自由文本问题直接对话提问。**

具体槽位见 [reference.md](reference.md#step-2-信息槽位)，作为查漏表使用，不是必问清单。服务/模块归属优先从路径、包名、Controller、日志 logger、最近改动推断，只有无法判断且会影响看板归类或修复范围时再问。

足够定位后告知用户："信息足够，正在搜索相关代码；未确认项会集中标注。"

### Step 3：自动代码搜索（不问用户）

按 Step 1 检测到的项目类型选择搜索方式：

**Java 项目（pom.xml / build.gradle）：**

1. 识别堆栈中 `at com.xxx.ClassName.method` 格式的类名（取最靠近抛出点的 1-2 个）
2. 若无堆栈，改用用户描述中的接口 URL、页面/按钮名、字段名、错误码、异常提示、最近 diff 文件名做关键词搜索
3. 用 Grep 工具搜索：pattern: `class <ClassName>`、URL 片段、错误码或字段名，glob: `**/*.java`，output_mode: `files_with_matches`
4. 读取命中文件，定位堆栈 method、接口方法或相关分支

**JS/TS 项目（package.json）：**

1. JS 堆栈行一般直接含文件路径（如 `at fn (src/services/auth.ts:42:7)`）→ 直接 Read 该文件定位行号
2. 堆栈无路径时：用接口 URL、页面/按钮名、字段名、错误码、异常提示、函数名搜索，glob: `**/*.{js,ts,vue}`，output_mode: `files_with_matches`

定位结论（文件路径 + 方法名 + 初步判断）存为 `codeLocation` 文字摘要。

**跳过条件**：堆栈为空且关键词搜索也无结果 / 未检测到项目类型 / grep 无结果 → `codeLocation` 置空，继续，但在文档中写明已搜索的线索与未命中原因。

### Step 4：路径处理

```bash
d=$(date +%F) && mkdir -p "docs/bugs/$d" && echo "$d"
```

路径格式：`docs/bugs/<日期>/<任务名>.md`

冲突处理：先把候选路径赋给 `target`，再用 `test -e "$target"` / `test -r "$target"` 区分不存在、可读和 `EXISTS_UNREADABLE_OR_UNKNOWN`，不能把 Read 失败当作不存在。可读且已存在时，交互会话选 A 覆盖 / B 时间戳后缀 / C 版本号后缀 / D 取消 / E 追加更新；非交互运行标 blocker 并停止落盘。

### Step 5：生成文档

加载模板：[reference.md](reference.md#文档模板)
参考已填示例：[examples.md](examples.md)

**核心规则**：
- 只使用用户提供的信息和代码/日志证据；未确认的标 `待补充` 或明确写为"推断，待验证"，不能把猜测写成事实
- `代码定位` 用 Step 3 结论填入；跳过时写 `待分析`
- 根因无明确结论时可写"初步怀疑…（推断，待验证）"，但只能给诊断计划和补证据步骤，不生成可直接执行的修复 Todo
- **显式暴露业务/修复口径冲突**：如果用户描述的预期行为与现有状态机、权限、字典、接口契约或历史逻辑冲突，按共享协议单独写「疑似需求冲突/待确认」；列出证据、风险和建议先确认的问题，不要直接按猜测给修复方案
- 存在阻塞项或冲突未确认时，文档状态保持为"待确认"，看板可登记但 `fixPlan` 必须写成确认/诊断计划，不能写成确定修复方案
- 验证步骤必须具体可执行
- 修复方案必须包含"修复执行口径"：先确认、最小修复、禁止改动、完成判定；防止 AI 扩大修改范围

### Step 5.5：追加到 HTML 看板

看板为多文件结构（外壳 + `data/changes.js` 轻量目录 + `data/details/` 人类复盘详情），**skill 只通过 `board-add.js` 写数据**。

> **⚠️ 强制规则**：写 `data/changes.js` 一律走下方 ② 的 `board-add.js` 脚本（它内部只追加/就地更新、备份并做记录数回归校验，绝不整体覆盖），**不要用 Write 重写整个文件**。判断看板"是否存在"用下方的 `test -f`（确定性判断），不要凭 Read 工具的报错/记忆去猜——历史上误判"不存在"走 Write 模板分支造成过 21 条记录被整体覆盖成 4 条的事故。

**定位：看板条目不是 md 的摘录，而是一篇独立的、给人看的故障复盘。** md 写给 AI 执行修复，看板写给「没遇到这个 Bug 的同事」——业务人员要看懂影响、现象、验收方式，开发人员要看懂根因、修复边界、验证步骤。

**结构字段（照搬，不加工）：**

| JS 字段 | 来源 |
|---------|------|
| `kind` | 固定值 `"bug"` |
| `service` / `module` | Step 2 预填/确认的归属（`服务/模块` 前后半段） |
| `title` | `$task` |
| `date` | Step 4 日期 |
| `severity` | Step 2 预填/确认的严重度（P0/P1/P2/P3） |
| `status` | 固定值 `"未修复"` |
| `branch` | Step 1 Git 分支；SVN 可填 revision；无 VCS 填 `"-"` |
| `docPath` | 本次生成的 md 路径（`docs/bugs/<日期>/<任务名>.md`） |
| `reproSteps` | 复现步骤 → string[] |
| `expected` / `actual` | 预期行为 / 实际行为（各一句） |
| `verifySteps` | 面向同事的验收步骤 → string[]，描述可观察结果，不写命令 |

**叙述字段（不要从 md 截取片段，面向人类重新撰写；可用 `\n` 分段，看板按段落渲染）：**

| JS 字段 | 写什么 |
|---------|--------|
| `symptom` | 用户视角的完整现象：谁在什么操作下看到了什么，2–4 句。不要堆术语 |
| `trigger` | 什么条件必现、什么条件不出现，让别人能判断"我会不会也踩到" |
| `impact` | 波及哪些功能/用户/数据，有没有绕行方案，1 段 |
| `rootCause` | 像复盘一样讲：表象是什么 → 排查到哪里 → 真正的原因是什么、当初为什么会写错，1–2 段。无结论时写"初步怀疑…（推断，待验证）" |
| `fixPlan` | 怎么修、为什么这样修（有备选方案被放弃时说明原因）、会不会影响别处，1–2 段 |

**Agent 专属字段禁止写入看板 entry**：`stackTrace`、`codeLocation`、`changeList`、`todos`。原始堆栈、文件/方法/行号、修复动作、验证命令和执行 Todo 只写 Bug md；看板只解释现象、根因、修复边界与人能核对的结果。

**字符串转义**（否则看板 JS 语法错误）：字段值含双引号 → `\"`，含换行 → `\n`；entry 使用标准 JSON，不使用反引号。

创建、比较或升级看板外壳时，按需读取 [共享看板外壳引导](../../../_shared/board-shell-bootstrap.md)。其中每个命令块都会重新定位模板目录，不能依赖前一次 shell 调用留下的 `$src`。

**① 确保看板文件存在**（bash 确定性判断，不靠模型解读 Read 结果）：

```bash
test -f project-html/data/changes.js && echo EXISTS || echo MISSING
```

- **MISSING** →
  1. 若 `project-html/index.html` 已存在且内含 `const changes`（旧版单文件看板）→ 先把其中的 `changes` / `htmlChangelog` 数组原样迁移到新建的 `data/changes.js`（带标记行）。
  2. 否则执行共享引导的「定位并复制或升级外壳」——其中 `test -f ... || cp` 会补上一份**空的** `data/changes.js` 模板。两种情况这一步都不写数据，交给下方 ② 统一写入（首次创建同样要进入 ③ 构建）。
  3. **检测 VCS**（仅本次新建时提示一次，不代为执行）：`if [ -d .svn ]; then echo "💡 建议: svn add project-html --depth=infinity"; elif [ -d .git ]; then echo "💡 建议: git add project-html"; fi`
- **EXISTS** → 执行共享引导的「只读比较版本」。输出 `BOARD_SHELL_UPGRADE_REQUIRED` 时再复制外壳（`data/` 不动）；升级到 v23+ 时运行 `node project-html/board-add.js --migrate` 拆分旧富记录，输出 `🔄 看板外壳与数据结构已升级到 v<N>`。输出 `BOARD_SHELL_CURRENT` 时直接进入 ②。

**② 用 board-add.js 写入 Bug 条目（确定性脚本，替代手工 Edit）**

把本次提取的字段组成 entry 对象，连同变更日志描述写进临时 JSON，交给脚本一次性写入。**备份、按 `docPath` 查重、转义、记录数回归全在脚本里完成**，AI 不再手改 `data/changes.js`，从根上杜绝「误判看板不存在 → 整体覆盖」事故：

```bash
cat > project-html/data/_entry.json <<'JSON'
{ "changelog": "新增 Bug：<title>",
  "entry": { "kind":"bug", "service":"<service>", "module":"<module>", "title":"<title>",
    "date":"<date>", "severity":"<severity>", "status":"未修复", "branch":"<branch>", "docPath":"<docPath>",
    "symptom":"<symptom>", "trigger":"<trigger>", "impact":"<impact>",
    "rootCause":"<rootCause>", "fixPlan":"<fixPlan>",
    "reproSteps":[<reproSteps>], "expected":"<expected>", "actual":"<actual>", "verifySteps":[<verifySteps>],
    "assumptions":[<assumptions>], "conflicts":[<conflicts>], "blockers":[<blockers>], "openQuestions":[<openQuestions>] } }
JSON
node project-html/board-add.js project-html/data/_entry.json && rm -f project-html/data/_entry.json
```

- **标准 JSON**：字符串值用双引号、内部换行写成 `\n`，**不要用反引号**；非空字段才写，空数组可省略。字段含义见上方表格与 [reference.md](reference.md#html-追加格式)。
- **查重自动处理**：脚本按 `docPath` 命中既有条目时就地更新并**保留原 status**，否则追加。Step 4 冲突选 A/E 时无需特殊操作，只把 `changelog` 改成 `更新 Bug：<title>`。
- **结果与回滚**：脚本打印 `✓ 看板已追加/更新…（记录数 X → Y）`；校验失败（语法错误或记录数下降）会放弃写入并保持原文件不动，按提示排查后重试，不要手改文件。
- **`node` 不存在** → 降级手工：用 Edit 在 `// ─── 在此行上方追加新记录 ───` 上方插入同一 bug 对象（注意 JS 转义：双引号 `\"`、换行 `\n`），并在 `// ─── 在此行上方追加变更日志 ───` 上方插入 `{ date: "<date>", desc: "新增 Bug：<title>" }`，提示用户手动打开看板确认。

**③ 生成轻量详情页 + 文档总索引（构建）**：写入成功后运行 `node project-html/build.js`，增量维护共享资源详情页 `project-html/pages/<slug>.html`、重新生成 `docs/INDEX.md` 文档总索引，并在首次运行时把项目根散落的旧 md/看板/接口文档复制归档到 `docs/archive/`（不删原件）。需要单文件外发时再运行 `node project-html/build.js --standalone "<docPath 或 slug>"` 生成 `project-html/exports/<slug>.html`。`node` 不存在 → 跳过。

输出：`🐛 Bug 已追加到 HTML 看板：project-html/data/changes.js + project-html/data/details/（浏览器打开 project-html/index.html 查看）`
`📑 已生成轻量详情页 pages/ 与文档总索引 docs/INDEX.md`

### Step 6：输出 Next Steps

模板见 [reference.md](reference.md#完成后输出格式)

完成输出必须包含 reference.md 里的 `【Workflow Brief】` 块（PlanGate 阶段），供下一位 AI 先读索引再按 tokenHint 读取源文档和相关源码，不必粘贴 Bug 文档全文。

## 规则

- **不污染主对话**：Step 1、Step 3 命令输出不展示
- **不编造根因**：无明确代码问题时写 `待分析`，并输出诊断计划，不输出确定修复 Todo
- **搜索失败静默跳过**：无 Java 源码或 grep 无结果 → 跳过 Step 3

## 检查清单（生成前确认）

- [ ] `$task` 已确认（不为空）
- [ ] 信息槽位已用于查漏；复现、严重度、定位方向和修复范围的阻塞项已确认或已列为 blocker
- [ ] Step 3 代码搜索已执行（或已标记跳过）
- [ ] 文件路径冲突已处理
- [ ] 验证步骤具体可执行（至少 1 条）
- [ ] 修复执行口径已写清先确认、最小修复、禁止改动、完成判定；根因未证实时只给诊断计划
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`（Step 5.5 ②）
- [ ] 完成输出已包含 `【Workflow Brief】` 块（Step 6）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 根因分析为空 | 堆栈不完整或无 src 目录 | Step 3 标记跳过，根因写"待分析" |
| 看板写入后打不开 | 手工降级时字段含未转义的反引号/双引号/换行 | 优先走 `board-add.js`（自动转义）；确需手工时改完必做 `node --check` |
| 找不到看板模板 | yan-dev-doc 未安装（模板在 `../../../yan-dev-doc/assets/board/`） | 先运行 install 脚本确保 yan-dev-doc 已安装 |
| 旧版单文件看板（数据内联在 index.html） | 看板是旧版结构 | Step 5.5 MISSING 分支自动迁移：数组搬入 `data/changes.js` 后覆盖外壳 |
| 同一 Bug 重复运行产生重复条目 | 冲突选 A/E 后仍追加 | `board-add.js` 按 `docPath` 查重，命中即就地更新（保留原 status） |
| `board-add.js` 报"记录数下降，已放弃写入" | 输入 entry 异常或现有文件已损坏 | 原文件未被改动，按提示排查输入 JSON / 现有 `data/changes.js` 后重试 |
| `build.js` 中止并提示"疑似数据被误覆盖" | `pages/` 现存单页数远多于 `data/changes.js` 当前记录数 | 先排查 `data/changes.js` 是否被误写小了（看 `.bak`），确认是有意删条目再设 `BOARD_FORCE_BUILD=1` 重跑 |
