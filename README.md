# dev-workflow-skills

面向 Java 后端开发的 Claude Code / Cursor / Codex skill 集。目标不是多生成几份文档，而是把一次需求或 Bug 修复稳定推进到：

```text
方案明确 → AI 执行 → 版本控制纳管 → 验证通过 → 多 AI Review → 修复交接 → 代码地图 → 人工 Review → 提交
```

第一次使用建议先看 [docs/workflow-guide.md](docs/workflow-guide.md)。README 只说明这个仓库是什么、怎么安装、每个 skill 什么时候用。

## 你会得到什么

- 一套可执行开发工作流：完整拆分链 `dev-doc / bug-fix / biz-flow -> review-fix -> review-check -> review-repair -> code-reading`；单 AI 可用 `review-loop` 一键编排 Review 闭环。
- 一组面向 AI 执行的 Markdown 文档：明确路径、变更清单、Todo、验证命令和下一步。
- 一个项目内 HTML 看板：自动汇总开发文档、Bug、代码地图、业务流和接口变更。
- Apifox/OpenAPI 导入文件：接口新增或签名变更时，单独生成 `docs/apifox/<日期>/<任务>.openapi.yaml` 和索引。
- 统一门禁协议：每个阶段都说明当前 gate、产物、证据、下一步和失败分支。
- 一段可复制的 `Workflow Brief`：下一位 AI 先读交接块和路径索引，减少重复粘贴全文和无效 token 消耗。

## 快速开始

### 1. 安装

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

macOS / Linux / Git Bash：

```bash
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash
```

安装后重启 Claude Code / Cursor / Codex。

可选增强：如果需要 `/brainstorming`、`/chinese-code-review` 等通用辅助 skill，再安装 `superpowers-zh`：

```bash
npx superpowers-zh
```

### 2. 触发方式

不同工具调用方式不同：

| 工具 | 写法 |
|------|------|
| Claude Code | `/dev-doc 任务名`、`/review-fix docs/...` |
| Codex | `使用 dev-doc skill 给 XX 生成开发文档` |
| Cursor | 按 Cursor 当前 skill 入口调用；也可直接引用安装后的 skill 文档 |

Codex 不要输入 `/dev-doc` 或 `$dev-doc`。本仓库的 Codex 推荐入口是自然语言点名 skill，例如：

```text
使用 dev-doc skill 给“询价详情新报价标识”生成开发文档
使用 review-check skill 审查 docs/review-fix/2026-07-06/xxx-review-task.md
使用 review-repair skill 根据这些 findings 直接修复并运行验证
使用 review-loop skill 基于 docs/2026-07-06/xxx.md 审查、修复、验证并复审当前工作区
```

### 3. 选择 skill

| 你要做什么 | 用哪个 skill | 主要产物 |
|------------|--------------|----------|
| 新功能、接口变更、重构、配置变更前先定方案 | `dev-doc` | `docs/YYYY-MM-DD/<task>.md`、看板记录、可选 OpenAPI YAML |
| 记录 Bug、定位根因、制定修复边界 | `bug-fix` | `docs/bugs/YYYY-MM-DD/<bug>.md`、Bug 看板记录 |
| 给测试/产品讲清业务状态、数据流、接口顺序 | `biz-flow` | `docs/biz-flow/YYYY-MM-DD/<feature>.md`、业务流看板记录 |
| 生成多 AI Review 任务包，或汇总 findings 做修复交接 | `review-fix` | `docs/review-fix/YYYY-MM-DD/*-review-task.md`、`*-fix-handoff.md` |
| 按任务包做只读代码审查 | `review-check` | 结构化 findings，可直接贴回 `review-fix` |
| Review 后直接改代码并验证 | `review-repair` | 代码修复、测试结果、每条 finding 的关闭状态 |
| 一个 AI 一次完成审查、修复、验证和复审 | `review-loop` | SingleAgentReview 闭环结果、最新 diff、测试与未关闭 findings |
| Review 前快速理解调用链、状态机和关键代码位置 | `code-reading` | `docs/code-reading/YYYY-MM-DD/<feature>.md`、代码地图看板记录 |

## 推荐工作流

