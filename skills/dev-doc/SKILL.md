---
name: dev-doc
description: 当开始编码前需要把需求落成可执行文档时使用——需求还是口头想法、AI 可能走错方向、或任务范围不清晰时。仅在用户显式 /dev-doc 时调用
argument-hint: [任务名称]
arguments: task
disable-model-invocation: true
allowed-tools: Write, Read, Edit, Bash, Glob
shell: bash
model: sonnet
effort: high
---

# 开发文档生成（开发工作流 - Step 1）

## 任务定位

本 Skill 是开发工作流的第一步：把需求落成文档，驱动后续编码、自测、Code Review、上线。
文档必须**可执行**——结尾给出明确的下一步 Todo 清单。

## 执行流程

### Step 0：参数检查

- `$task` 为空 → 询问用户："这次要做什么任务？用一句话描述（如 '用户登录优化'）"
- 任务名规范化：
  - 英文：转小写 + 空格转 `-`（`user login` → `user-login`）
  - 中文：保留原样（`用户登录优化`）
  - 文件名清洗：`/ \ : * ? " < > |` 及多余空格统一替换为 `-`（`用户 Login/优化` → `用户-Login-优化`）

### Step 1：静默收集环境上下文（不打扰用户）

执行以下命令，结果**用作引导提问和 Step 6 输出填充**，不展示给用户：

```bash
# VCS 类型检测（记住结果：git / svn / none，用于 Step 6 填入代码审查命令）
if git rev-parse --git-dir 2>/dev/null; then
  git branch --show-current 2>/dev/null
  git log --oneline -3 2>/dev/null
else
  svn info 2>/dev/null | grep -E "^(Relative URL|Revision):"
  svn log -l 3 2>/dev/null
fi
# 项目类型检测（记住结果，用于 Step 6 填入验证命令）
python3 -c "import pathlib; print('\n'.join(f for f in ['pom.xml','build.gradle','package.json'] if pathlib.Path(f).exists()))"
```

### Step 2：确认任务类型和复杂度（逐一提问）

先问类型，等用户回答后再问复杂度：

> 任务类型是？（新功能 / Bug 修复 / 重构 / 性能优化 / API 联调 / 配置变更）

收到回答后再问：

> 复杂度？（简单：≤50 行 / 中等：50–500 行 / 复杂：>500 行或跨模块）

若用户选"复杂"，追加提示："建议执行阶段输入 `/model opus` 切换更强的模型。"

### Step 3：按类型收集需求（逐一提问）

**规则：每次只问一个问题，等回答后再问下一个。**

