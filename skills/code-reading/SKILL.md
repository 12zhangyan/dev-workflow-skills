---
name: code-reading
description: 当需要在 Code Review 前理解代码结构时使用——AI 修改代码后心智模型不清晰、不知调用链从何开始、或需要梳理状态跳转时。Codex 中用户可说"使用 code-reading skill 生成代码地图"；Claude Code 可兼容 /code-reading。
argument-hint: [功能描述 | dev-doc路径 | ClassName#method]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# 代码地图生成（Review 前阅读工具）

## 任务定位

在 Code Review 之前运行。把陌生代码转化为可阅读的「地图文档」：调用链流程图 + 状态机 + 代码位置索引。
**只做结构梳理，不做问题判断。**

## 执行流程

### 共享交互协议

先遵循 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)：从代码和文档证据预填，少问；候选入口唯一且高置信时直接使用并记录依据，低置信或多候选才向用户确认。

### Step 0：入口检测与参数检查

`$entry` 为空 → 用 AskUserQuestion 询问（三选一，候选入口确认同样用 AskUserQuestion）：
> "请选择入口方式：
> ① 功能描述（如：用户短信登录）
> ② dev-doc 文档路径（如：docs/2026-06-01/sms-login.md）
> ③ 入口类或方法名（如：AuthController#login）"

检测模式（按优先级）：
- `$entry` 含 `.md` 扩展名 或以 `docs/` 开头 → **dev-doc 模式**
- `$entry` 含 `#` 或 `.java` → **入口代码模式**
- 其他自然语言描述 → **功能描述模式**

告知用户："检测到入口模式：[模式名]，开始静默分析..."

### Step 1：代码发现（按模式）

**功能描述模式：**

提取 `$entry` 中的关键词，用 Grep 工具逐一搜索：
- pattern: `<关键词>`，glob: `**/*.java`，output_mode: `files_with_matches`（每个关键词取前 20 个结果）

收集候选文件后按命中强度排序：
- 唯一高置信候选（类名/方法名/接口路径/菜单名多处命中，且路径处于业务模块内）→ 直接作为入口，记录"自动选择依据"，不询问用户。
- 多个相似候选或低置信候选 → 最多列 5 个，询问用户确认：
> "找到以下候选入口，请确认从哪里开始追踪（输入序号，或输入完整类名）：
> 1. [类名]（[文件路径]）
> 2. ..."
- 无候选 → 只问一个聚焦问题：让用户提供入口类、接口路径或 dev-doc 路径。

**dev-doc 文档模式：**

1. Read `$entry` 文件
2. 定位「六、代码变更清单」章节，提取表格中的文件路径列表
3. 优先选"修改"类条目的第一个文件作为追踪起点（修改文件是核心逻辑所在）
4. 其余文件加入待读队列

**入口代码模式：**

1. 解析 `$entry`：`#` 前为类名，`#` 后为方法名（无 `#` 则追踪整个类）
2. 定位类文件：用 Glob 工具，pattern: `**/<ClassName>.java`
3. Read 文件，定位方法起始行号
4. 从该方法向下追踪调用链

### Step 2：深度阅读（静默，不展示中间过程）

对所有发现的文件逐一 Read，记录以下信息：

- **调用链**：跨类的方法调用，格式 `ClassName.method()` → `ClassName.method()`
- **状态跳转**：`.setStatus()`、枚举赋值、状态字段变更语句
- **关键变量**：被多处读写的业务变量（非临时循环变量）
- **外部调用**：@Repository 方法、RestTemplate/Feign、RedisTemplate、MQ 发送
- **事务边界**：@Transactional 注解位置及传播级别
- **异常分支**：主要 catch 块处理逻辑、重要的 if/else 判断分支

### Step 3：生成文档

