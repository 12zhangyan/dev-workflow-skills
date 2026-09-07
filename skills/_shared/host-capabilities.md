# 三端宿主能力

仅在 Claude Code、Cursor、Codex 的工具或路径差异会影响执行时读取。Skill 描述语义能力，不猜固定工具名。

- 用宿主现有能力读取、搜索、打补丁和执行终端；先读后写，保留无关改动。
- 识别实际 shell 后选择兼容命令，不把 Bash、PowerShell 或 cmd 示例原样发送给不兼容终端。
- 宿主有结构化提问时可使用，否则普通聊天即可；非交互任务不等待。
- 有子 Agent/任务能力且切片独立时可主动并行，数量由收益、可用容量和写冲突决定。委派不扩大用户授权，主 Agent 负责整合、冲突处理和最终验证。
- 工具不可用时说明实际降级和未覆盖风险，不臆造调用或结果。

Windows 终端读取 Skill Markdown 时显式按 UTF-8 解码；乱码先修正读取方式，不得据此改写源文件。

## 跨平台助手

需要日期目录、文件状态、VCS owner 或 Skill 内资源定位时，优先解析当前 Skill 树中的 `_shared/scripts/workflow-fs.js`：

```text
node <helper> prepare-date-dir <基础目录>
node <helper> file-state <路径>
node <helper> detect-vcs [起始目录]
node <helper> resolve-skill-file <skill 名> <相对路径>
node <helper> contains <文件> <文本>
```

`file-state` 区分 `MISSING / EXISTS_READABLE / EXISTS_UNREADABLE_OR_UNKNOWN`；`detect-vcs` 返回实际 `git / svn / none` owner。助手不可定位时用当前宿主的等价能力并报告降级，不写死用户目录，也不复制未经适配的 shell 命令。

三端可以有不同工具名、UI、调用入口、shell 和路径格式，但 Skill 路由、授权边界、产物语义及证据标准保持一致。