具体问题集见 [reference.md](reference.md#step-3-问题集)：
- 简单任务：2 个问题
- 新功能 / Bug / 重构 / 性能：各 5 个针对性问题

提问引导：利用 Step 1 拿到的 git 上下文做引导式提问。
用户答"不知道"/"待定" → 记为 `待补充`，继续下一题。
全部完成后告知用户："信息收集完毕，开始生成文档。"

### Step 4：路径处理（跨平台）

用 Python 一条命令完成日期获取和目录创建：

```bash
python3 -c "
from datetime import date
import pathlib
d = date.today().isoformat()
pathlib.Path('docs/' + d).mkdir(parents=True, exist_ok=True)
print(d)
"
```

若 `python3` 不可用回退到 `python`。命令输出即为日期字符串（如 `2026-05-31`），拼接为最终路径 `docs/<日期>/<任务名>.md`。

**冲突处理**：用 Read 工具尝试读取目标文件：
- 读取成功 → 询问：
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
- 只使用用户提供的信息，未确认的标 `待补充`，不编造
- **开闭原则贯穿全文档**：方案优先扩展，必须修改的要在"最小影响分析"说明原因
- **不相关章节直接删除**：纯后端任务不留前端章节，简单 Bug 不写复杂流程图
- **Apifox 章节**：Step 3 问答中提到新增或修改 API 时，生成「十三、Apifox 接口规范」章节，内容为可直接导入 Apifox 的 OpenAPI 3.0 YAML；根据用户提供的接口信息填入 `paths`，未确认字段用 `# 待补充` 注释标记；未涉及接口变更则删除该章节

### Step 5.5：同步更新 HTML 展示页

**先询问用户（一个问题）：**
> 这属于哪个服务/模块？（如：用户服务、订单服务；单模块项目填项目名；不确定填 `通用`）

收到回答后，**Read 刚生成的 md 文件**，从中提取以下字段（提取时跳过模板占位符 `[...]`，遇到则填空字符串或空数组）：

| JS 字段 | 从 md 文档提取位置 |
|---------|------------------|
| `module` | 用户刚才的回答 |
| `title` | `$task`（任务名） |
| `date` | Step 4 获取的日期 |
| `type` | Step 2 确认的任务类型 |
| `complexity` | Step 2 确认的复杂度 |
| `status` | 固定值 `草稿` |
| `branch` | Step 1 检测到的 Git branch 名 |
| `background` | `### 背景` 下第一段文字（最多 120 字） |
| `goals` | `### 目标` 下 `- [ ]` 条目 → string[] |
| `scopeIn` | `✅ 包含：` 后文字，按 `/` 或换行拆分 → string[] |
| `scopeOut` | `❌ 不包含：` 后文字，按 `/` 或换行拆分 → string[] |
| `solution` | `### 方案概述` 下第一段文字 |
| `coreDesign` | `### 核心设计` 下第一段文字 |
| `flowchart` | `## 七、流程图` 下 mermaid 代码块内容（不含 ` ``` ` 标记） |
| `changeList` | `## 六、代码变更清单` 表格各行 → `{file, action, desc}[]` |
| `todos` | `## 十一、实现 Todo` 下 `- [ ]` 条目 → string[] |
| `apis` | `## 三、API 设计` 表格各行 → `{method, url, desc}[]`；无该节则填 `[]` |

**判断文件是否存在**（用 Read 工具尝试读取 `project-html/index.html`）：

- **不存在** → 用 Write 工具创建完整 HTML 文件，模板见 [reference.md](reference.md#html-展示页模板)，将提取的字段写为首条记录
- **已存在** → 两次 Edit：

  **① 追加文档条目**（定位文档标记行）：
  - `old_string`：`    // ─── 在此行上方追加新记录 ───`
  - `new_string`：将所有提取到的字段组成对象插入，末尾加逗号，保留标记行。
    非空字段才写入，空数组可省略。最小格式示例：
    ```
        {
          module: "<module>",
          title: "<title>",
          date: "<date>",
          type: "<type>",
          complexity: "<complexity>",
          status: "草稿",
          branch: "<branch>",
          background: "<background>",
          goals: [<goals>],
          scopeIn: [<scopeIn>],
          scopeOut: [<scopeOut>],
          apis: [],
          solution: "<solution>",
          coreDesign: "<coreDesign>",
          flowchart: `<flowchart>`,
          changeList: [<changeList>],
          todos: [<todos>]
        },
        // ─── 在此行上方追加新记录 ───
    ```

  **② 追加 HTML 变更日志**（定位日志标记行）：
  - `old_string`：`    // ─── 在此行上方追加变更日志 ───`
  - `new_string`：
    ```
        { date: "<date>", desc: "新增文档：<title>" },
        // ─── 在此行上方追加变更日志 ───
    ```

输出一行提示：`📄 HTML 展示页已更新：project-html/index.html`

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

- [ ] $task 已确认（不为空）
- [ ] 任务类型和复杂度已确认
- [ ] 按类型问完了对应数量的问题
- [ ] 文件路径冲突已处理
- [ ] 不相关章节已删除（避免大量"待补充"）
- [ ] 最小影响分析已包含
- [ ] 代码评审关注点已填写
- [ ] Claude/Cursor 执行提示已生成

## 相关资源

- 完整文档模板与问题集：[reference.md](reference.md)
- 已填示例（新功能 / Bug 修复）：[examples.md](examples.md)
- 中文文档规范：**必需背景：** `chinese-documentation` skill
- 后续步骤：`/requesting-code-review`（AI 代码审查）、`/code-reading`（生成代码地图）、`/chinese-code-review`（PR 评论话术）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 文档生成后 AI 执行走偏 | 「六、代码变更清单」写得不够具体 | 每个条目加上「为何不能用扩展替代」说明 |
| 问答时用户回答"待定"太多 | 需求本身还不成熟 | 先用 `/brainstorming` 理清需求再运行 dev-doc |
| 文档文件名冲突 | 同天同任务名重复运行 | 按提示选择 A/B/C/D/E 处理冲突 |
| Step 1 git 命令报错 | 项目无 VCS | 正常，自动降级到无 VCS 模式 |
