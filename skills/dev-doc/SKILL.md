---
name: dev-doc
description: 当开始编码前需要把需求落成可执行文档时使用——需求还是口头想法、AI 可能走错方向、或任务范围不清晰时。Codex 中用户可说"使用 dev-doc skill 生成开发文档"；Claude Code 可兼容 /dev-doc。
argument-hint: [任务名称]
arguments: task
disable-model-invocation: true
allowed-tools: Write, Read, Edit, Bash, Glob, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# 开发文档生成（开发工作流 - Step 1）

## 任务定位

本 Skill 是开发工作流的第一步：把需求落成文档，驱动后续编码、自测、Code Review、上线。

**一次运行产出两份各有分工的文档：**
- **md 文件 = AI 执行文档**：精确的文件路径、变更清单、约束条件、可执行 Todo，写给 Claude/Cursor 照着干活
- **看板条目 = 人类阅读文档**：面向没参与本次开发的同事独立撰写的技术说明，不看 md、不看代码也能看懂这次改了什么、为什么改

md 文档必须**可执行**——结尾给出明确的下一步 Todo 清单。

## 执行流程

### 共享交互协议

先执行 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)：证据预填 → 风险分级 → 单点确认 → 冲突显式记录。信息槽位只用于查漏，不是逐条问卷。

### Step 0：参数检查

- `$task` 为空 → 询问用户："这次要做什么任务？用一句话描述（如 '用户登录优化'）"
- 任务名规范化：
  - 英文：转小写 + 空格转 `-`（`user login` → `user-login`）
  - 中文：保留原样（`用户登录优化`）
  - 文件名清洗：`/ \ : * ? " < > |` 及多余空格统一替换为 `-`（`用户 Login/优化` → `用户-Login-优化`）

### Step 1：静默收集环境上下文（不打扰用户）

执行以下命令，结果**用作引导提问和 Step 6 输出填充**，不展示给用户：

```bash
# VCS 类型检测（记住 VCS_TYPE=git/svn/none，用于 Step 6 填入代码审查命令）
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
    git -c "safe.directory=$vcs_root" -C "$vcs_root" log --oneline -3 2>/dev/null
    ;;
  svn)
    echo "VCS_TYPE=svn"
    svn info "$vcs_root" 2>/dev/null | grep -E "^(Relative URL|Revision):"
    svn log "$vcs_root" -l 3 2>/dev/null
    ;;
  *) echo "VCS_TYPE=none" ;;
esac
# 项目类型检测（记住结果，用于 Step 6 填入验证命令；支持 monorepo 子目录）
find "$vcs_root" -maxdepth 3 \( -name pom.xml -o -name build.gradle -o -name package.json \) 2>/dev/null
```

判断规则：先按目录结构识别 Git/SVN，不要用"git 命令失败"推断为无 VCS。Git 出现 dubious ownership / safe.directory 报错时，只使用 `git -c "safe.directory=$vcs_root"` 做本次只读命令，不修改全局 git 配置。

### Step 2：确认任务类型、复杂度和归属（少问、先判断）

**先从 `$task`、路径、已有代码、接口名、模块名、Step 1 上下文推断并预填。封闭选项只有在会影响文档结构或后续执行时才用 AskUserQuestion；自由文本问题只问阻塞项。**

任务类型可明显判断时直接记录并继续；不确定或会影响模板时再问（AskUserQuestion 单选）：

> 任务类型是？（新功能 / Bug 修复 / 重构 / 性能优化 / API 联调 / 配置变更）

若用户选"Bug 修复"且目的是记录现象、分析根因 → 提示："这类任务建议改用 `/bug-fix`（专门的 Bug 记录与根因分析流程，会登记到看板的 Bug 区）。继续用 dev-doc 吗？" 用户确认继续才往下走。

复杂度可按改动范围、模块数量、接口数量和代码证据判断时直接记录；只有复杂度会改变拆分策略、模型建议或验收范围时才确认。

> 复杂度我初步判断是「<建议值>」，对吗？（简单：改动一眼可见，约 ≤50 行 / 中等：50–500 行 / 复杂：>500 行、跨模块或方案不明确）

若用户选"复杂"，追加提示："建议执行阶段输入 `/model opus` 切换更强的模型。"

归属优先从当前目录、包名、Controller、模块名推断；无法确定时再问（Step 5.5 写看板时直接使用，避免收尾时再打断）：

> 这属于哪个微服务/模块？格式 `服务/模块`（如 `订单服务/支付`；单体项目填 `项目名/模块名`；不确定填 `通用/通用`）

