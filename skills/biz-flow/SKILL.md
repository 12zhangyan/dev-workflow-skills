---
name: biz-flow
description: 把一组接口/功能捋成面向测试人员的业务逻辑方案——给出业务流转图、数据流图、时序图、业务规则与测试关注点。当需要让测试/产品看懂一条业务怎么走、数据怎么流时使用。仅在用户显式 /biz-flow 时调用
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

输入一组相关接口（或功能描述、Controller 入口），输出一份**面向测试人员**的业务逻辑技术方案：业务流转图 + 数据流图 + 时序图 + 关键业务规则 + 测试关注点。
**目标读者是测试/产品，不是开发**——讲清楚「这条业务整体怎么走、数据从哪来到哪去、什么条件走什么分支、哪里最该测」，少堆代码术语。

产出：`docs/biz-flow/<日期>/<业务名>.md`，并以 `kind:"biz"` 登记到 HTML 看板（🔀 业务流）。

与相邻 skill 的分工：`/code-reading` 是给开发看的代码地图（调用链 + 代码位置）；`/biz-flow` 是给测试看的业务地图（业务流转 + 数据流 + 规则）。

## 执行流程

### Step 0：参数检查

- `$feature` 为空 → 询问："这条业务/功能叫什么？用一句话描述（如 '订单超时自动取消'）"
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

### Step 2：收集接口与业务信息（逐一提问，每次只问一个）

