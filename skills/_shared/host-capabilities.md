# 三端宿主能力协议

本协议供 Claude Code、Cursor、Codex 共用。Skill 正文只描述语义能力，不假设宿主暴露了某个固定工具名。

## 能力映射

- **读取/搜索**：使用当前宿主可用的文件读取、目录枚举和文本搜索能力。
- **文件修改**：使用当前宿主可用的补丁或文件编辑能力；先读后写，保留无关改动。
- **终端执行**：使用当前宿主当前会话实际提供的终端；先识别 PowerShell、cmd、POSIX shell，再选择兼容命令。
- **结构化提问**：宿主提供结构化提问能力时优先使用；否则直接在聊天中提出一个最小阻塞问题。非交互任务不得等待提问。
- **Agent 委派**：只有宿主实际提供子 Agent/任务委派能力且用户授权时使用；否则在当前 Agent 内完成。

不得因为说明中出现 Claude Code、Cursor 或 Codex 就臆造相应工具。工具不可用时显式说明降级方式和未覆盖风险。

Mode 或参考资料中的 `bash` / `powershell` 命令块只代表该 shell 下的等价示例，不是宿主契约。实际终端不匹配时，必须按本协议翻译为当前 shell 的等价操作；不得把 POSIX 重定向、`test`、`rm`、`cp`、`grep` 或 PowerShell cmdlet 原样发送给不兼容的终端。能由共享 Node 助手或宿主文件能力完成的确定性操作，优先使用这两者。

## 跨平台确定性操作

日期和目录创建使用共享 Node 助手，不依赖 `date`、`mkdir -p` 或 PowerShell 专属语法：

```text
node <已解析的 _shared/scripts/workflow-fs.js 绝对路径> prepare-date-dir <基础目录>
```

助手输出创建后的仓库相对目录，例如 `docs/bugs/2026-07-24`。从当前 Skill 所在目录定位同级 `_shared/scripts/workflow-fs.js`；若宿主不暴露 Skill 绝对路径，再依次检查已安装的 Claude Code、Cursor、Codex skills 根。助手不可定位时，使用当前宿主的文件能力创建目录，并在结果中记录降级，不复制未经适配的 shell 命令。

判断文件是否存在使用同一助手：

```text
node <helper> exists <路径>
```

输出严格为 `EXISTS` 或 `MISSING`。

其他跨平台确定性操作：

```text
node <helper> detect-vcs [起始目录]
node <helper> resolve-skill-file <skill 名> <skill 内相对路径>
node <helper> contains <文件> <文本>
node <helper> file-state <文件>
```

`detect-vcs` 输出 `{"type":"git|svn|none","root":"..."}`；后续 Git/SVN 命令应把该根目录作为工作目录。`resolve-skill-file` 先解析当前 skill 树，再检查三端与通用安装目录，避免在正文里写死某一宿主的用户目录。`file-state` 输出 `MISSING`、`EXISTS_READABLE` 或 `EXISTS_UNREADABLE_OR_UNKNOWN`，用于所有可能覆盖既有产物的路径冲突门禁。

## 稳定契约

三端必须保持一致：

- Skill 与 mode 路由；
- 只读/可写授权边界；
- 产物目录、Workflow Brief 和 finding ID；
- Blocked、InsufficientMaterial、Verification Gate 等门禁语义。

允许不同：

- UI 展示元数据；
- 工具实际名称；
- 用户调用入口（自然语言、菜单或斜杠命令）；
- 终端类型与路径格式。
