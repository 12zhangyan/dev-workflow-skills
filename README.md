# dev-workflow-skills

Claude Code skill 集，为 Java 后端开发者设计。
覆盖从需求分析到代码 Review 的完整工作流。

## 包含的 Skills

| Skill | 用途 |
|-------|------|
| `/dev-doc` | 问答式生成开发文档 + 自动维护 HTML 知识库 |
| `/code-reading` | Review 前生成代码地图（调用链+状态机+代码位置索引） |

## /dev-doc 能做什么

运行一次 `/dev-doc`，自动完成两件事：

**① 生成 md 开发文档**，包含：

- 需求说明（背景 / 目标 / 范围）
- API 设计与接口列表
- 技术方案（方案概述 / 核心设计 / 最小影响分析）
- 流程图（Mermaid 语法）
- 代码变更清单
- 关键实现说明
- 实现 Todo / 代码评审关注点
- **Apifox 接口规范**（OpenAPI 3.0 YAML，可直接导入 Apifox）

**② 自动追加到 `project-html/index.html`**（飞书知识库风格展示页）：

- 左侧：按服务/模块分组的文档树
- 右侧：结构化文档详情（需求 / 接口文档 / 技术方案 / 流程图 / 关键实现 / 代码变更）
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

## HTML 展示页

每次运行 `/dev-doc` 后，AI 会自动将本次文档追加到项目根目录的 `project-html/index.html`。
直接用浏览器打开该文件即可查阅所有历史开发文档，无需服务器。

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
