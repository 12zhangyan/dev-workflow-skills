# dev-workflow-skills

Claude Code skill 集，为 Java 后端开发者设计。
覆盖从需求分析到代码 Review 的完整工作流。

## 包含的 Skills

| Skill | 用途 |
|-------|------|
| `/dev-doc` | 问答式生成开发文档（需求→技术方案→变更清单） |
| `/code-reading` | Review 前生成代码地图（调用链+状态机+代码位置索引） |

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
写文档 → AI 执行 → 跑测试 → AI review → /code-reading → 人工 review → 提交
```

详细步骤见 [docs/workflow-guide.md](docs/workflow-guide.md)

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
