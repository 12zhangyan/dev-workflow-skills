# dev-workflow-skills

Claude Code skill 集，为 Java 后端开发者设计。
覆盖从需求分析到代码 Review 的完整工作流。

## 包含的 Skills

| Skill | 用途 |
|-------|------|
| `/dev-doc` | 问答式生成开发文档 + 自动维护 HTML 知识库 |
| `/bug-fix` | 记录 Bug、自动搜代码定位根因、生成修复文档并追加到 HTML 看板 |
| `/code-reading` | Review 前生成代码地图（调用链+状态机+代码位置索引），并登记到 HTML 看板 |
| `/biz-flow` | 把一组接口捋成**面向测试**的业务逻辑方案（业务流转图+数据流图+时序图+测试关注点），登记到 HTML 看板 |

## /dev-doc 能做什么

运行一次 `/dev-doc`，自动产出**两份分工不同的文档**：md 给 AI 执行，看板给人看。

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

- 左侧：**微服务 → 模块**两级文档树，顶部支持**搜索** + **文档/Bug/阅读类型筛选** + **仅看未完成**
- 右侧：结构化文档详情（需求 / 接口文档 / 技术方案 / 流程图 / 关键实现 / 代码变更），每条记录可一键打开 **md 源文档**
- **📊 浏览索引**：首页汇总统计 + 最近更新 + 按服务/模块归类的全量索引
- **🔌 接口索引**：聚合所有记录的接口变更，单独成页（仅登记新增或参数有变动的接口）
- **状态可点击切换**：点详情页状态标签即可推进（草稿→进行中→已完成 / Bug：未修复→修复中→已修复→已验证），保存在浏览器本地，无需重跑 skill
- 底部：HTML 变更日志时间轴（Mermaid 图表支持）

## 安装

完整工作流需要安装两个 skill 包：

### 第一步：安装 superpowers-zh（提供 brainstorming、code-review 等通用 skill）

```bash
npx superpowers-zh
```

### 第二步：安装 dev-workflow-skills（提供 dev-doc、code-reading）

**macOS / Linux / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash
```

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

重启 Claude Code 后生效，在任意项目中使用 `/dev-doc` 或 `/code-reading`。

## 工作流

```
/dev-doc → AI 执行 → 跑测试 → AI review → /code-reading → 人工 review → 提交
```

详细步骤见 [docs/workflow-guide.md](docs/workflow-guide.md)

## HTML 看板

每次运行 `/dev-doc`、`/bug-fix`、`/code-reading` 或 `/biz-flow` 后，AI 会自动将本次记录追加到项目的 `project-html/data/changes.js`（同一文档重复运行会更新既有条目，不会产生重复记录），并运行 `node project-html/build.js` 刷新单页与索引。
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

直接用浏览器打开 `index.html` 即可查阅所有历史文档、Bug、代码地图与业务流：搜索、筛选、切换状态、跳转 md 源文档。

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

每个 skill 的问题集和文档模板放在对应的 `reference.md` 中，
安装后直接修改 `~/.claude/skills/` 下的文件适配团队需求。

为什么这样设计：[docs/why-dev-doc.md](docs/why-dev-doc.md) · [docs/why-code-reading.md](docs/why-code-reading.md)

## 升级

重新运行安装命令即可覆盖更新到最新版本。
