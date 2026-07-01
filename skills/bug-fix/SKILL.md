---
name: bug-fix
description: 记录和分析 Bug，生成修复文档并追加到 HTML 看板——发现需要完整记录分析的 Bug 时使用。仅在用户显式 /bug-fix 时调用
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
与 `/dev-doc` 的设计文档分开存放，聚焦「现象 → 根因 → 修复」。

## 执行流程

### Step 0：参数检查

- `$task` 为空 → 询问："这个 Bug 叫什么名字？用一句话描述（如 '用户登录500错误'）"
- 名称规范化：中文保留原样；英文转小写、空格转 `-`；`/ \ : * ? " < > |` 及多余空格替换为 `-`

### Step 1：静默收集上下文（不展示给用户）

```bash
if git rev-parse --git-dir 2>/dev/null; then
  git branch --show-current 2>/dev/null
else
  echo "no-vcs"
fi
ls pom.xml build.gradle package.json 2>/dev/null
```

### Step 2：逐一收集 Bug 信息

**规则：每次只问一个问题，等回答后再问下一个。封闭选项的问题（Q2 严重度、Step 4 冲突处理）用 AskUserQuestion 工具提问；自由文本问题直接对话提问。**

具体问题集见 [reference.md](reference.md#step-2-问题集)，共 6 个问题（最后一问是微服务/模块归属，Step 5.5 写看板时直接使用，不再追问）。

全部完成后告知用户："信息收集完毕，正在搜索相关代码..."

### Step 3：自动代码搜索（不问用户）

按 Step 1 检测到的项目类型选择搜索方式：

**Java 项目（pom.xml / build.gradle）：**

1. 识别堆栈中 `at com.xxx.ClassName.method` 格式的类名（取最靠近抛出点的 1-2 个）
2. 用 Grep 工具搜索：pattern: `class <ClassName>`，glob: `**/*.java`，output_mode: `files_with_matches`
3. 读取命中文件，定位堆栈中 method 对应的方法体

**JS/TS 项目（package.json）：**

1. JS 堆栈行一般直接含文件路径（如 `at fn (src/services/auth.ts:42:7)`）→ 直接 Read 该文件定位行号
2. 堆栈无路径时：用 Grep 搜索函数名，glob: `**/*.{js,ts,vue}`，output_mode: `files_with_matches`

定位结论（文件路径 + 方法名 + 初步判断）存为 `codeLocation` 文字摘要。

**跳过条件**：堆栈为空 / 未检测到项目类型 / grep 无结果 → `codeLocation` 置空，继续

### Step 4：路径处理

```bash
d=$(date +%F) && mkdir -p "docs/bugs/$d" && echo "$d"
```

路径格式：`docs/bugs/<日期>/<任务名>.md`

冲突处理（Read 检查是否存在）：A 覆盖 / B 时间戳后缀 / C 版本号后缀 / D 取消 / E 追加更新

### Step 5：生成文档

加载模板：[reference.md](reference.md#文档模板)
参考已填示例：[examples.md](examples.md)

**核心规则**：
- 只使用用户提供的信息，未确认的标 `待补充`
- `代码定位` 用 Step 3 结论填入；跳过时写 `待分析`
- 根因无明确结论时可写"初步怀疑…（推断，待验证）"
- 验证步骤必须具体可执行
- 修复方案必须包含"修复执行口径"：先确认、最小修复、禁止改动、完成判定；防止 AI 扩大修改范围

### Step 5.5：追加到 HTML 看板

看板为多文件结构（外壳 `index.html` + `css/board.css` + `js/board.js` + 数据 `data/changes.js`），**skill 只追加数据文件**。

> **⚠️ 强制规则**：写 `data/changes.js` 一律走下方 ② 的 `board-add.js` 脚本（它内部只追加/就地更新、备份并做记录数回归校验，绝不整体覆盖），**不要用 Write 重写整个文件**。判断看板"是否存在"用下方的 `test -f`（确定性判断），不要凭 Read 工具的报错/记忆去猜——历史上误判"不存在"走 Write 模板分支造成过 21 条记录被整体覆盖成 4 条的事故。

**定位：看板条目不是 md 的摘录，而是一篇独立的、给人看的故障复盘。** md 写给 AI 执行修复，看板写给「没遇到这个 Bug 的同事」——让他读完能避开同类坑。

**结构字段（照搬，不加工）：**

| JS 字段 | 来源 |
|---------|------|
| `kind` | 固定值 `"bug"` |
| `service` / `module` | Step 2 Q6 的归属（`服务/模块` 前后半段） |
| `title` | `$task` |
| `date` | Step 4 日期 |
| `severity` | Step 2 Q2（P0/P1/P2/P3） |
| `status` | 固定值 `"未修复"` |
| `branch` | Step 1 Git 分支（无 VCS 填 `"-"`） |
| `docPath` | 本次生成的 md 路径（`docs/bugs/<日期>/<任务名>.md`） |
| `stackTrace` | 异常堆栈原文（原样保留） |
| `reproSteps` | 复现步骤 → string[] |
| `expected` / `actual` | 预期行为 / 实际行为（各一句） |
| `codeLocation` | Step 3 定位摘要（文件 + 方法 + 行号） |
| `changeList` | `file` / `action` 照搬 md |
| `verifySteps` / `todos` | md 对应列表 → string[] |

**叙述字段（不要从 md 截取片段，面向人类重新撰写；可用 `\n` 分段，看板按段落渲染）：**

| JS 字段 | 写什么 |
|---------|--------|
| `symptom` | 用户视角的完整现象：谁在什么操作下看到了什么，2–4 句。不要堆术语 |
| `trigger` | 什么条件必现、什么条件不出现，让别人能判断"我会不会也踩到" |
| `impact` | 波及哪些功能/用户/数据，有没有绕行方案，1 段 |
| `rootCause` | 像复盘一样讲：表象是什么 → 排查到哪里 → 真正的原因是什么、当初为什么会写错，1–2 段。无结论时写"初步怀疑…（推断，待验证）" |
| `fixPlan` | 怎么修、为什么这样修（有备选方案被放弃时说明原因）、会不会影响别处，1–2 段 |
| `changeList.desc` | 用人话说明该文件在修复中承担的角色 |

**字符串转义**（否则看板 JS 语法错误）：字段值含双引号 → `\"`，含换行 → `\n`；`stackTrace` 用反引号模板字面量，内容含反引号时改用双引号 + `\n` 转义。

**外壳复制命令**（创建和升级共用；外壳含 ~3MB 的 `js/vendor/mermaid.min.js`，**禁止用 Read+Write 复制外壳**，必须用 bash cp；模板在 dev-doc 的资产目录）：

```bash
src="$HOME/.claude/skills/dev-doc/assets/board"
mkdir -p project-html/css project-html/js/vendor project-html/data
cp "$src/index.html" project-html/index.html
cp "$src/css/board.css" project-html/css/board.css
cp "$src/js/board.js" project-html/js/board.js
cp "$src/js/vendor/mermaid.min.js" project-html/js/vendor/mermaid.min.js
cp "$src/build.js" project-html/build.js
cp "$src/board-add.js" project-html/board-add.js
# 仅 MISSING 时补一份空数据模板；EXISTS 时绝不覆盖 data/
test -f project-html/data/changes.js || cp "$src/data/changes.js" project-html/data/changes.js
```

> cp 失败（skill 不在默认安装路径）→ 降级：从 [../dev-doc/assets/board/](../dev-doc/assets/board/) Read+Write 文本外壳文件（index.html/css/js/build.js/board-add.js），跳过 vendor（看板自动走 mermaid CDN 兜底）。

**① 确保看板文件存在**（bash 确定性判断，不靠模型解读 Read 结果）：

```bash
test -f project-html/data/changes.js && echo EXISTS || echo MISSING
```

- **MISSING** →
  1. 若 `project-html/index.html` 已存在且内含 `const changes`（旧版单文件看板）→ 先把其中的 `changes` / `htmlChangelog` 数组原样迁移到新建的 `data/changes.js`（带标记行）。
  2. 否则执行上方「外壳复制命令」——其中 `test -f ... || cp` 会补上一份**空的** `data/changes.js` 模板。两种情况这一步都不写数据，交给下方 ② 统一写入（首次创建同样要进入 ③ 构建）。
  3. **检测 VCS**（仅本次新建时提示一次，不代为执行）：`if [ -d .svn ]; then echo "💡 建议: svn add project-html --depth=infinity"; elif [ -d .git ]; then echo "💡 建议: git add project-html"; fi`
- **EXISTS** → 先做 **外壳版本检查**：`grep -m1 "BOARD_VERSION" project-html/js/board.js` 与 `grep -m1 "BOARD_VERSION" "$src/js/board.js"` 比较；项目侧缺失或小于模板 → 执行外壳复制命令（`data/` 不动），输出 `🔄 看板外壳已升级到 v<N>`。

**② 用 board-add.js 写入 Bug 条目（确定性脚本，替代手工 Edit）**

把本次提取的字段组成 entry 对象，连同变更日志描述写进临时 JSON，交给脚本一次性写入。**备份、按 `docPath` 查重、转义、记录数回归全在脚本里完成**，AI 不再手改 `data/changes.js`，从根上杜绝「误判看板不存在 → 整体覆盖」事故：

```bash
cat > project-html/data/_entry.json <<'JSON'
{ "changelog": "新增 Bug：<title>",
  "entry": { "kind":"bug", "service":"<service>", "module":"<module>", "title":"<title>",
    "date":"<date>", "severity":"<severity>", "status":"未修复", "branch":"<branch>", "docPath":"<docPath>",
    "symptom":"<symptom>", "stackTrace":"<stackTrace>", "trigger":"<trigger>", "impact":"<impact>",
    "rootCause":"<rootCause>", "codeLocation":"<codeLocation>", "fixPlan":"<fixPlan>",
    "reproSteps":[<reproSteps>], "changeList":[<changeList>], "verifySteps":[<verifySteps>], "todos":[<todos>] } }
JSON
node project-html/board-add.js project-html/data/_entry.json && rm -f project-html/data/_entry.json
```

- **标准 JSON**：字符串值用双引号、内部换行写成 `\n`，**不要用反引号**（`stackTrace` 也写成带 `\n` 的普通字符串）；非空字段才写，空数组可省略。字段含义见上方表格与 [reference.md](reference.md#html-追加格式)。
- **查重自动处理**：脚本按 `docPath` 命中既有条目时就地更新并**保留原 status**，否则追加。Step 4 冲突选 A/E 时无需特殊操作，只把 `changelog` 改成 `更新 Bug：<title>`。
- **结果与回滚**：脚本打印 `✓ 看板已追加/更新…（记录数 X → Y）`；校验失败（语法错误或记录数下降）会放弃写入并保持原文件不动，按提示排查后重试，不要手改文件。
- **`node` 不存在** → 降级手工：用 Edit 在 `// ─── 在此行上方追加新记录 ───` 上方插入同一 bug 对象（注意 JS 转义：双引号 `\"`、换行 `\n`），并在 `// ─── 在此行上方追加变更日志 ───` 上方插入 `{ date: "<date>", desc: "新增 Bug：<title>" }`，提示用户手动打开看板确认。

**③ 生成单页 + 文档总索引（构建）**：写入成功后运行 `node project-html/build.js`，为每条记录生成自包含单页 `project-html/pages/<slug>.html`（可单独发人）、重新生成 `docs/INDEX.md` 文档总索引，并在首次运行时把项目根散落的旧 md/看板/接口文档复制归档到 `docs/archive/`（不删原件）。`node` 不存在 → 跳过。

输出：`🐛 Bug 已追加到 HTML 看板：project-html/data/changes.js（浏览器打开 project-html/index.html 查看）`
`📑 已生成单页 pages/ 与文档总索引 docs/INDEX.md`

### Step 6：输出 Next Steps

模板见 [reference.md](reference.md#完成后输出格式)

## 规则

- **不污染主对话**：Step 1、Step 3 命令输出不展示
- **不编造根因**：无明确代码问题时写 `待分析`
- **搜索失败静默跳过**：无 Java 源码或 grep 无结果 → 跳过 Step 3

## 检查清单（生成前确认）

- [ ] `$task` 已确认（不为空）
- [ ] Step 2 的 6 个问题全部问完
- [ ] Step 3 代码搜索已执行（或已标记跳过）
- [ ] 文件路径冲突已处理
- [ ] 验证步骤具体可执行（至少 1 条）
- [ ] 修复执行口径已写清先确认、最小修复、禁止改动、完成判定
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`（Step 5.5 ②）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 根因分析为空 | 堆栈不完整或无 src 目录 | Step 3 标记跳过，根因写"待分析" |
| 看板写入后打不开 | 手工降级时字段含未转义的反引号/双引号/换行 | 优先走 `board-add.js`（自动转义）；确需手工时改完必做 `node --check` |
| 找不到看板模板 | dev-doc 未安装（模板在 `../dev-doc/assets/board/`） | 先运行 install 脚本确保 dev-doc 已安装 |
| 旧版单文件看板（数据内联在 index.html） | 看板是旧版结构 | Step 5.5 MISSING 分支自动迁移：数组搬入 `data/changes.js` 后覆盖外壳 |
| 同一 Bug 重复运行产生重复条目 | 冲突选 A/E 后仍追加 | `board-add.js` 按 `docPath` 查重，命中即就地更新（保留原 status） |
| `board-add.js` 报"记录数下降，已放弃写入" | 输入 entry 异常或现有文件已损坏 | 原文件未被改动，按提示排查输入 JSON / 现有 `data/changes.js` 后重试 |
| `build.js` 中止并提示"疑似数据被误覆盖" | `pages/` 现存单页数远多于 `data/changes.js` 当前记录数 | 先排查 `data/changes.js` 是否被误写小了（看 `.bak`），确认是有意删条目再设 `BOARD_FORCE_BUILD=1` 重跑 |