加载完整模板：[reference.md](reference.md#文档模板)

核心规则：
- 只记录代码里实际存在的内容，未确认的不写
- 记录入口选择依据，尤其是功能描述模式下自动选中的候选
- 调用链节点格式：`类名.方法名()`，不含包名
- 业务状态机仅在发现明确状态跳转时生成（`stateDiagram-v2`）
- 关键变量追踪仅在变量被 3 处以上读写时记录
- dev-doc 模式必须生成「六、方案 vs 实现对照」章节

### Step 4：保存文件

```bash
d=$(date +%F) && mkdir -p "docs/code-reading/$d" && echo "$d"
```

**冲突处理**：Write 前先用 Read 检查 `docs/code-reading/<日期>/<功能名>.md` 是否已存在：
- 读取成功 → 用 AskUserQuestion 询问：`A` 覆盖（重新生成地图）/ `B` 时间戳后缀（`<功能名>-1530.md`）/ `C` 取消。默认建议 A（代码地图本就是当前代码的快照，重跑即刷新）。
- 读取失败 → 直接 Write 到 `docs/code-reading/<日期>/<功能名>.md`。

> 看板登记（Step 4.5）按 `docPath` 查重：选 A 覆盖时命中既有条目改为更新，不会产生重复看板记录。

### Step 4.5：登记到 HTML 看板

代码地图也是项目知识资产，登记为看板的「阅读」类条目（kind:"reading"）。

**定位：看板条目面向人类阅读**——让没读过这段代码的同事看完就有整体心智模型；md 是供 Review 时逐项对照的完整地图。

**字段提取**：

| JS 字段 | 取值 |
|---------|------|
| `kind` | 固定 `"reading"` |
| `type` | 固定 `"代码阅读"` |
| `status` | 固定 `"已完成"` |
| `title` | 功能名（文档文件名去扩展名） |
| `date` | Step 4 日期 |
| `entry` | `$entry` 原值（如 `AuthController#login`） |
| `docPath` | `docs/code-reading/<日期>/<功能名>.md` |
| `background` | **面向人类撰写（不要截取 md）**：这个功能从入口到出口整体怎么运转——请求从哪进、经过哪些关键环节、数据最终落到哪，3–5 句；有状态机时点一句状态怎么流转。可用 `\n` 分段 |
| `flowchart` | 调用链 mermaid 代码块内容（不含 ` ``` ` 标记） |
| `keyImpl` | 代码位置索引前 5 项 → `{title:"类.方法", desc:"文件路径 + 用一句人话说明它在链路中干什么"}[]` |
| `assumptions` / `openQuestions` | 入口自动选择依据、非阻塞不确定点；code-reading 不输出修复建议 |

**service/module 归属**：
- dev-doc 模式 → Read `project-html/data/changes.js`，按源 dev-doc 文档的 `docPath` 找到对应条目，复用其 `service` / `module`
- 其他模式 → 问一次："属于哪个微服务/模块？格式 `服务/模块`（不确定填 `通用/通用`）"

**看板操作与 `/dev-doc` Step 5.5 / 5.6 完全相同**：先用 `test -f project-html/data/changes.js` 判定 EXISTS/MISSING，MISSING 时执行 dev-doc 的「外壳复制命令」（含 `build.js` + `board-add.js`，并 `test -f ... || cp` 补空数据模板）、做旧版单文件迁移；EXISTS 时按 `BOARD_VERSION` 决定是否升级外壳。模板目录按 `~/.codex/skills`、`~/.claude/skills`、`~/.cursor/skills`、`~/.agents/skills` 依次查找。

**写入条目同样走 `board-add.js`**（确定性脚本：备份、按 `docPath` 查重、转义、记录数回归全自动，不手改 `data/changes.js`）：

```bash
cat > project-html/data/_entry.json <<'JSON'
{ "changelog": "新增代码地图：<title>",
  "entry": { "kind":"reading", "type":"代码阅读", "status":"已完成",
    "service":"<service>", "module":"<module>", "title":"<title>", "date":"<date>",
    "entry":"<entry>", "docPath":"<docPath>", "background":"<background>",
    "flowchart":"<flowchart>", "keyImpl":[<keyImpl>],
    "assumptions":[<assumptions>], "openQuestions":[<openQuestions>] } }
JSON
node project-html/board-add.js project-html/data/_entry.json && rm -f project-html/data/_entry.json
```

entry 为标准 JSON（字符串双引号、换行写 `\n`、不要反引号；`flowchart` 是带 `\n` 的普通字符串）。脚本打印 `✓` 即成功，命中 `docPath` 会就地更新；校验失败则原文件不动。写入后运行 `node project-html/build.js` 刷新单页 `pages/<slug>.html` 与文档总索引 `docs/INDEX.md`。`node` 不存在 → 降级手工 Edit 标记行（注意 JS 转义）并提示用户打开看板确认。

**跳过条件**：dev-doc 未安装（模板目录不存在）且项目中也无 `project-html/` → 跳过本步，提示用户安装 dev-doc 后可启用看板。

输出：
```
✅ 代码地图已生成：docs/code-reading/<日期>/<功能名>.md
📖 已登记到 HTML 看板（浏览器打开 project-html/index.html，筛选「📖 阅读」查看）
📑 已刷新单页 pages/ 与文档总索引 docs/INDEX.md

可以开始 Review 了。
如需 AI 审查，运行：/requesting-code-review
```

## 规则

- **静默分析**：Step 1-2 的搜索与读取结果不展示给用户，仅作内部上下文
- **不编造**：只记录代码里实际存在的调用/状态/注释
- **不越界**：不提修改建议，不标记问题，那是 `/requesting-code-review` 的职责
- **偏差只记录，不定性**：dev-doc 模式下发现方案与实现不一致，只写"偏差/观察，Review 时关注"，不把它定为 Bug

## 检查清单（生成前确认）

- [ ] `$entry` 已确认（不为空），入口模式已识别
- [ ] Step 1-2 静默分析完成，调用链/状态/关键位置已收集
- [ ] 文件路径冲突已处理（Step 4）
- [ ] 只记录代码里实际存在的内容，无修改建议、无问题标记
- [ ] dev-doc 模式已生成「六、方案 vs 实现对照」章节
- [ ] 看板条目已用 `node project-html/board-add.js` 写入并打印 `✓`，并已运行 `node project-html/build.js`

## 相关资源

- 完整文档模板：[reference.md](reference.md)
- **必需背景：** `dev-doc` skill（了解 dev-doc 模式入口的文档结构）
- AI 代码审查：`/requesting-code-review`（code-reading 之后运行）
- 完整工作流参考：仓库内 `docs/workflow-guide.md`（dev-workflow-skills 项目文档，非安装后的同级文件）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 功能描述模式找不到相关文件 | 关键词太泛（如"登录"） | 改用类名模式：`AuthController#login` |
| dev-doc 模式无「六、代码变更清单」 | dev-doc 文档格式不同 | 切换到入口代码模式 |
| 流程图节点太多看不清 | 追踪层级过深 | 只追踪 3 层以内，更深的用「...」省略 |
| 状态机图没有生成 | 代码里没有找到明确状态跳转 | 正常，只有发现 setStatus/枚举赋值时才生成 |
| Step 4.5 找不到看板模板 | dev-doc 未安装 | 跳过看板登记，提示安装 dev-doc |
