# Agent 宿主能力

仅在宿主工具、路径或执行方式影响任务时读取。共享 Skill 面向具备所需能力的 Agent，不绑定厂商、模型或固定工具名；宿主支持标准格式不代表所有模式都已实测。

- 用宿主现有能力读取、搜索、打补丁和执行终端；先读后写，保留无关改动。
- 识别实际 shell 后选择兼容命令，不把 Bash、PowerShell 或 cmd 示例原样发送给不兼容终端。
- 宿主有结构化提问时可使用，否则普通聊天即可；非交互任务不等待。
- 宿主允许且用户或适用规则已授权委派时，可并行处理独立切片；工具存在不等于获得委派授权。按可独立验收的结果划分子任务，给必要证据和写入范围；共享状态有写冲突或协调成本超过收益时保留单 Agent。主 Agent 避免重复派工，负责整合和最终验证。
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

`file-state` 区分 `MISSING / EXISTS_READABLE / EXISTS_UNREADABLE_OR_UNKNOWN`；`detect-vcs` 返回实际 `git / svn / none` owner，只检查目录是否存在；返回 `svn` 时不执行任何 `svn` 命令。助手不可定位时用当前宿主的等价能力并报告降级，不写死用户目录，也不复制未经适配的 shell 命令。

按实际能力适配：只读分析需要读取/搜索；持久产物需要范围内写入；真实验证需要执行命令或等价运行能力；委派是可选项。缺少某项只限制依赖它的路径，不要求安装特定宿主。工具名、UI、shell 和模型可变，任务授权、产物语义与证据标准不变。