```text
dev-doc / bug-fix / biz-flow
→ AI 执行并回填结果
→ git add / svn add 纳管新增文件
→ 运行测试或接口验证
→ review-fix 生成 Review 任务包
→ review-check 做多 AI 只读审查
→ review-fix 汇总修复交接 / review-repair 直接修复
→ code-reading 生成代码地图
→ 人工 Review
→ git commit / svn commit
```

单 AI 简化路径：

```text
dev-doc / bug-fix → AI 实现并验证 → review-loop（任务包 + 审查 + 修复 + 验证 + 二次复审）→ code-reading → 人工 Review → 提交
```

`review-loop` 默认 standard，保留 review-task；小改动可显式 quick。它必须标记 `SingleAgentReview`，最多自动修复两轮，不自动 commit/push，也不替代高风险改动的多 AI 独立审查。

跨 AI / 跨 skill 交接时，优先复制上一轮输出里的 `【Workflow Brief】`、产物路径和 finding ID。不要反复粘贴完整 dev-doc、review-task、fix-handoff 或大段 diff；下一位 AI 应按 Brief 里的 `tokenHint` 读取必要文件。

关键门禁见 [skills/_shared/workflow-gates.md](skills/_shared/workflow-gates.md)：

- `Plan Gate`：文档、阻塞项、冲突、假设明确。
- `VCS Gate`：新增源码、测试、配置、OpenAPI、文档已纳入 Git/SVN。
- `Verification Gate`：测试、构建、接口或数据核对有结果。
- `Review Gate`：拆分链使用 `review-fix / review-check / review-repair`；单 AI 可使用 `review-loop` 输出审查、修复、验证和二次复审闭环。
- `Submit Gate`：最终 status/diff/test/review/doc/sensitive 检查通过。

## 产物位置

| 产物 | 路径 |
|------|------|
| 开发文档 | `docs/YYYY-MM-DD/<task>.md` |
| Bug 文档 | `docs/bugs/YYYY-MM-DD/<bug>.md` |
| 业务流文档 | `docs/biz-flow/YYYY-MM-DD/<feature>.md` |
| Review 任务包 / 修复交接 | `docs/review-fix/YYYY-MM-DD/` |
| Review 后直接修复结果 | `review-repair` 直接修改代码并在最终输出里回填结果 |
| 单 AI Review 闭环 | `review-loop` 最终输出；standard 模式另生成 `docs/review-fix/YYYY-MM-DD/*-review-task.md` |
| 代码地图 | `docs/code-reading/YYYY-MM-DD/` |
| Apifox/OpenAPI 文件 | `docs/apifox/YYYY-MM-DD/<task>.openapi.yaml` |
| Apifox/OpenAPI 索引 | `docs/apifox/INDEX.md` |
| 文档总索引 | `docs/INDEX.md` |
| HTML 看板 | `project-html/index.html` |
| 看板数据 | `project-html/data/changes.js` |
| 可单独分享的页面 | `project-html/pages/<slug>.html` |

## HTML 看板

`dev-doc`、`bug-fix`、`biz-flow`、`code-reading` 会自动登记到项目内 `project-html/data/changes.js`，并运行：

```bash
node project-html/build.js
```

看板能力：

- 按服务 / 模块组织开发文档、Bug、代码地图、业务流。
- 支持搜索、类型筛选、未完成筛选。
- 接口索引会聚合新增或签名变更的接口，并链接 OpenAPI YAML。
- 每条记录可生成独立 HTML 单页，方便发给测试、产品或同事。
- 状态标签可在浏览器本地点击切换；要让团队都看到，需要修改 `data/changes.js` 中的 `status`。

看板结构：

```text
project-html/
  index.html
  css/board.css
  js/board.js
  js/vendor/mermaid.min.js
  build.js
  board-add.js
  data/changes.js
  pages/<slug>.html
```

示例入口：[project-html/index.html](project-html/index.html)

## 安装细节

远程安装默认复制 `skills/` 到三个用户级目录：