具体问题集见 [reference.md](reference.md#step-2-问题集)，共 5 个问题。**核心是第 1 问：让用户贴出相关接口**（URL + 方法 + 简述，或 Controller 类名/方法、Swagger 片段均可）。封闭选项用 AskUserQuestion，自由文本直接对话。

用户答"不知道"/"待定" → 记 `待补充`，继续下一题。
全部完成后告知："信息收集完毕，正在分析业务流..."

### Step 3：代码追踪补全（静默，按需）

若用户给了接口/类名且项目有源码，按项目类型补全业务细节（不展示中间过程）：

**Java（pom.xml / build.gradle）：**
1. 用 Grep 定位每个接口的 Controller 方法（pattern: URL 片段或方法名，glob: `**/*.java`）
2. 顺着 Controller → Service → Mapper/Repository 读 2–3 层，重点记录：
   - **数据流**：入参从哪来、查/写了哪些表或外部服务、返回什么
   - **业务分支**：if/else、状态判断、枚举流转（`setStatus`、状态机）
   - **服务/接口交互**：Feign/RestTemplate/MQ 调用、事务边界
3. 多个接口之间的先后/依赖关系（如「下单」→「支付回调」→「发货」）

**JS/TS（package.json）：** 顺着路由 → controller/service 读取，记录同类信息。

**跳过条件**：无源码 / 用户只给了口头描述 → 仅基于用户提供的信息绘图，未知处标 `待补充`，不编造。

### Step 4：路径处理

```bash
d=$(date +%F) && mkdir -p "docs/biz-flow/$d" && echo "$d"
```

路径格式：`docs/biz-flow/<日期>/<业务名>.md`

冲突处理（Read 检查是否存在）：A 覆盖 / B 时间戳后缀 / C 版本号后缀 / D 取消 / E 追加更新（用 AskUserQuestion）

### Step 5：生成文档

加载模板：[reference.md](reference.md#文档模板)
参考已填示例：[examples.md](examples.md)

**核心规则**：
- 面向测试人员撰写：每个图配一段大白话说明「这张图在讲什么、测试该重点看哪里」
- **三张图按需画，画不出来的删掉**：
  - 业务流转图（`flowchart`）：业务状态/分支怎么流转——几乎必画
  - 数据流图（`flowchart`，节点用「数据/存储」）：数据从入口经过哪些服务/表，最终落到哪——涉及多表/多服务时画
  - 时序图（`sequenceDiagram`）：多个服务/接口之间的调用时序——跨服务或有回调时画
  - 状态机（`stateDiagram-v2`）：有明确状态字段流转时才画
- 只用确认的信息，未知标 `待补充`，不编造接口或字段
- 业务规则写「触发条件 → 系统行为 → 边界」，测试关注点写「具体可验证的点」（含正常 + 异常 + 边界 + 并发）

### Step 5.5：登记到 HTML 看板（kind:"biz"）

**定位：看板条目面向人类阅读**——让没碰过这条业务的测试/同事看完就懂整体怎么走。md 是完整方案，看板是浓缩的业务地图。

**结构字段（照搬）：**

| JS 字段 | 来源 |
|---------|------|
| `kind` | 固定 `"biz"` |
| `service` / `module` | Step 2 的归属（`服务/模块` 前后半段） |
| `title` | `$feature` |
| `type` | 固定 `"业务流"` |
| `status` | 固定 `"已完成"` |
| `date` | Step 4 日期 |
| `branch` | Step 1 Git 分支（无 VCS 填 `"-"`） |
| `docPath` | `docs/biz-flow/<日期>/<业务名>.md` |
| `apis` | 涉及接口 `{method,url,desc}[]` |
| `bizFlow` / `dataFlow` / `sequence` / `stateMachine` | 各图的 Mermaid 代码（不含 ` ``` ` 标记；没有的字段省略） |

**叙述字段（面向人类重新撰写，不截取 md；可用 `\n` 分段）：**

| JS 字段 | 写什么 |
|---------|--------|
| `background` | 业务概述：这条业务整体在做什么、从哪触发、最终达成什么，3–5 句，测试视角 |
| `bizRules` | 关键业务规则 → `{title:规则名, desc:触发条件→系统行为→边界，2–3 句}[]` |
| `testPoints` | 测试关注点 → string[]，每条是一个具体可验证的点（正常/异常/边界/并发） |

**字符串转义**（否则看板 JS 语法错误）：含双引号 → `\"`，含换行 → `\n`；Mermaid 字段用反引号模板字面量包裹，内容含反引号时改双引号 + `\n`。

**外壳复制命令**（创建和升级共用；外壳含 ~3MB 的 `js/vendor/mermaid.min.js`，**禁止用 Read+Write 复制外壳**，必须用 bash cp；模板在 dev-doc 的资产目录）：

```bash
src="$HOME/.claude/skills/dev-doc/assets/board"
mkdir -p project-html/css project-html/js/vendor project-html/data
cp "$src/index.html" project-html/index.html
cp "$src/css/board.css" project-html/css/board.css
cp "$src/js/board.js" project-html/js/board.js
cp "$src/js/vendor/mermaid.min.js" project-html/js/vendor/mermaid.min.js
cp "$src/build.js" project-html/build.js
```

> cp 失败（skill 不在默认安装路径）→ 降级：从 [../dev-doc/assets/board/](../dev-doc/assets/board/) Read+Write 四个文本外壳文件（index.html/css/js/build.js），跳过 vendor（看板自动走 mermaid CDN 兜底）。

**判断看板是否存在**（Read `project-html/data/changes.js`）：

- **不存在** →
  1. 若 `project-html/index.html` 已存在且内含 `const changes`（旧版单文件看板）→ 先把 `changes` / `htmlChangelog` 两个数组原样迁移到新建的 `data/changes.js`（带标记行），再执行外壳复制命令
  2. 否则：执行外壳复制命令；`data/changes.js` 从模板 Read（`../dev-doc/assets/board/data/changes.js`），占位数据替换为当前业务流记录后 Write（`htmlChangelog` 首条 desc 写 `"初始化 AI 变更记录看板"`）
- **已存在** → 依次执行：

  **⓪ 外壳版本检查**：`grep -m1 "BOARD_VERSION" project-html/js/board.js` 与 `grep -m1 "BOARD_VERSION" "$src/js/board.js"` 比较；项目侧缺失或小于模板 → 执行外壳复制命令（`data/` 不动），输出 `🔄 看板外壳已升级到 v<N>`

  **⓪′ 查重**：搜索相同 `docPath` 的既有条目（Step 4 冲突选 A/E 时必然命中）；命中 → Edit 更新该条目（status 保留原值），变更日志 desc 写 `更新业务流：<title>`，跳过 ①

  **① 追加业务流条目**：
  - `old_string`：`  // ─── 在此行上方追加新记录 ───`
  - `new_string`：业务流对象 + 标记行（格式见 [reference.md](reference.md#html-追加格式)）

  **② 追加变更日志**：
  - `old_string`：`  // ─── 在此行上方追加变更日志 ───`
  - `new_string`：
    ```
      { date: "<date>", desc: "新增业务流：<title>" },
      // ─── 在此行上方追加变更日志 ───
    ```

  **③ 语法校验（必做，不可跳过）**：`node --check project-html/data/changes.js`；报错 → 修复转义后重新校验直到通过；`node` 不存在 → 跳过并提示用户打开看板确认

  **④ 生成单页 + 文档总索引（构建）**：通过 ③ 后运行 `node project-html/build.js`，为每条记录生成自包含单页 `project-html/pages/<slug>.html`（可单独发给测试）、重新生成 `docs/INDEX.md` 文档总索引，首次运行时把项目根散落历史资料复制归档到 `docs/archive/`（不删原件）。`node` 不存在 → 跳过。

**跳过条件**：dev-doc 未安装（模板目录不存在）且项目中也无 `project-html/` → 跳过本步，提示用户安装 dev-doc 后可启用看板。

### Step 6：输出 Next Steps

模板见 [reference.md](reference.md#完成后输出格式)

## 规则

- **面向测试**：语言通俗，每张图配说明，重点落在"怎么测"
- **不编造**：未确认的接口/字段/分支标 `待补充`，宁缺毋假
- **图按需画**：画不出来的图直接删，不放空模板
- **静默分析**：Step 1、Step 3 的命令与读码过程不展示给用户

## 检查清单（生成前确认）

- [ ] `$feature` 已确认（不为空）
- [ ] Step 2 的 5 个问题问完（至少拿到接口清单）
- [ ] 文件路径冲突已处理
- [ ] 至少画出业务流转图，其余图按需
- [ ] 测试关注点具体可验证（至少 3 条）
- [ ] 看板 `data/changes.js` 已通过 `node --check`，并已运行 `node project-html/build.js`

## 相关资源

- 完整文档模板与问题集：[reference.md](reference.md)
- 已填示例：[examples.md](examples.md)
- 看板模板与 build.js：复用 `../dev-doc/assets/board/`
- 相邻 skill：`/code-reading`（给开发的代码地图）、`/dev-doc`（开发文档）

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| 图节点太多看不清 | 一张图塞了所有细节 | 拆成业务流转 / 数据流 / 时序三张，每张只讲一个维度 |
| 全是"待补充" | 用户只给了功能名没给接口 | Step 2 第 1 问必须拿到接口或入口类，否则先让用户补充 |
| Step 5.5 追加后看板打不开 | Mermaid 字段含未转义的反引号/双引号/换行 | ③ 的 `node --check` 必做，报错即修复后重校验 |
| 找不到看板模板 | dev-doc 未安装 | 先运行 install 脚本确保 dev-doc 已安装 |
| 写得像给开发看的 | 堆了代码细节 | 回到"测试读者"视角：讲业务怎么走、数据去哪、该测什么 |
