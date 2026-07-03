# dev-workflow-skills

Claude Code / Cursor / Codex skill 集，为 Java 后端开发者设计。
覆盖从需求分析到代码 Review 的完整工作流。

## 包含的 Skills

| Skill | 用途 |
|-------|------|
| `dev-doc` | 问答式生成开发文档 + 自动维护 HTML 知识库 |
| `bug-fix` | 记录 Bug、自动搜代码定位根因、生成修复文档并追加到 HTML 看板 |
| `code-reading` | Review 前生成代码地图（调用链+状态机+代码位置索引），并登记到 HTML 看板 |
| `review-check` | 按 `review-fix` 任务包或统一审查清单执行只读 code review，输出可回收 findings |
| `biz-flow` | 把一组接口捋成**面向测试**的业务逻辑方案（业务流转图+数据流图+时序图+测试关注点），登记到 HTML 看板 |
| `review-fix` | 生成可分发给 Codex/Cursor/Claude 的 code-review 审查清单；贴回 review 结果后再汇总修复交接与 AI 修复操作码 |

> 调用方式因工具而异：Claude Code 通常用 `/dev-doc` 这类斜杠命令；Codex 不要输入 `/dev-doc` 或 `$dev-doc`，直接说“使用 dev-doc skill 给 XX 生成开发文档”。安装脚本会在复制到 `~/.codex/skills` 后移除 `SKILL.md` 文件头 BOM，因为 Codex 发现器要求 frontmatter 直接以 `---` 开头；源码仍保留 BOM 以兼容部分 Windows 工具读取中文。

## dev-doc 能做什么

运行一次 `dev-doc`，自动产出**两份分工不同的文档**：md 给 AI 执行，看板给人看。

**① 生成 md 开发文档（AI 执行文档）**，精确到文件路径和执行步骤，交给 Claude/Cursor 照着干活，包含：

- 需求说明（背景 / 目标 / 范围）
- API 设计与接口列表
- 技术方案（方案概述 / 核心设计 / 最小影响分析）
- 流程图（Mermaid 语法）
- 代码变更清单
- 关键实现说明
- 实现 Todo / 代码评审关注点
- **Apifox 接口规范**（OpenAPI 3.0 YAML，可直接导入 Apifox）

**② 自动登记到 HTML 看板（人类阅读文档）**（`project-html/`，纸面编辑部风格：衬线标题 + 朱砂强调色 + 纸张底色）。
看板条目不是 md 的摘录，而是面向"没参与这次开发的同事"独立撰写的技术说明——背景、方案、取舍都用完整句子讲清楚，不看 md、不看代码也能在站会上转述这次改动：

- 左侧：**微服务 → 模块**两级文档树，顶部支持**搜索** + **文档/Bug/阅读/业务流类型筛选** + **仅看未完成**
- 右侧：结构化文档详情（需求 / 接口文档 / 技术方案 / 流程图 / 关键实现 / 代码变更），每条记录可一键打开 **md 源文档**
- **📊 浏览索引**：首页汇总统计 + 最近更新 + 按服务/模块归类的全量索引
- **🔌 接口索引**：聚合所有记录的接口变更，单独成页（仅登记新增或参数有变动的接口）
- **状态可点击切换**：点详情页状态标签即可推进（草稿→进行中→已完成 / Bug：未修复→修复中→已修复→已验证），保存在浏览器本地，无需重跑 skill
- 底部：HTML 变更日志时间轴（Mermaid 图表支持）

## 安装

完整工作流需要安装两个 skill 包：

### 第一步：安装 superpowers-zh（提供 brainstorming、requesting-code-review 等通用 skill）

```bash
npx superpowers-zh
```

### 第二步：安装 dev-workflow-skills（提供 dev-doc、bug-fix、code-reading、review-check、biz-flow、review-fix）

