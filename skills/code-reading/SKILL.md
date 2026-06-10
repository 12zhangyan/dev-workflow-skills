---
name: code-reading
description: 当需要在 Code Review 前理解代码结构时使用——AI 修改代码后心智模型不清晰、不知调用链从何开始、或需要梳理状态跳转时。仅在用户显式 /code-reading 时调用
argument-hint: [功能描述 | dev-doc路径 | ClassName#method]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Write
shell: bash
model: sonnet
effort: high
---

# 代码地图生成（Review 前阅读工具）

## 任务定位

在 Code Review 之前运行。把陌生代码转化为可阅读的「地图文档」：调用链流程图 + 状态机 + 代码位置索引。
**只做结构梳理，不做问题判断。**

## 执行流程

### Step 0：入口检测与参数检查

`$entry` 为空 → 询问用户：
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

收集候选文件后，列出候选入口类/方法，询问用户确认：
> "找到以下候选入口，请确认从哪里开始追踪（输入序号，或输入完整类名）：
> 1. [类名]（[文件路径]）
> 2. ..."

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
- 调用链节点格式：`类名.方法名()`，不含包名
- 业务状态机仅在发现明确状态跳转时生成（`stateDiagram-v2`）
- 关键变量追踪仅在变量被 3 处以上读写时记录
- dev-doc 模式必须生成「六、方案 vs 实现对照」章节

### Step 4：保存文件

```bash
d=$(date +%F) && mkdir -p "docs/code-reading/$d" && echo "$d"
```

Write 文件到 `docs/code-reading/<日期>/<功能名>.md`。

输出：
```
✅ 代码地图已生成：docs/code-reading/<日期>/<功能名>.md

可以开始 Review 了。
如需 AI 审查，运行：/requesting-code-review
```

## 规则

- **静默分析**：Step 1-2 的搜索与读取结果不展示给用户，仅作内部上下文
- **不编造**：只记录代码里实际存在的调用/状态/注释
- **不越界**：不提修改建议，不标记问题，那是 `/requesting-code-review` 的职责

## 相关资源

- 完整文档模板：[reference.md](reference.md)
- **必需背景：** `dev-doc` skill（了解 dev-doc 模式入口的文档结构）
- AI 代码审查：`/requesting-code-review`（code-reading 之后运行）
- 完整工作流参考：`best-practice/java-svn-dev-workflow.md`

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 功能描述模式找不到相关文件 | 关键词太泛（如"登录"） | 改用类名模式：`AuthController#login` |
| dev-doc 模式无「六、代码变更清单」 | dev-doc 文档格式不同 | 切换到入口代码模式 |
| 流程图节点太多看不清 | 追踪层级过深 | 只追踪 3 层以内，更深的用「...」省略 |
| 状态机图没有生成 | 代码里没有找到明确状态跳转 | 正常，只有发现 setStatus/枚举赋值时才生成 |