| 工具 | 安装目录 |
|------|----------|
| Claude Code | `%USERPROFILE%\.claude\skills\<name>\` |
| Cursor >= 1.6 | `%USERPROFILE%\.cursor\skills\<name>\` |
| Codex | `%USERPROFILE%\.codex\skills\<name>\` |

只安装到某个工具：

```bash
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash -s -- codex
```

本地 checkout 安装：

```bat
install-local.cmd
install-local.cmd codex
install-local.cmd claude cursor
```

说明：

- 安装脚本复制整个 `skills/` 子树，不维护硬编码 skill 列表。
- Codex 目标会移除安装副本 `SKILL.md` 文件头 BOM，避免 frontmatter 发现失败。
- 仓库源码中的 `skills/**/*.md` 保留 UTF-8 BOM，用于兼容部分 Windows 工具读取中文。
- Cursor 可能同时读取 `~/.cursor/skills`、`~/.claude/skills`、`~/.codex/skills`、`~/.agents/skills`，多处安装会导致同名 skill 重复出现。

## 维护这个仓库

这个仓库没有传统 build。主要检查命令：

```bash
node scripts/check-all.js
node scripts/check-scripts.js
node scripts/check-board-sync.js
node scripts/check-agent-doc-sync.js
node scripts/check-docs.js
node scripts/check-skill-metadata.js
node scripts/check-workflow-briefs.js
node scripts/check-installers.js
node scripts/check-interaction-policy-sync.js
node scripts/check-evals.js
node project-html/build.js
git diff --check
```

维护规则：

- 改 `scripts/*.js` 时，运行 `node scripts/check-scripts.js`，确认脚本语法、shebang 和 strict mode。
- 改看板外壳时，同步 `project-html/` 和 `skills/dev-doc/assets/board/`。
- 改仓库级 agent 指南时，先改 `AGENTS.md`，再同步 `CLAUDE.md`，并运行 `node scripts/check-agent-doc-sync.js`。
- 改 README、workflow-guide 或共享工作流文档时，运行 `node scripts/check-docs.js`，确认入口文档仍覆盖所有 skill 和关键门禁。
- 改 skill 入口、`reference.md`、`evals.json` 或 `agents/openai.yaml` 时，运行 `node scripts/check-skill-metadata.js` 和 `node scripts/check-evals.js`。
- 改 `Workflow Brief` 模板时，运行 `node scripts/check-workflow-briefs.js`，确认每个交接块仍有标准字段。
- 改安装脚本时，运行 `node scripts/check-installers.js`，确认三端目标和 Codex 去 BOM 逻辑仍在。
- 改 `board.js`、`build.js`、`board-add.js`、`index.html`、`css` 时，按需提升 `BOARD_VERSION`。
- 文档/审查类 skill 的少问、证据预填、冲突暴露规则来自 [skills/_shared/interaction-policy.md](skills/_shared/interaction-policy.md)。
- 开发阶段门禁来自 [skills/_shared/workflow-gates.md](skills/_shared/workflow-gates.md)。
- 跨 AI / 跨 skill 的轻量交接格式来自 [skills/_shared/workflow-brief.md](skills/_shared/workflow-brief.md)。
- 各 skill 完成后的下一步串联映射（谁→下一步+可复制命令）来自 [skills/_shared/workflow-chain.md](skills/_shared/workflow-chain.md)。
- 每个 skill 的 `SKILL.md` 是执行步骤权威来源；`reference.md` 是模板和输出格式。

## 自定义

安装后可以直接改目标工具的 skills 目录：

```text
~/.claude/skills/<skill-name>/
~/.cursor/skills/<skill-name>/
~/.codex/skills/<skill-name>/
```

常改的位置：

- `SKILL.md`：执行步骤、触发说明、工具约束。
- `reference.md`：问题槽位、文档模板、完成输出。
- `examples.md`：示例输出。
- `agents/openai.yaml`：Codex UI 展示名、短描述、默认提示。

各文档/审查类 skill 的完成输出末尾会追加 `【Skill 维护反馈】`。它写给维护这套 skill 的任一智能体；如果运行中发现多问、漏问、误猜需求、冲突没暴露或模板不顺手，复制这段反馈回来即可继续优化。

## 设计说明

- [docs/workflow-guide.md](docs/workflow-guide.md)：完整操作手册。
- [docs/why-dev-doc.md](docs/why-dev-doc.md)：为什么先生成开发文档。
- [docs/why-code-reading.md](docs/why-code-reading.md)：为什么 Review 前需要代码地图。
