# 看板外壳定位与发布兼容性

仅在调用方需要发布看板时读取。外壳落后于模板时默认先升级到模板版本再发布；本流程完成外壳升级与数据格式检查，再交给共享发布流程。

## 执行约束

- 使用共享 Node adapter，不依赖 Bash、PowerShell、前一次终端调用的变量或固定宿主目录。
- 复制范围只有外壳、构建脚本和写入脚本。不得覆盖既有 `data/` 或 `data/details/`；Mermaid vendor 二进制复制，不读写文本。
- Adapter 优先当前 skill 树，再检查显式环境配置和已知安装根。路径不明时用 `node <workflow-fs.js> resolve-skill-file _shared scripts/board-bootstrap.js` 定位；参数用法见 `help`。

## 只读检查

`node <board-bootstrap.js 绝对路径> status <项目根目录>`

- `BOARD_SHELL_INIT_REQUIRED`：尚无看板，在已授权发布范围内初始化。
- `BOARD_SHELL_INCOMPLETE`：列出缺失文件；先判断是否影响本次写入、构建或展示，再决定修复。
- `BOARD_SHELL_UPGRADE_AVAILABLE`：模板版本较新；在本次发布授权内按下方 `sync` 升级外壳，再进入数据格式检查。
- `BOARD_SHELL_CURRENT`：外壳不低于当前模板版本，已具备模板的写入、迁移检查与构建能力；跳过下方逐项核对，直接进入数据格式检查。
- `BOARD_SHELL_VERSION_UNKNOWN`：版本无法识别，按下方逐项核对本次所需能力，不据版本号声称已验证兼容。
- `BOARD_TEMPLATE_ERROR`：保留错误，不手改数据绕过。

升级前用 VCS 查看 `project-html/` 下的外壳文件（不含 `data/`）：已纳管且有未提交的本地修改时，不覆盖，报告冲突文件并按下段沿用旧外壳；用户明确要求本次不升级看板时同样沿用。未纳管或没有 VCS 时照常升级：`sync` 会把内容有差异的旧外壳文件备份到 `project-html/.shell-backup/v<旧版本>-<时间>/`，报告备份路径与被替换文件。

沿用旧外壳或版本无法识别时，先只读核对写入脚本能接受本轮 entry 包装及字段、保留已有记录和生命周期，构建器与页面能读取它产生的数据格式。需要使用旧脚本未确认的选项时先读参数分支，不试跑未知的 `--help` 或 `--check-migration`。

版本无法识别但明确缺少本次必需能力或数据格式不兼容时，说明缺口、证据和会替换的外壳文件，再按下面的 `sync` 修复。无法判断兼容性，或用户范围排除了必需升级时，报告 `BoardPublishBlocked` 并保留主方案，不猜测、不强制覆盖。升级不新增确认环节。

## 初始化、升级或必要修复

`node <board-bootstrap.js 绝对路径> sync <项目根目录>`

用于初始化、外壳落后时的默认升级、已证实的发布不兼容修复或明确授权的维护。只替换外壳文件，从不覆盖 `data/`；更高版本不向旧模板降级（`BOARD_SHELL_DOWNGRADE_REFUSED`）。同步复制 index、CSS、board.js、Mermaid vendor、build.js、board-add.js；仅目标缺失时创建空目录数据与 .gitignore，保留详情与已有忽略规则。成功输出 `BOARD_SHELL_SYNCED=<版本>`。升级后报告升级前后版本与替换的外壳文件；升级可能改变派生页，报告实际构建影响，不把批量重建混作单条业务更新。

## 数据格式

`BOARD_SHELL_CURRENT`、刚初始化或刚 `sync` 后直接运行；旧外壳确认现有脚本支持后，才运行 `node project-html/board-add.js --check-migration`：

- `BOARD_DATA_CURRENT`：继续写入。
- `BOARD_DATA_MIGRATION_REQUIRED`：在本次已授权范围内运行 `--migrate`，再检查为 CURRENT；保留原目录备份、记录与治理状态，不从 md 摘录正文。
- 不支持该选项：只读检查旧数据与当前写入器；能完整承载本轮 entry 就沿用原发布路径，必须迁移却无此能力才构成不兼容。
- 检查或迁移失败：停止后续写入与构建，保留证据，不覆盖旧数据。
