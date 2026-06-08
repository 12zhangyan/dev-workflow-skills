---
name: bug-fix
description: 记录和分析 Bug，生成修复文档并追加到 HTML 看板——发现需要完整记录分析的 Bug 时使用。仅在用户显式 /bug-fix 时调用
argument-hint: [bug 名称]
arguments: task
disable-model-invocation: true
allowed-tools: Write, Read, Edit, Bash, Glob, Grep
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
python3 -c "import pathlib; print('\n'.join(f for f in ['pom.xml','build.gradle','package.json'] if pathlib.Path(f).exists()))"
```

### Step 2：逐一收集 Bug 信息

**规则：每次只问一个问题，等回答后再问下一个。**

具体问题集见 [reference.md](reference.md#step-2-问题集)，共 5 个问题。

全部完成后告知用户："信息收集完毕，正在搜索相关代码..."

### Step 3：自动代码搜索（不问用户）

从 Step 2 Q1 的堆栈信息中提取类名，执行以下操作：

1. 识别堆栈中 `at com.xxx.ClassName` 格式的类名（取最靠近抛出点的 1-2 个）
2. 用 Grep 工具搜索 `src/` 目录：
   - pattern: `class <ClassName>`，glob: `**/*.java`，output_mode: `files_with_matches`
3. 读取命中文件，定位堆栈中 method 对应的方法体
4. 将定位结论（文件路径 + 方法名 + 初步判断）存为 `codeLocation` 文字摘要

**跳过条件**：堆栈为空 / 无 `src/` 目录 / grep 无结果 → `codeLocation` 置空，继续

### Step 4：路径处理

```bash
python3 -c "
from datetime import date
import pathlib
d = date.today().isoformat()
pathlib.Path('docs/bugs/' + d).mkdir(parents=True, exist_ok=True)
print(d)
"
```

路径格式：`docs/bugs/<日期>/<任务名>.md`

冲突处理（Read 检查是否存在）：A 覆盖 / B 时间戳后缀 / C 版本号后缀 / D 取消 / E 追加更新

### Step 5：生成文档

加载模板：[reference.md](reference.md#文档模板)

**核心规则**：
- 只使用用户提供的信息，未确认的标 `待补充`
- `代码定位` 用 Step 3 结论填入；跳过时写 `待分析`
- 根因无明确结论时可写"初步怀疑…（推断，待验证）"
- 验证步骤必须具体可执行

### Step 5.5：追加到 HTML 看板

**先询问用户（一个问题）：**
> 这个 Bug 属于哪个服务/模块？（如：用户服务、订单服务；不确定填 `通用`）

从生成文档提取字段：

| JS 字段 | 提取来源 |
|---------|---------|
| `kind` | 固定值 `"bug"` |
| `module` | 用户回答 |
| `title` | `$task` |
| `date` | Step 4 日期 |
| `severity` | Step 2 Q2（P0/P1/P2/P3） |
| `status` | 固定值 `"未修复"` |
| `branch` | Step 1 Git 分支（无 VCS 填 `"-"`） |
| `symptom` | 「一、Bug 现象」开头一段（最多 120 字） |
| `stackTrace` | 「错误信息 / 异常堆栈」代码块内容 |
| `reproSteps` | 「复现步骤」编号列表 → string[] |
| `trigger` | 「触发条件」文字 |
| `expected` | 「预期行为」 |
| `actual` | 「实际行为」 |
| `impact` | 「二、影响范围」文字 |
| `codeLocation` | 「代码定位」摘要 |
| `rootCause` | 「根因」文字 |
| `fixPlan` | 「四、修复方案 → 方案概述」文字 |
| `changeList` | 「五、代码变更清单」表格 → `{file,action,desc}[]` |
| `verifySteps` | 「六、验证步骤」列表 → string[] |
| `todos` | 「七、实现 Todo」列表 → string[] |

**判断文件是否存在**（Read `project-html/index.html`）：

- **不存在** → Write 创建完整 HTML（模板见 [../dev-doc/reference.md](../dev-doc/reference.md#html-展示页模板)），将当前 bug 写为 `changes` 数组首条记录
- **已存在** → 两次 Edit：

  **① 追加 Bug 条目**：
  - `old_string`：`    // ─── 在此行上方追加新记录 ───`
  - `new_string`：bug 对象 + 标记行（格式见 [reference.md](reference.md#html-追加格式)）

  **② 追加变更日志**：
  - `old_string`：`    // ─── 在此行上方追加变更日志 ───`
  - `new_string`：
    ```
        { date: "<date>", desc: "新增 Bug：<title>" },
        // ─── 在此行上方追加变更日志 ───
    ```

输出：`🐛 Bug 已追加到 HTML 看板：project-html/index.html`

### Step 6：输出 Next Steps

模板见 [reference.md](reference.md#完成后输出格式)

## 规则

- **不污染主对话**：Step 1、Step 3 命令输出不展示
- **不编造根因**：无明确代码问题时写 `待分析`
- **搜索失败静默跳过**：无 Java 源码或 grep 无结果 → 跳过 Step 3

## 检查清单（生成前确认）

- [ ] `$task` 已确认（不为空）
- [ ] Step 2 的 5 个问题全部问完
- [ ] Step 3 代码搜索已执行（或已标记跳过）
- [ ] 文件路径冲突已处理
- [ ] 验证步骤具体可执行（至少 1 条）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 根因分析为空 | 堆栈不完整或无 src 目录 | Step 3 标记跳过，根因写"待分析" |
| Step 5.5 追加后 JS 语法错误 | stackTrace 含反引号 | stackTrace 值改用双引号，换行用 `\n` 转义 |
| 找不到 HTML 模板 | dev-doc 未安装 | 先运行 install 脚本确保 dev-doc 已安装 |
