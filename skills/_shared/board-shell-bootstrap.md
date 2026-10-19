# 看板外壳定位与发布兼容性

仅在调用方需要发布看板时读取。版本号用于提示维护更新，不是发布兼容性结论；本流程检查本次 entry 所需能力和数据格式，再交给共享发布流程。

## 执行约束

- 使用共享 Node adapter，不依赖 Bash、PowerShell、前一次终端调用的变量或固定宿主目录。
- 复制范围只有外壳、构建脚本和写入脚本。不得覆盖既有 `data/` 或 `data/details/`；Mermaid vendor 二进制复制，不读写文本。
- Adapter 优先当前 skill 树，再检查显式环境配置和已知安装根。路径不明时用 `node <workflow-fs.js> resolve-skill-file _shared scripts/board-bootstrap.js` 定位；参数用法见 `help`。

## 只读检查

`node <board-bootstrap.js 绝对路径> status <项目根目录>`

- `BOARD_SHELL_INIT_REQUIRED`：尚无看板，在已授权发布范围内初始化。
- `BOARD_SHELL_INCOMPLETE`：列出缺失文件；先判断是否影响本次写入、构建或展示，再决定修复。
- `BOARD_SHELL_UPGRADE_AVAILABLE`：模板版本较新，仅提示可升级；兼容时沿用现有外壳。
- `BOARD_SHELL_CURRENT` / `BOARD_SHELL_VERSION_UNKNOWN`：版本不落后或无法识别；仍检查本次所需能力，不据版本号声称已验证兼容。
- `BOARD_TEMPLATE_ERROR`：保留错误，不手改数据绕过。

对已有看板，先只读核对写入脚本能接受本轮 entry 包装及字段、保留已有记录和生命周期，构建器与页面能读取它产生的数据格式；不把模板的非必要新功能当作发布前提。需要使用旧脚本未确认的选项时先读参数分支，不试跑未知的 `--help` 或 `--check-migration`。

明确缺少本次必需能力或数据格式不兼容时，说明缺口、证据和会替换的外壳文件，再按下面的 `sync` 修复；仅版本不同不自动升级。无法判断兼容性，或用户范围排除了必需升级时，报告 `BoardPublishBlocked` 并保留主方案，不猜测、不强制覆盖。外观和非必要维护升级留给单独任务；不要为每次发布新增确认环节。

## 初始化或必要修复

`node <board-bootstrap.js 绝对路径> sync <项目根目录>`

仅初始化、已证实的发布不兼容修复或明确授权的维护升级使用。模板须能保留现有数据语义；更高版本不向旧模板降级。同步复制 index、CSS、board.js、Mermaid vendor、build.js、board-add.js；仅目标缺失时创建空目录数据与 .gitignore，保留详情与已有忽略规则。成功输出 `BOARD_SHELL_SYNCED=<版本>`。升级可能改变派生页，报告实际构建影响，不把批量重建混作单条业务更新。

## 数据格式

确认现有脚本支持后，才运行 `node project-html/board-add.js --check-migration`：

- `BOARD_DATA_CURRENT`：继续写入。
- `BOARD_DATA_MIGRATION_REQUIRED`：在本次已授权范围内运行 `--migrate`，再检查为 CURRENT；保留原目录备份、记录与治理状态，不从 md 摘录正文。
- 不支持该选项：只读检查旧数据与当前写入器；能完整承载本轮 entry 就沿用原发布路径，必须迁移却无此能力才构成不兼容。
- 检查或迁移失败：停止后续写入与构建，保留证据，不覆盖旧数据。
