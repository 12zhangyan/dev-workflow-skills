---
name: biz-flow
description: 把一组接口/功能捋成面向测试人员的业务逻辑方案——给出角色入口、上下文前置条件、业务流转图、数据流图、时序图、状态机、阶段数据变动、校验规则与测试关注点。当需要让测试/产品看懂一条业务怎么走、数据怎么流、状态和表字段怎么变时使用，尤其适合 App+PC、审批/审核、扫码/回调、多表状态流转类功能。Codex 中用户可说"使用 biz-flow skill 生成业务流方案"；Claude Code 可兼容 /biz-flow。
argument-hint: [业务/功能名称]
arguments: feature
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# 业务逻辑梳理（面向测试的业务流方案）

## 任务定位

输入一组相关接口（或功能描述、Controller 入口），输出一份**面向测试人员**的业务逻辑技术方案：角色入口 + 上下文/前置条件 + 业务流转图 + 数据流图 + 时序图 + 状态机 + 阶段数据变动 + 校验规则 + 测试关注点。
**目标读者是测试/产品，不是开发**——讲清楚「这条业务整体怎么走、数据从哪来到哪去、什么条件走什么分支、哪里最该测」，少堆代码术语。

产出：`docs/biz-flow/<日期>/<业务名>.md`，并以 `kind:"biz"` 登记到 HTML 看板（🔀 业务流）。

与相邻 skill 的分工：`/code-reading` 是给开发看的代码地图（调用链 + 代码位置）；`/biz-flow` 是给测试看的业务地图（业务流转 + 数据流 + 规则）。

## 执行流程

### 共享交互协议

先遵循 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)：从代码、接口、菜单、文档和现有看板预填；只在业务语义、权限、状态、数据归属或闭环范围会受影响时提一个阻塞问题；冲突和材料不足必须显式记录。

非交互/无人值守运行中不等待提问：缺少业务入口、闭环证据或文件冲突时输出 `Blocked` 和最小补充项，不写业务流文档、看板或确定性测试口径。

同时遵循 [../_shared/workflow-gates.md](../_shared/workflow-gates.md)：本 skill 主要完成面向测试/产品的 Plan Gate；如果梳理中发现实现偏差或业务冲突，下一步应分流到 `dev-doc` 形成开发方案，或交给 `review-fix` 形成审查任务。

### Step 0：参数检查

- `$feature` 为空 → 询问："这条业务/功能叫什么？用一句话描述（如 '订单超时自动取消'）"
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

### Step 2：收集接口与业务信息（少问，先从入口追）