### Step 3：按类型补齐需求（只问阻塞问题）

**规则：先把用户已说清楚的内容、代码里能确定的入口/字段/状态、现有文档里的约束填入草稿；不要机械按槽位逐条问。确需询问时每次只问一个，并说明为什么这个答案会影响方案。**

具体查漏槽位见 [reference.md](reference.md#step-3-查漏槽位)：简单任务最多补 2 个槽位；新功能 / Bug / 重构 / 性能 / API 联调 / 配置变更最多补 5 个槽位。可以 0 问，不要为了凑数量提问。

提问引导：利用 Step 1 拿到的 git 上下文和源码线索做引导式提问。
- 能从代码/文档确定 → 直接填入，并在文档中写来源或依据。
- 低风险未知（只影响描述文案、非核心命名）→ 明确写"暂按……假设"，继续生成。
- 高风险未知（状态流转、权限边界、数据归属、接口契约、DB 结构、回滚语义）→ 暂停并只问这一项。
- 用户答"不知道"/"待定" → 记为 `待补充`，但不要继续追问同类非阻塞细节。
必要信息足够后告知用户："信息足够，开始生成文档；未确认项会集中标注。"

### Step 4：路径处理（跨平台）

一条 bash 命令完成日期获取和目录创建：

```bash
d=$(date +%F) && mkdir -p "docs/$d" && echo "$d"
```

命令输出即为日期字符串（如 `2026-05-31`），拼接为最终路径 `docs/<日期>/<任务名>.md`。

**冲突处理**：用 Read 工具尝试读取目标文件：
- 读取成功 → 用 AskUserQuestion 询问：
  - `A` 覆盖（整个文件重写）
  - `B` 加时间戳后缀（`<任务名>-1530.md`）
  - `C` 加版本号后缀（`<任务名>-v2.md`）
  - `D` 取消
  - `E` 追加更新（保留现有内容，在文档末尾追加「变更记录」段落）
- 读取失败 → 直接生成

### Step 5：生成文档

加载完整模板：[reference.md](reference.md#文档模板)
参考已填示例：[examples.md](examples.md)

**核心规则**：
- 只使用用户提供的信息和代码/文档证据；未确认的标 `待补充` 或明确假设，不能把猜测写成事实
- **显式暴露需求冲突**：如果用户需求与现有代码路径、状态机、字典值、权限模型、数据归属或表复用方式冲突，按共享协议的冲突记录模板写入「判断依据与待确认」；不要静默折中
- **停止规则**：存在阻塞型 `blockers` 或 `conflicts` 时，只生成待确认文档，不生成可直接粘贴执行的编码提示
- **开闭原则贯穿全文档**：方案优先扩展，必须修改的要在"最小影响分析"说明原因
- **AI 执行口径必须写实**：在技术方案里明确前置条件、执行顺序、验收标准、禁止改动；不要只写"按方案实现"
- **不相关章节直接删除**：纯后端任务不留前端章节，简单 Bug 不写复杂流程图
- **接口文档仅在接口有变动时生成**：仅当本次新增接口、或修改既有接口的参数/返回结构时，才保留「三、API 设计」与「十三、Apifox 接口规范」；只是调用已有接口且签名无变化 → 两节都删除，看板 `apis` 填 `[]`
- **Apifox 章节**：满足上一条时，生成「十三、Apifox 接口规范」章节，内容为可直接导入 Apifox 的 OpenAPI 3.0 YAML；根据用户提供的接口信息填入 `paths`，未确认字段用 `# 待补充` 注释标记

### Step 5.5：同步更新 HTML 看板

看板为多文件结构，**skill 只追加数据文件，不碰外壳/样式/逻辑**。

> **⚠️ 强制规则**：修改 `data/changes.js` 只能用 Edit 在标记行追加/更新既有条目，**禁止用 Write 整体重写**。判断看板"是否存在"必须用下方的 `test -f`（确定性判断），不要凭 Read 工具的报错/记忆去猜——上下文压缩后误判"不存在"走到 Write 模板分支，是已发生过的真实事故（21 条记录被整体覆盖成 4 条）。

```
project-html/
  index.html        ← 外壳（加载 css/js/data）
  css/board.css     ← 样式
  js/board.js       ← 渲染逻辑（服务→模块两级树 / 浏览索引 / 接口索引 / Bug 视图）
  data/changes.js   ← 数据（唯一需要追加的文件）
```

**定位：看板条目不是 md 的摘录，而是一篇独立的、给人看的技术说明。** md 写给 AI 执行（精确路径、指令式），看板写给「没参与本次开发的同事」阅读——Reviewer、接手的人、三个月后的自己。

字段分两类：

**结构字段（照搬，不加工）：**

| JS 字段 | 来源 |
|---------|------|
| `service` / `module` | Step 2 确认的归属（`服务/模块` 前后半段） |
| `title` | `$task`（任务名） |
| `date` | Step 4 获取的日期 |
| `type` / `complexity` | Step 2 确认值 |
| `status` | 固定值 `草稿` |
| `branch` | Step 1 检测到的 Git branch 名 |
| `docPath` | 本次生成的 md 路径（看板用它链接源文档） |
| `goals` | md `### 目标` 的条目 → string[] |
| `scopeIn` / `scopeOut` | md 范围条目 → string[] |
| `flowchart` | md 流程图的 mermaid 代码（不含 ` ``` ` 标记） |
| `apis` | md `## 三、API 设计` 表格 → `{method, url, desc}[]`；**仅登记新增或参数有变动的接口**，无接口变更填 `[]` |
| `todos` | md `## 十一、实现 Todo` 条目 → string[] |

**叙述字段（不要从 md 截取片段，基于已收集的信息面向人类重新撰写）：**

写作要求：完整句子、讲清楚"为什么"、不留模板腔、不写"详见 md"。可用 `\n` 分段，看板按段落渲染。必须同时照顾两类读者：业务人员读完能知道影响、目标、验收口径；开发人员读完能知道方案、改动边界、下一步动作。检验标准：一个不了解这个任务的同事读完，能在站会上转述这次改动。

| JS 字段 | 写什么 |
|---------|--------|
| `background` | 为什么做这件事：业务痛点 + 触发契机，3–5 句。不要复述任务名 |
| `solution` | 用大白话讲整体怎么实现的：数据怎么流、新增了什么、动了什么，1–2 段 |
| `coreDesign` | 关键技术取舍：选了什么方案、放弃了什么备选、为什么，1–2 段；没有真正的取舍就省略此字段 |
| `keyImpl` | 3–6 条决策点 → `{title: 决策名, desc: 问题→做法→原因，2–3 句}`；不是代码清单的复读 |
| `changeList` | `file` / `action` 照搬 md；`desc` 重写成人话：这个文件在整个方案里承担什么角色 |

**字符串转义**（否则看板 JS 语法错误，整页打不开）：
- 字段值含双引号 → 转义为 `\"`；含换行 → 合并为一段或用 `\n`
- `flowchart` 用反引号模板字面量包裹；内容本身含反引号时改用双引号 + `\n` 转义

**外壳复制命令**（创建和升级共用；外壳含 ~3MB 的 `js/vendor/mermaid.min.js`，**禁止用 Read+Write 复制外壳**，必须用 bash cp）：

```bash
src=""
for candidate in \
  "$HOME/.codex/skills/dev-doc/assets/board" \
  "$HOME/.claude/skills/dev-doc/assets/board" \
  "$HOME/.cursor/skills/dev-doc/assets/board" \
  "$HOME/.agents/skills/dev-doc/assets/board"
do
  if [ -d "$candidate" ]; then src="$candidate"; break; fi
done
[ -n "$src" ] || { echo "BOARD_TEMPLATE_MISSING: dev-doc/assets/board not found"; exit 1; }
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

> cp 失败（skill 不在默认安装路径）→ 降级：Read+Write 文本外壳文件（index.html/css/js/build.js/board-add.js），跳过 vendor（看板自动走 mermaid CDN 兜底）。

**判断看板是否存在**（bash 确定性判断，不靠模型解读 Read 结果）：

```bash
test -f project-html/data/changes.js && echo EXISTS || echo MISSING
```

- **MISSING** →
  1. 若 `project-html/index.html` 已存在且内含 `const changes`（旧版单文件看板）→ 先把其中的 `changes` / `htmlChangelog` 两个数组原样迁移到新建的 `data/changes.js`（带标记行）。
  2. 否则执行上方「外壳复制命令」——其中 `test -f ... || cp` 会补上一份**空的** `data/changes.js` 模板。两种情况这一步都不写数据，交给下方 ② 的 `board-add.js` 统一写入（首次创建同样要进入 Step 5.6 构建）。
  3. **检测 VCS**（仅本次新建时提示一次，不代为执行）：
     ```bash
     if [ -d .svn ]; then echo "💡 检测到 SVN 工作副本，建议执行: svn add project-html --depth=infinity，把看板数据纳入版本管理"; elif [ -d .git ]; then echo "💡 检测到 Git 仓库，建议把 project-html/ 加入版本管理: git add project-html"; fi
     ```
- **EXISTS** → 先做 **⓪ 外壳版本检查**：
  ```bash
  src=""
  for candidate in \
    "$HOME/.codex/skills/dev-doc/assets/board" \
    "$HOME/.claude/skills/dev-doc/assets/board" \
    "$HOME/.cursor/skills/dev-doc/assets/board" \
    "$HOME/.agents/skills/dev-doc/assets/board"
  do
    if [ -d "$candidate" ]; then src="$candidate"; break; fi
  done
  [ -n "$src" ] || { echo "BOARD_TEMPLATE_MISSING: dev-doc/assets/board not found"; exit 1; }
  grep -m1 "BOARD_VERSION" project-html/js/board.js
  grep -m1 "BOARD_VERSION" "$src/js/board.js"
  ```
  项目侧无 `BOARD_VERSION` 或数字小于模板 → 执行外壳复制命令（`data/` 不动），并输出一行：`🔄 看板外壳已升级到 v<N>`。然后进入 ②。

**② 用 board-add.js 写入条目（确定性脚本，替代手工 Edit）**

把本次提取的字段组成一个 entry 对象、连同变更日志描述写进一个临时 JSON 文件，交给脚本一次性写入。**备份、按 `docPath` 查重、转义、记录数回归校验全在脚本里完成**——AI 只负责产出结构化字段，不再手改 `data/changes.js`，从根上杜绝「误判看板不存在 → 整体覆盖」事故。

```bash
cat > project-html/data/_entry.json <<'JSON'
{
  "changelog": "新增文档：<title>",
  "entry": {
    "service": "<service>", "module": "<module>", "title": "<title>",
    "date": "<date>", "type": "<type>", "complexity": "<complexity>",
    "status": "草稿", "branch": "<branch>", "docPath": "<docPath>",
    "background": "<background>",
    "goals": [<goals>], "scopeIn": [<scopeIn>], "scopeOut": [<scopeOut>], "apis": [],
    "solution": "<solution>", "coreDesign": "<coreDesign>",
    "flowchart": "<flowchart>",
    "keyImpl": [<keyImpl>], "changeList": [<changeList>], "todos": [<todos>]
  }
}
JSON
node project-html/board-add.js project-html/data/_entry.json && rm -f project-html/data/_entry.json
```

写 entry 的规则：
- **标准 JSON**：字符串值用双引号，内部换行写成 `\n`，**不要用反引号**；`flowchart` 也是普通 JSON 字符串（用 `\n` 分行，不含 ` ``` ` 标记）。非空字段才写，空数组可省略。
- **查重自动处理**：脚本按 `docPath` 命中既有条目时**就地更新并保留原 status**，否则追加。Step 4 选了 A 覆盖 / E 追加更新时无需特殊操作，只把 `changelog` 文案改成 `更新文档：<title>` 即可。
- **结果与回滚**：脚本打印 `✓ 看板已追加/更新…（记录数 X → Y）`；若校验失败（语法错误或记录数下降）脚本会**放弃写入并保持原文件不动**，按提示排查后重试，不要去手改文件。
- **`node` 不存在** → 跳过脚本，降级手工：用 Edit 在 `// ─── 在此行上方追加新记录 ───` 上方插入同一个对象（注意 JS 转义：双引号 `\"`、换行 `\n`），并在 `// ─── 在此行上方追加变更日志 ───` 上方插入 `{ date: "<date>", desc: "新增文档：<title>" }`；改完提示用户手动打开看板确认页面正常。

输出一行提示：`📄 HTML 看板已更新：project-html/data/changes.js（浏览器打开 project-html/index.html 查看）`

### Step 5.6：生成单页 + 文档总索引（构建）

`data/changes.js` 通过 `node --check` 后，运行构建脚本（一条命令完成单页与索引）：

```bash
node project-html/build.js
```

它会：
1. 为**每条**记录生成自包含单文件 `project-html/pages/<slug>.html`（内联 CSS + 渲染逻辑 + 本地 mermaid，单个文件即可直接发给别人，无需整个文件夹）
2. 由 `data/changes.js` 重新生成 `docs/INDEX.md` 文档总索引（按服务/模块归类，含 md 源文档与单页链接）
3. **首次运行**（`docs/archive/` 不存在）扫描项目根目录，把散落的旧 md 文档、旧看板 HTML、接口文档**复制**（不删原件）到 `docs/archive/` 统一归档，并登记进 `INDEX.md`

- `node` 不存在 → 跳过本步，提示用户："未检测到 node，无法生成单页与索引，请安装 node 后运行 `node project-html/build.js`"
- 输出脚本回显（含生成数量），并提示：`📑 已生成单页 pages/ 与文档总索引 docs/INDEX.md`

### Step 6：输出 Next Steps

模板见 [reference.md](reference.md#完成后输出格式)。

核心要素：
1. 文件路径（可直接打开）
2. 关键决策 3 句话摘要
3. Claude/Cursor 执行提示（可直接粘贴给 AI）
4. 验证命令：用 Step 1 检测到的项目类型自动填入（`pom.xml` → `mvn test`，`build.gradle` → `./gradlew test`，`package.json` → `npm test`，未检测到则保留占位符）
5. 验证通过后 Todo：代码审查命令根据 Step 1 检测到的 VCS 类型填入：
   - Git → `/requesting-code-review`
   - SVN → `svn diff > /tmp/changes.patch`，然后让 Claude 读取该文件审查
   - 无 VCS → 保留占位符

## 规则

- **不污染主对话**：Step 1 的 git 检查结果不展示，仅作为内部上下文
- **不编造内容**：未确认的章节统一标 `待补充`
- **开闭原则优先**：方案设计偏向扩展新代码，而非修改现有
- **可执行导向**：文档不是终点，是驱动后续工作的起点

## 检查清单（生成文档前确认）

- [ ] $task 已解析（不为空）
- [ ] 任务类型和复杂度已判定；如影响执行策略，已向用户确认
- [ ] 信息槽位已用于查漏；阻塞项已确认，非阻塞未知已标注假设或 `待补充`
- [ ] 文件路径冲突已处理
- [ ] 不相关章节已删除（避免大量"待补充"）
- [ ] 最小影响分析已包含
- [ ] AI 执行口径已写清前置条件、执行顺序、验收标准、禁止改动
- [ ] 实现 Todo 均为"动词 + 对象 + 结果"，没有无法验收的泛化表述
- [ ] 代码评审关注点已填写
- [ ] Claude/Cursor 执行提示已生成
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`（Step 5.5 ②）
- [ ] 已运行 `node project-html/build.js` 生成单页 + 文档总索引（Step 5.6）

## 相关资源

- 完整文档模板与信息槽位：[reference.md](reference.md)
- 已填示例（新功能 / Bug 修复）：[examples.md](examples.md)
- 看板模板（外壳 + 样式 + 逻辑 + 数据占位）：[assets/board/](assets/board/)
- 中文文档规范：**必需背景：** `chinese-documentation` skill
- 后续步骤：`/requesting-code-review`（AI 代码审查）、`/code-reading`（生成代码地图）、`/chinese-code-review`（PR 评论话术）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 文档生成后 AI 执行走偏 | 「六、代码变更清单」写得不够具体 | 每个条目加上「为何不能用扩展替代」说明 |
| 问答时用户回答"待定"太多 | 需求本身还不成熟 | 先用 `/brainstorming` 理清需求再运行 dev-doc |
| 文档文件名冲突 | 同天同任务名重复运行 | 按提示选择 A/B/C/D/E 处理冲突 |
| Step 1 git 命令报 dubious ownership / safe.directory | 当前执行用户不是仓库拥有者 | 仍按 `.git` 判定为 Git；只在本次命令使用 `git -c "safe.directory=$vcs_root"`，不要改全局配置 |
| 看板写入后打不开 | 手工降级时字段含未转义的双引号/换行/反引号 | 优先走 `board-add.js`（自动转义）；确需手工时改完必做 `node --check` |
| 旧版单文件看板（数据内联在 index.html） | 看板是旧版结构 | Step 5.5 MISSING 分支自动迁移：数组搬入 `data/changes.js` 后覆盖外壳 |
| 同一任务重复运行产生重复看板条目 | 冲突选 A/E 后仍追加 | `board-add.js` 按 `docPath` 查重，命中即就地更新（保留原 status） |
| 外壳 cp 失败 | skill 不在 `~/.claude/skills/` 默认路径 | 降级 Read+Write 文本外壳（含 board-add.js），vendor 跳过走 CDN |
| `board-add.js` 报"记录数下降，已放弃写入" | 输入 entry 异常或现有文件已损坏 | 原文件未被改动，按提示排查输入 JSON / 现有 `data/changes.js` 后重试 |
| `build.js` 中止并提示"疑似数据被误覆盖" | `pages/` 现存单页数远多于 `data/changes.js` 当前记录数 | 先排查 `data/changes.js` 是否被误写小了（看 `.bak`），确认是有意删条目再设 `BOARD_FORCE_BUILD=1` 重跑 |