**macOS / Linux / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash
```

只安装到某个工具时可传目标，例如：`curl -fsSL .../install.sh | bash -s -- codex`；本地仓库中也可直接运行 `bash install.sh claude cursor`。

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

远程 PowerShell 安装默认会复制到 `%USERPROFILE%\.claude\skills`、`%USERPROFILE%\.cursor\skills`、`%USERPROFILE%\.codex\skills`。如果只想装 Codex，本地 clone 后用 `.\install.ps1 codex`，或使用下面的 `install-local.cmd codex`。

> Codex 目标有一条额外处理：复制完成后会把每个 `SKILL.md` 开头的 UTF-8 BOM 去掉，避免 Codex Desktop/CLI 读取 skill frontmatter 失败。Claude/Cursor 目标保持源码编码不变。

装完重启对应工具后生效：Claude Code 可尝试 `/dev-doc`；Codex 直接输入“使用 dev-doc skill 给 XX 生成开发文档”。

#### 本地安装到 Cursor / Claude Code / Codex（Windows cmd）

已经 clone 了本仓库、想把技能装到多个工具的用户级目录（Skills 格式），在仓库根目录运行：

```bat
install-local.cmd                 :: 装到全部三个工具
install-local.cmd claude          :: 仅 Claude Code
install-local.cmd cursor codex    :: 仅指定工具（可组合）
```

按 Skills 目录格式（`目录 + SKILL.md`，含 `reference.md`/`examples.md`/`assets`）复制到：

| 工具 | 用户级目录 |
|------|-----------|
| Claude Code | `%USERPROFILE%\.claude\skills\<name>\` |
| Cursor（≥1.6） | `%USERPROFILE%\.cursor\skills\<name>\` |
| Codex | `%USERPROFILE%\.codex\skills\<name>\`（安装副本的 `SKILL.md` 无 BOM） |

不下载、直接从当前仓库复制；可重复运行（覆盖同名技能，不动其他技能）。装完重启对应工具加载。

> ⚠️ **关于 Cursor 的重复加载**：Cursor（除自己的 `~/.cursor/skills`）还会「为兼容」从 `~/.claude/skills`、`~/.codex/skills`、`~/.agents/skills` 一并加载技能。所以**若三处都装，Cursor 里同一技能可能出现多份**。只想给 Cursor 用时，装一处即可（如 `install-local.cmd claude`，Cursor 会自动读到）；Codex 只读自己的 `~/.codex/skills`，需要 Codex 时务必带上 `codex`。

## 工作流

```
dev-doc → AI 执行 → 跑测试 → review-fix 生成审查清单 → review-check 多 AI 审查 → review-fix 汇总修复 → code-reading → 人工 review → 提交
```

详细步骤见 [docs/workflow-guide.md](docs/workflow-guide.md)

## HTML 看板

每次运行 `dev-doc`、`bug-fix`、`code-reading` 或 `biz-flow` 后，AI 会自动将本次记录追加到项目的 `project-html/data/changes.js`（同一文档重复运行会更新既有条目，不会产生重复记录），并运行 `node project-html/build.js` 刷新单页与索引。`review-fix` 默认先生成审查任务包；只有在贴回 review 结果并生成修复交接文档时，才登记到看板。
看板为多文件结构（外壳 / 样式 / 逻辑 / 数据分离），方便长期堆叠记录与自定义样式：

```
project-html/
  index.html               外壳（浏览器直接打开，无需服务器）
  css/board.css            样式（纸面编辑部风格）
  js/board.js              渲染逻辑（两级树 / 浏览索引 / 接口索引 / Bug / 阅读 / 业务流视图），内含 BOARD_VERSION
  js/vendor/mermaid.min.js 本地 mermaid（内网可用，加载失败自动走 CDN）
  build.js                 构建脚本（Node，无依赖）：生成单页 + 文档总索引 + 首次历史归档
  data/changes.js          数据（skill 只追加/更新这个文件）
  pages/<slug>.html        每条记录的自包含单页（build.js 生成，可单独发给别人）
```

直接用浏览器打开 `index.html` 即可查阅所有历史文档、Bug、代码地图与业务流：搜索、筛选、切换状态、跳转 md 源文档。业务流详情页支持角色入口、上下文前置条件、阶段数据变动、校验规则和涉及数据对象，适合把 App+PC、审批/驳回、扫码/回调、多表状态流转类功能单独发给测试/产品。

**单页分享**：详情页 / 浏览索引里的「📤 独立页面」指向 `pages/<slug>.html`——这是一个把样式、数据、mermaid 全部内联的自包含 HTML，单个文件即可直接发给同事/测试，无需打包整个文件夹（内网离线也能看图）。

**文档总索引**：`docs/INDEX.md` 由 `build.js` 从看板数据自动生成（每次运行刷新），按服务/模块归类所有文档，含 md 与单页链接。首次运行还会把项目根目录散落的旧 md、旧看板、接口文档**复制**（不删原件）到 `docs/archive/` 统一归档。

状态变更保存在浏览器 localStorage（按当前浏览器 + 文件路径隔离）；要让团队都看到，可让 Claude 直接修改 `data/changes.js` 中的 status 字段。
看板外壳带版本号（`BOARD_VERSION`）：skill 检测到模板版本更新时会自动升级外壳文件，数据不受影响；每次写入数据后会用 `node --check` 校验语法，避免看板白屏。

示例：[project-html/index.html](project-html/index.html)

## 适用场景

- Java Spring Boot / MVC 后端
- SVN 或 Git 版本控制
- 使用 Claude Code 或 Cursor 辅助开发

## 自定义

每个 skill 的信息槽位和文档模板放在对应的 `reference.md` 中，
安装后直接修改 `~/.claude/skills/` 下的文件适配团队需求。

信息槽位是查漏清单，不是必须逐条问完的问卷。Skill 应先从用户输入、当前代码、接口、字典和现有文档预填信息；只在答案会影响业务语义、数据状态、权限范围、接口契约、修复范围或验收标准时追问。发现需求与现有逻辑冲突时要显式写出证据和建议口径。

公共交互协议见 [skills/_shared/interaction-policy.md](skills/_shared/interaction-policy.md)。新增或修改文档/审查类 skill 时，优先引用这份协议，不要在每个 skill 里复制一套容易漂移的问答规则。

修改交互规则后运行 `node scripts/check-interaction-policy-sync.js`，确认相关 skill 都引用了共享协议。

为什么这样设计：[docs/why-dev-doc.md](docs/why-dev-doc.md) · [docs/why-code-reading.md](docs/why-code-reading.md)

## 升级

重新运行安装命令即可覆盖更新到最新版本。