具体槽位见 [reference.md](reference.md#step-2-信息槽位)，作为查漏表使用，不是必问清单。**核心是确定业务闭环入口**：可来自 URL + 方法、Controller 类名/方法、Swagger / Apifox、菜单/按钮名、定时任务、MQ listener、回调入口或现有文档。用户只给功能名时，先用功能名、页面/菜单名、状态/字段名搜索代码和文档；仍找不到入口或闭环不成立时，才问用户补一个最小入口。

询问策略：
- 能从接口、Controller、Service、Mapper、字典、菜单、任务、MQ listener、已有文档确定 → 直接填入，并在文档里体现依据。
- 低风险未知（模块归属、展示文案、非核心命名）→ 明确假设后继续。
- 高风险未知（业务状态语义、审批通过/驳回行为、权限范围、数据归属、接口先后依赖、是否复用既有表）→ 暂停并只问一个聚焦问题。
- 多入口业务必须给出已覆盖、缺失、排除的入口清单；缺失入口会影响状态/数据闭环时停止生成正式方案，只输出草稿和 blocker。
- 用户答"不知道"/"待定" → 记 `待补充`，不要继续追问同类非阻塞细节。
信息足够后告知："信息足够，正在分析业务流；未确认项会集中标注。"

### Step 3：代码追踪补全（静默，按需）

若用户给了接口/类名且项目有源码，按项目类型补全业务细节（不展示中间过程）：

**Java（pom.xml / build.gradle）：**
1. 用 Grep 定位每个接口的 Controller 方法（pattern: URL 片段或方法名，glob: `**/*.java`）
2. 顺着 Controller / Job / Listener / 回调 → Service → Mapper/Repository 追到数据或状态落点，默认 2–3 层；若还未找到状态/数据闭环，继续追踪 MQ、监听器、回调、定时任务或外部服务入口，直到能说明"最终落到哪里"或标记为缺失入口
   - **角色/入口**：谁在 App/PC/后台任务/第三方回调触发，入口接口或操作按钮是什么
   - **上下文/前置条件**：登录上下文、租户/公司/仓库/部门、权限、缓存、配置、字典值从哪来
   - **数据流**：入参从哪来、查/写了哪些表或外部服务、返回什么
   - **阶段数据变动**：每个关键阶段 INSERT / UPDATE / SELECT 了哪些表或对象，关键字段如何变化，测试怎么核对
   - **业务分支**：if/else、状态判断、枚举流转（`setStatus`、状态机）
   - **服务/接口交互**：Feign/RestTemplate/MQ 调用、监听器、任务、事务边界
3. 多个接口之间的先后/依赖关系（如「下单」→「支付回调」→「发货」）

**JS/TS（package.json）：** 顺着路由 → controller/service 读取，记录同类信息。

**跳过条件**：无源码 / 只能基于口头描述 → 输出"草稿"并标注证据等级；状态、权限、数据写入、接口先后依赖缺少证据时列入 blocker，不生成确定性测试口径。

### Step 4：路径处理

```bash
d=$(date +%F) && mkdir -p "docs/biz-flow/$d" && echo "$d"
```

路径格式：`docs/biz-flow/<日期>/<业务名>.md`

冲突处理：先把候选路径赋给 `target`，再用 `test -e "$target"` / `test -r "$target"` 区分不存在、可读和 `EXISTS_UNREADABLE_OR_UNKNOWN`，不能把 Read 失败当作不存在。可读且已存在时，交互会话选 A 覆盖 / B 时间戳后缀 / C 版本号后缀 / D 取消 / E 追加更新；非交互运行标 blocker 并停止落盘。

### Step 5：生成文档

加载模板：[reference.md](reference.md#文档模板)
参考已填示例：[examples.md](examples.md)

**核心规则**：
- 面向测试人员撰写：每个图配一段大白话说明「这张图在讲什么、测试该重点看哪里」
- 若业务像参考页那样存在角色入口、登录上下文、审批/驳回、扫码解析、多表状态流转，必须拆成「角色与入口 / 上下文与前置条件 / 状态流转 / 阶段数据变动 / 校验规则 / 涉及数据对象」几块，测试拿到后能直接按阶段拆用例。
- **三张图按需画，画不出来的删掉**：
  - 业务流转图（`flowchart`）：业务状态/分支怎么流转——几乎必画
  - 数据流图（`flowchart`，节点用「数据/存储」）：数据从入口经过哪些服务/表，最终落到哪——涉及多表/多服务时画
  - 时序图（`sequenceDiagram`）：多个服务/接口之间的调用时序——跨服务或有回调时画
  - 状态机（`stateDiagram-v2`）：有明确状态字段流转时才画
- 只用确认的信息和代码/文档证据；未知标 `待补充` 或明确假设，不编造接口或字段
- **显式暴露业务逻辑冲突**：如果用户描述与现有代码、状态机、字典值、权限模型、数据归属、表复用或接口先后关系冲突，按共享协议单独写「业务逻辑冲突/待确认」；列出证据、风险、建议口径，不能为了成图把冲突悄悄抹平
- 有阻塞冲突、闭环入口缺失或关键证据不足时，文档状态写"草稿/待确认"，测试口径只给已证实部分，不把推断写成正式用例
- 业务规则写「触发条件 → 系统行为 → 边界」，测试关注点写「具体可验证的点」（含正常 + 异常 + 边界 + 并发）

### Step 5.5：登记到 HTML 看板（kind:"biz"）

**定位：看板条目面向人类阅读**——让没碰过这条业务的业务/测试/开发同事看完就懂整体怎么走。md 是完整方案，看板是浓缩的业务地图：业务人员看主线和规则，开发人员看接口、数据、联调点。

> **⚠️ 强制规则**：写 `data/changes.js` 一律走下方 ② 的 `board-add.js` 脚本（它内部只追加/就地更新、备份并做记录数回归校验，绝不整体覆盖），**不要用 Write 重写整个文件**。判断看板"是否存在"用下方的 `test -f`（确定性判断），不要凭 Read 工具的报错/记忆去猜——历史上误判"不存在"走 Write 模板分支造成过 21 条记录被整体覆盖成 4 条的事故。

**结构字段（照搬）：**

| JS 字段 | 来源 |
|---------|------|
| `kind` | 固定 `"biz"` |
| `service` / `module` | Step 2 的归属（`服务/模块` 前后半段） |
| `title` | `$feature` |
| `type` | 固定 `"业务流"` |
| `status` | 固定 `"已完成"` |
| `date` | Step 4 日期 |
| `branch` | Step 1 Git 分支；SVN 可填 revision；无 VCS 填 `"-"` |
| `docPath` | `docs/biz-flow/<日期>/<业务名>.md` |
| `apis` | 涉及接口 `{method,url,desc}[]` |
| `bizFlow` / `dataFlow` / `sequence` / `stateMachine` | 各图的 Mermaid 代码（不含 ` ``` ` 标记；没有的字段省略） |

**叙述字段（面向人类重新撰写，不截取 md；可用 `\n` 分段）：**

| JS 字段 | 写什么 |
|---------|--------|
| `background` | 业务概述：这条业务整体在做什么、从哪触发、最终达成什么，3–5 句，测试视角 |
| `roles` | 角色与入口 → `{name,channel,entry,desc}[]`；如 App 现场人员、PC 审核人员、定时任务、第三方回调 |
| `context` | 上下文与前置条件 → `{field,source,usage,note}[]`；如 token、当前仓库、部门、公司、字典、权限 |
| `dataChanges` | 阶段数据变动 → `{stage,trigger,summary,operations:[{target,action,fields,check}]}[]`；按申请/审核/驳回/回调等阶段写 |
| `bizRules` | 关键业务规则 → `{title:规则名, desc:触发条件→系统行为→边界，2–3 句}[]` |
| `validations` | 校验规则 → `{stage,rule,failure,check}[]`；失败行为和测试核对点要明确 |
| `testPoints` | 测试关注点 → string[]，每条是一个具体可验证的点（正常/异常/边界/并发） |
| `dataObjects` | 涉及数据对象 → `{name,phase,action,note}[]`；表、缓存、消息、外部服务均可登记 |
| `assumptions` / `conflicts` / `blockers` / `openQuestions` | 共享协议字段；记录低风险假设、冲突、阻塞项、非阻塞待确认 |

**字符串转义**（否则看板 JS 语法错误）：含双引号 → `\"`，含换行 → `\n`；Mermaid 字段用反引号模板字面量包裹，内容含反引号时改双引号 + `\n`。

**外壳复制命令**（创建和升级共用；外壳含 ~3MB 的 `js/vendor/mermaid.min.js`，**禁止用 Read+Write 复制外壳**，必须用 bash cp；模板在 dev-doc 的资产目录）：

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

> cp 失败（skill 不在默认安装路径）→ 降级：从 [../dev-doc/assets/board/](../dev-doc/assets/board/) Read+Write 文本外壳文件（index.html/css/js/build.js/board-add.js），跳过 vendor（看板自动走 mermaid CDN 兜底）。

**① 确保看板文件存在**（bash 确定性判断，不靠模型解读 Read 结果）：

```bash
test -f project-html/data/changes.js && echo EXISTS || echo MISSING
```

- **MISSING** →
  1. 若 `project-html/index.html` 已存在且内含 `const changes`（旧版单文件看板）→ 先把 `changes` / `htmlChangelog` 两个数组原样迁移到新建的 `data/changes.js`（带标记行）。
  2. 否则执行上方「外壳复制命令」——其中 `test -f ... || cp` 会补上一份**空的** `data/changes.js` 模板。两种情况这一步都不写数据，交给下方 ② 统一写入（首次创建同样要进入 ③ 构建）。
  3. **检测 VCS**（仅本次新建时提示一次，不代为执行）：`if [ -d .svn ]; then echo "💡 建议: svn add project-html --depth=infinity"; elif [ -d .git ]; then echo "💡 建议: git add project-html"; fi`
- **EXISTS** → 先做 **外壳版本检查**：`grep -m1 "BOARD_VERSION" project-html/js/board.js` 与 `grep -m1 "BOARD_VERSION" "$src/js/board.js"` 比较；项目侧缺失或小于模板 → 执行外壳复制命令（`data/` 不动），输出 `🔄 看板外壳已升级到 v<N>`。

**② 用 board-add.js 写入业务流条目（确定性脚本，替代手工 Edit）**

把本次提取的字段组成 entry 对象，连同变更日志描述写进临时 JSON，交给脚本一次性写入。**备份、按 `docPath` 查重、转义、记录数回归全在脚本里完成**，AI 不再手改 `data/changes.js`：

```bash
cat > project-html/data/_entry.json <<'JSON'
{ "changelog": "新增业务流：<title>",
  "entry": { "kind":"biz", "type":"业务流", "status":"已完成",
    "service":"<service>", "module":"<module>", "title":"<title>", "date":"<date>", "docPath":"<docPath>",
    "background":"<background>", "apis":[<apis>],
    "bizFlow":"<bizFlow>", "dataFlow":"<dataFlow>", "sequence":"<sequence>", "stateMachine":"<stateMachine>",
    "roles":[<roles>], "context":[<context>], "dataChanges":[<dataChanges>],
    "bizRules":[<bizRules>], "validations":[<validations>], "testPoints":[<testPoints>],
    "dataObjects":[<dataObjects>],
    "assumptions":[<assumptions>], "conflicts":[<conflicts>], "blockers":[<blockers>], "openQuestions":[<openQuestions>] } }
JSON
node project-html/board-add.js project-html/data/_entry.json && rm -f project-html/data/_entry.json
```

- **标准 JSON**：字符串值用双引号、内部换行写成 `\n`，**不要用反引号**；各 Mermaid 字段（`bizFlow`/`dataFlow`/`sequence`/`stateMachine`）都是带 `\n` 的普通字符串，没有的字段省略。字段含义见上方表格与 [reference.md](reference.md#html-追加格式)。
- **结构化字段优先**：`roles` / `context` / `dataChanges` / `validations` / `dataObjects` 能从代码或用户输入确定时必须写入；未知值写 `待补充`，不要整块省略到只剩 Mermaid 图。
- **查重自动处理**：脚本按 `docPath` 命中既有条目时就地更新并**保留原 status**，否则追加。Step 4 冲突选 A/E 时只把 `changelog` 改成 `更新业务流：<title>`。
- **结果与回滚**：脚本打印 `✓ 看板已追加/更新…（记录数 X → Y）`；校验失败会放弃写入并保持原文件不动，按提示排查后重试，不要手改文件。
- **`node` 不存在** → 降级手工：用 Edit 在 `// ─── 在此行上方追加新记录 ───` 上方插入同一对象（注意 JS 转义），并在变更日志标记行上方插入 `{ date: "<date>", desc: "新增业务流：<title>" }`，提示用户手动打开看板确认。

**③ 生成单页 + 文档总索引（构建）**：写入成功后运行 `node project-html/build.js`，为每条记录生成自包含单页 `project-html/pages/<slug>.html`（可单独发给测试）、重新生成 `docs/INDEX.md` 文档总索引，首次运行时把项目根散落历史资料复制归档到 `docs/archive/`（不删原件）。`node` 不存在 → 跳过。

**跳过条件**：dev-doc 未安装（模板目录不存在）且项目中也无 `project-html/` → 跳过本步，提示用户安装 dev-doc 后可启用看板。

### Step 6：输出 Next Steps

模板见 [reference.md](reference.md#完成后输出格式)

完成输出必须包含 reference.md 里的 `【Workflow Brief】` 块（PlanGate 阶段），供下一位 AI（测试设计 / dev-doc / review-fix / code-reading）先读索引再按 tokenHint 读取业务流文档和相关接口，不必粘贴全文。

## 规则

- **面向测试**：语言通俗，每张图配说明，重点落在"怎么测"
- **不编造**：未确认的接口/字段/分支标 `待补充`，宁缺毋假
- **不乱猜需求**：低风险可假设，高风险必须提出来确认；发现逻辑不通时直接指出，闭环缺口不靠图形补齐
- **图按需画**：画不出来的图直接删，不放空模板
- **测试执行口径必须落地**：主流程、优先异常、数据核对、暂不覆盖都要写清楚，测试拿到后能直接拆用例
- **静默分析**：Step 1、Step 3 的命令与读码过程不展示给用户

## 检查清单（生成前确认）

- [ ] `$feature` 已确认（不为空）
- [ ] 已找到业务闭环入口，或已列出已覆盖/缺失/排除入口并标记 blocker；信息槽位已用于查漏，没有机械追问非阻塞项
- [ ] 文件路径冲突已处理
- [ ] 至少画出业务流转图，其余图按需
- [ ] 角色入口、上下文/前置条件、阶段数据变动、校验规则已按实际复杂度补齐（简单无状态功能可省略）
- [ ] 测试执行口径已写清主流程、优先异常、数据核对、暂不覆盖
- [ ] 证据等级、假设、冲突、阻塞项已写入；阻塞未清时没有输出确定性测试口径
- [ ] 测试关注点具体可验证（至少 3 条）
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`，并已运行 `node project-html/build.js`
- [ ] 完成输出已包含 `【Workflow Brief】` 块（Step 6）

## 相关资源

- 完整文档模板与信息槽位：[reference.md](reference.md)
- 已填示例：[examples.md](examples.md)
- 看板模板与 build.js：复用 `../dev-doc/assets/board/`
- 相邻 skill：`/code-reading`（给开发的代码地图）、`/dev-doc`（开发文档）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 图节点太多看不清 | 一张图塞了所有细节 | 拆成业务流转 / 数据流 / 时序三张，每张只讲一个维度 |
| 全是"待补充" | 用户只给了功能名且代码/文档搜索也找不到入口 | 先用功能名、菜单、Controller、Job、Listener、状态字段搜索；仍没有入口时只问一个最小入口 |
| 看板写入后打不开 | 手工降级时 Mermaid 字段含未转义的反引号/双引号/换行 | 优先走 `board-add.js`（自动转义）；确需手工时改完必做 `node --check` |
| 找不到看板模板 | dev-doc 未安装 | 先运行 install 脚本确保 dev-doc 已安装 |
| 写得像给开发看的 | 堆了代码细节 | 回到"测试读者"视角：讲业务怎么走、数据去哪、该测什么 |
| `board-add.js` 报"记录数下降，已放弃写入" | 输入 entry 异常或现有文件已损坏 | 原文件未被改动，按提示排查输入 JSON / 现有 `data/changes.js` 后重试 |
| `build.js` 中止并提示"疑似数据被误覆盖" | `pages/` 现存单页数远多于 `data/changes.js` 当前记录数 | 先排查 `data/changes.js` 是否被误写小了（看 `.bak`），确认是有意删条目再设 `BOARD_FORCE_BUILD=1` 重跑 |
