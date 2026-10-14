# dev-workflow-skills

面向软件开发 Agent 的通用工作流 Skill 集，保留 Java 后端场景的经验与示例。目标不是多生成几份文档，而是让 Agent 根据风险和证据自主把需求或 Bug 推进到：

```text
目标/约束/验收明确 → 可验收切片实施 → 真实验证 → 按风险独立 Review/修复 → 人工验收
```

持续优化目标：Skill 越来越轻，只保留必要目标、边界与验收；Agent 越来越强，自主决定取证、拆分、实现、测试、Review 和验收。优化本 Skill 集时，只要切片独立且不会产生写冲突，可以按收益使用全部可用子 Agent 容量并行分析、实现和复核；并行数量不是流程要求，最终结论仍由主 Agent 依据证据整合。

第一次使用建议先看 [docs/workflow-guide.md](docs/workflow-guide.md)。README 只说明这个仓库是什么、怎么安装、每个 skill 什么时候用。

## 你会得到什么

- 一套只有 4 个公开入口的开发工作流：`yan-dev-doc`、`yan-project-analysis`、`yan-code-review`、`yan-conversation-handoff`。低频相邻场景收进显式 mode，避免把 9 个名称同时暴露给 agent。
- 一套不绑定厂商或模型的共享行为内核：具备所需能力的 Agent 复用相同路由、授权、产物与证据标准，工具名、终端和调用方式由宿主适配。
- 一组面向 AI 执行的 Markdown 文档：明确目标、边界、可验收工作切片、证据和下一目标，同时把实现组织、并行方式与非关键判断留给执行 Agent。
- 一个项目内 HTML 看板：自动汇总开发文档、Bug、代码地图、业务流和接口变更。
- Apifox/OpenAPI 导入文件：接口新增或签名变更时，单独生成 `docs/apifox/<日期>/<任务>.openapi.yaml` 和索引。
- 统一证据边界：按任务判断所需的方案、实现、验证与 Review 证据，不强制串行经过全部 Gate，也不要求普通答复填写固定回执。
- 按需保留一份 `Workflow Brief`：仅在跨 Agent、跨任务或延期恢复时生成最小证据索引；当前 Agent 可以继续或任务已完成时，不额外制造交接。

## 快速开始

### 1. 安装

以下维护脚本将完整 Skill 集安装到 `~/.agents/skills`，包括共享资源。旧宿主目录保持只读。

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

macOS / Linux / Git Bash：

```bash
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash
```

安装后按当前宿主方式刷新 Skill 目录或开启新会话。自动发现路径由宿主决定；本仓库仅维护 `~/.agents/skills`，需要时可直接引用其中的 `SKILL.md`。

本仓库四个公开 Skill 自包含运行，不依赖外部方法论 Skill。需求澄清、测试策略、问题定位、完成前验证和 reviewer 选择由当前 Agent 根据证据与风险自主完成。

### 2. 触发方式

不同工具调用方式不同：

| 工具 | 写法 |
|------|------|
| Claude Code | `/yan-dev-doc 任务名`；其余入口用自然语言点名 skill 与 mode |
| Codex | `使用 yan-dev-doc skill 给 XX 生成开发文档` |
| Cursor | 按 Cursor 当前 skill 入口调用；也可直接引用安装后的 skill 文档 |
| 其他 Agent | 通过其实际支持的 Skill 入口调用，或明确提供 `~/.agents/skills/<名称>/SKILL.md` 的实际路径 |

通用核心不限定上表宿主。仓库内自动评测适配器目前仅覆盖 Claude Code、Cursor、Codex；适配器存在、命令可用、真实场景通过是不同证据。Gemini CLI、Copilot、OpenCode、OpenHands 及自定义 Agent 按能力使用；本仓库尚未逐一验证它们的自动发现、执行和权限行为。

Codex 不要输入 `/yan-dev-doc` 或 `$yan-dev-doc`。本仓库的 Codex 推荐入口是自然语言点名 skill，例如：

```text
使用 yan-dev-doc skill 给“询价详情新报价标识”生成开发文档
使用 yan-code-review skill，mode=check，审查 docs/review-fix/2026-07-06/xxx-review-task.md
使用 yan-code-review skill，mode=repair，根据这些 findings 直接修复并运行验证
使用 yan-code-review skill，mode=loop，基于 docs/2026-07-06/xxx.md 审查、修复、验证并复审当前工作区
```

### 3. 选择 skill

| 你要做什么 | 用哪个 skill | 主要产物 |
|------------|--------------|----------|
| 明确要求先出开发方案，或高风险决策必须先评审 | `yan-dev-doc` | 核心产物为 md，落盘后默认同步看板档案；契约变化时按需生成 OpenAPI |
| 分析项目：incident 记录 Bug；business 梳理测试业务流；understanding 理解调用链或做零写入影响分析 | `yan-project-analysis` | 沿用 `docs/bugs`、`docs/biz-flow`、`docs/code-reading` 路径；按目标只加载一个 mode |
| 审查代码：package 组织多 AI；check 只读审查；repair 按 findings 修复；loop 单 AI 闭环 | `yan-code-review` | 任务包、结构化 findings、修复与验证结果；按授权边界只加载一个 mode |
| 把当前对话交给另一段 AI 对话继续 | `yan-conversation-handoff` | `docs/handoffs/YYYY-MM-DD/<task>-handoff.md` |

旧名称仍可作为迁移别名理解：`bug-fix / biz-flow / code-reading` 分别映射到 `yan-project-analysis` 的 `incident / business / understanding`；`review-fix / review-check / review-repair / review-loop` 分别映射到 `yan-code-review` 的 `package / check / repair / loop`。安装器默认执行干净替换：先将这些已知旧名称移出公开发现入口，再清理本发行版的现行 Skill，最后复制新版。

## 推荐工作流

按当前证据选择最小组合：需求未决时由当前 Agent 先澄清或写方案；目标与验收已清楚时直接实施和验证；复杂逻辑是否测试先行、问题如何定位、是否需要独立 reviewer，都由 Agent 按风险决定。只有理解复杂调用链确有收益时才生成代码地图。

不要求每个任务走完整链路。范围和验收清楚时，当前 Agent 可以直接实施并验证；复杂任务按独立结果切片，在既有授权内并行委派。需要多视角 Review 时使用 `yan-code-review mode=package`：任务授权与宿主规则允许委派时直接组织只读 reviewers 并汇总；委派不可用且需要外部继续时才留下便携任务包。代码地图和修复交接只在需要时生成；已落盘的方案与分析文档默认同步看板。

`yan-project-analysis mode=business` 的默认终点是测试设计；需要进入开发时，目标与验收已清楚且用户已授权就直接实施。只有用户要求方案或关键决策尚未裁决时，才进入 `yan-dev-doc`。

单 Agent 常见路径：

```text
目标与验收已清楚 → 实现并验证 → 按风险人工验收或 yan-code-review mode=loop → 用户决定是否提交
```

`yan-code-review mode=loop` 是状态驱动的单 Agent 闭环：先只读审查，有 accepted finding 才修复；代码变化后执行目标验证并基于最新 diff 聚焦复审。它不因风险高自动生成任务包或调用多 Agent；需要多角色独立审查或任务包时直接选择 `package`。未跟踪文件仍纳入范围；按项目规则应纳管的关键文件未纳管时不能宣称 Review/Submit 通过，本地专用产物不因此阻塞。loop 仅在需要区分审查方式时标记 `SingleAgentReview`；无进展时停止，不为凑轮次继续，也不自动 commit/push。

跨 AI / 跨 skill 交接时，接收方能访问仓库就只给主产物路径，让它读取文档末尾的 `【Workflow Brief】`；无法访问同一文件系统时才复制该块。`next` 表达当前下一目标，可包含互不覆盖的并行动作；接手方先读 `evidence` 中能裁决该目标的最小充分证据，遇到缺口或冲突再扩展。不要反复粘贴完整 yan-dev-doc、review-task、fix-handoff 或大段 diff。

如果需要把当前整段对话的结论、已做动作、验证、风险和接手提示落成独立文档，使用 `yan-conversation-handoff`。它将已证实、推断和待确认分开；`Workflow Brief` 仍只是最小索引，不能代替原始证据。

Brief 只在接口产物影响接手时写 `api`，只在 VCS owner、未跟踪或提交状态影响下一步时写 `vcs`；没有信息增益的字段省略。旧 Brief 字段仍可读取，新产物使用精简格式。

关键门禁见 [skills/_shared/workflow-gates.md](skills/_shared/workflow-gates.md)：

- `Plan Gate`：文档、阻塞项、冲突、假设明确。
- `VCS Gate`：按项目规则应纳管的新增源码、测试、配置及正式产物已纳入 Git/SVN；明确排除或仅本地保留的文档不因此阻塞，也不构成 add/commit 授权。
- `Verification Gate`：测试、构建、接口或数据核对有结果。
- `Review Gate`：使用 `yan-code-review` 的 `package / check / repair` 拆分模式，或用 `loop` 输出单 AI 审查、修复、验证和二次复审闭环。
- `Submit Gate`：最终 status/diff/test/review/doc/sensitive 检查通过。

## 产物位置

| 产物 | 路径 |
|------|------|
| 开发文档 | `docs/YYYY-MM-DD/<task>.md` |
| Bug 文档 | `docs/bugs/YYYY-MM-DD/<bug>.md` |
| 业务流文档 | `docs/biz-flow/YYYY-MM-DD/<feature>.md` |
| Review 任务包 / 修复交接 | `docs/review-fix/YYYY-MM-DD/` |
| Review 后直接修复结果 | `yan-code-review mode=repair` 直接修改代码并在最终输出里回填结果 |
| 单 AI Review 闭环 | `yan-code-review mode=loop` 的精简 ReviewReceipt；默认不生成中间任务包 |
| 代码地图 | `docs/code-reading/YYYY-MM-DD/` |
| 对话移交文档 | `docs/handoffs/YYYY-MM-DD/<task>-handoff.md` |
| Apifox/OpenAPI 文件 | `docs/apifox/YYYY-MM-DD/<task>.openapi.yaml` |
| Apifox/OpenAPI 索引 | `docs/apifox/INDEX.md` |
| 文档总索引 | `docs/INDEX.md` |
| HTML 看板 | `project-html/index.html` |
| 看板轻量目录 | `project-html/data/changes.js` |
| 看板人类方案详情 | `project-html/data/details/<detailId>.js` |
| 轻量详情页面 | `project-html/pages/<slug>.html` |
| 按需导出的单文件 | `project-html/exports/<slug>.html` |

## HTML 看板

看板默认自动发布：`yan-dev-doc` 方案、`yan-project-analysis` 的 CodeMap / incident / business 文档实际落盘后，都会创建或更新对应的“一事一档”记录；项目尚无 `project-html/` 时自动初始化。`yan-code-review` 的 package/repair/loop 在 `deliveryId` 或来源方案 `docPath` 能匹配已有档案时自动同步审查/修复事件，匹配不到时不新建孤立记录；check 默认零写入。ImpactAnalysis 与会话交接从不写看板。任何一次请求里说“不要看板”即可跳过。MD 是 Agent 执行文档；看板是独立的人类方案与 Gate 证据说明，不截取 MD。`board-add.js` 将输入拆为 `data/changes.js` 轻量目录和 `data/details/` 详情，再运行：

```bash
node project-html/build.js
```

看板能力：

- 按服务 / 模块组织开发文档、Bug、代码地图、业务流。
- 默认按工作台 / 待办库 / 档案库分层，支持搜索、类型和未完成筛选。
- 首页只加载轻量目录，点击记录后才加载对应的人类方案详情；旧富记录可执行 `node project-html/board-add.js --migrate` 迁移。
- 正式外壳采用 A 方案“研发变更档案馆”：一条记录串联方案、实现、验证、Review、提交五个 Gate；旧记录按 Plan 阶段兼容显示。
- `board-add.js` 按 `deliveryId` / `sourceDocPath` / `docPath` 定位主档案，并按稳定 `eventId` 幂等合并 Review 事件。
- 接口索引会聚合新增或签名变更的接口，并链接 OpenAPI YAML。
- 每条记录生成引用共享资源的轻量详情页；需要单文件发送时运行 `node project-html/build.js --standalone <docPath|slug>` 按需导出。
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
  data/details/<detailId>.js
  pages/<slug>.html
  exports/<slug>.html  # 仅 --standalone 时生成
```

示例入口：[project-html/index.html](project-html/index.html)

## 安装细节

共用 Skill 只维护在 `~/.agents/skills/<name>/`；仓库专用 Skill 放项目 `.agents/skills/`。当前安装器的默认与唯一可写目标为 `agents`，完整复制四个公开入口及 `_shared`，不创建宿主副本或链接，也不复制 Cursor/Codex 内置技能。

包管理命令约定为 `npx skills add <pkg> -g -a agents`，不能省略 `-a agents` 或替换为宿主目录。2026-09-23 检查的 `skills 1.7.0` 尚不支持 `agents` 目标，且会跳过本仓库保留 BOM 的入口。直接使用该 CLI 安装本仓库目前未验证可用；本仓库维护脚本是安装到同一共用目录的明确替代方式，测试在隔离用户目录运行。

旧 `claude / cursor / codex` 参数仅供 `status / doctor / backups` 只读诊断；写入类命令会提前拒绝。已有旧副本的迁移或清理需要另行确定范围与授权。

生产或团队环境建议固定 tag/commit，并校验对应归档的 SHA-256；脚本本身也应从同一 ref 下载：

```bash
REF=v1.2.3
SHA256=<该 ref 的 tar.gz SHA-256>
curl -fsSL "https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/${REF}/install.sh" |
  bash -s -- --ref "$REF" --sha256 "$SHA256" agents
```

Windows PowerShell 等价写法：

```powershell
$ref = "v1.2.3"
$sha256 = "<该 ref 的 zip SHA-256>"
$installer = irm "https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/$ref/install.ps1"
& ([scriptblock]::Create($installer)) -Ref $ref -Sha256 $sha256 -Targets agents
```

本地 checkout 安装：

```bat
install-local.cmd
install-local.cmd agents
install-local.cmd status codex
install-local.cmd --dry-run
install-local.cmd status
install-local.cmd doctor
install-local.cmd backups agents
install-local.cmd restore --backup SNAPSHOT_ID --skill yan-dev-doc agents
install-local.cmd backup-prune --keep 5 --dry-run agents
install-local.cmd backup-prune --keep 5 agents
```

说明：

- 安装器依赖 Node.js，复制整个 `skills/` 子树，不维护硬编码 skill 列表。
- 共用目录写入 schema v2 的 `.yan-dev-workflow-skills.json`，用于记录来源版本、安装模式、受管 Skill 和安装哈希；schema v1 会在下一次安装时校验并迁移，未知或损坏的清单会显式阻止破坏性替换。`status` 会报告 `CURRENT / DRIFT / OUTDATED / UNMANAGED`。
- 每次安装先在发现目录之外 staging 并校验全部新版 Skill，再通过共用目录锁执行切换；激活或清单写入失败会回滚本轮安装；若恢复失败，保留尚未恢复的原文件并报告恢复目录。清单采用临时文件 + rename 原子替换。
- 切换时彻底清理本发行版的现行 Skill、清单中已下线的 Skill 和已知旧名称；确认未修改的受管副本在成功后删除，首次纳管、无法确认归属或含本地修改的目录保留在 `~/.yan-dev-workflow-skills-backups/agents/<snapshot-id>/`。无关 Skill 和旧 `.yan-backups/` 不动。
- `--dry-run` 只输出 `REMOVE / BACKUP / INSTALL` 计划；`backups` 列出快照，`restore` 可恢复整个快照或通过 `--skill` 恢复单个 Skill，`backup-prune --keep N` 显式保留最近 N 份。恢复历史 Skill 后 `status` 报告 `DRIFT` 属于预期行为。
- `--migrate-legacy` 仅作为兼容参数保留，并输出弃用警告；干净替换已默认清理旧名称。
- 远程脚本支持 `--ref <tag|commit>` 与 `--sha256 <archive hash>`；只提供 `--ref` 可固定版本，同时提供摘要可在解压和执行安装核心前校验下载内容。
- 共用 agents 目标由 Node 安装器确定性移除安装副本 `SKILL.md` 文件头 BOM；无法完成时安装直接失败，不再静默跳过。
- 仓库源码中的 `skills/**/*.md` 保留 UTF-8 BOM，用于兼容部分 Windows 工具读取中文；Windows PowerShell 5.1 读取其他无 BOM 的 UTF-8 文档时，请显式使用 `Get-Content -Encoding UTF8`。
- 共用目录与旧宿主目录同时存在同名 Skill 时，诊断将其列为重复；安装不会自动迁移、清理旧目录。
- `doctor` 默认检查 `agents / claude / cursor / codex` 四个目录，输出 `ROOT` / `MANIFEST`、旧宿主 `LEGACY_ROOT` 和同名 `DUPLICATE`。重复副本不再视作预期镜像；它不迁移、不删除、不覆盖。

## 维护这个仓库

这个仓库没有传统 build。主要检查命令：

```bash
node scripts/check-all.js
node scripts/check-scripts.js
node scripts/check-board-sync.js
node scripts/check-board-behavior.js
node scripts/check-agent-doc-sync.js
node scripts/check-docs.js
node scripts/check-skill-inventory.js
node scripts/check-skill-metadata.js
node scripts/check-portable-contracts.js
node scripts/check-route-loading.js
node scripts/check-route-loading.js --report
node scripts/check-host-eval-runner.js
node scripts/run-host-evals.js --probe
node scripts/check-workflow-briefs.js
node scripts/check-review-boundaries.js
node scripts/check-document-boundaries.js
node scripts/check-installers.js
node scripts/check-interaction-policy-sync.js
node scripts/check-evals.js
node project-html/build.js
node scripts/check-git-diff.js
```

`check-review-boundaries.js` 和 `check-document-boundaries.js` 校验的是高风险行为护栏，不是普通文案 lint；如果 Skill 正文等价改写了相关规则，要在同一轮同步更新脚本里的关键短语。

维护规则：

- 改 `scripts/*.js` 时，运行 `node scripts/check-scripts.js`，确认脚本语法、shebang 和 strict mode。
- `node scripts/check-git-diff.js` 同时检查工作区、暂存区、HEAD，以及可解析到的 PR/push/`origin/main` 提交范围；GitHub Actions 必须使用完整历史，不能用干净 checkout 上的空 `git diff --check` 冒充提交范围检查。
- 行为回归套件覆盖全部正式 Skill 的关键触发、权限、副作用、证据与验收边界；以必要场景标签和契约断言证明覆盖，不设置鼓励重复案例的总数量门槛。
- 改看板外壳时，同步 `project-html/` 和 `skills/yan-dev-doc/assets/board/`。
- 改仓库级 agent 指南时，先改 `AGENTS.md`，再同步 `CLAUDE.md`，并运行 `node scripts/check-agent-doc-sync.js`。
- 改 README、workflow-guide 或共享工作流文档时，运行 `node scripts/check-docs.js`，确认入口文档仍覆盖所有 skill 和关键门禁。
- 改 skill 入口、实际运行资源、`evals.json` 或 `agents/openai.yaml` 时，运行 `node scripts/check-skill-metadata.js` 和 `node scripts/check-evals.js`。
- 改 `Workflow Brief` 模板时，运行 `node scripts/check-workflow-briefs.js`，确认每个交接块仍有标准字段。
- 改宿主适配、公开入口或 mode 时，运行 `node scripts/check-portable-contracts.js`；它验证 Claude Code、Cursor、Codex 共享的路由、写入边界、`yan-` 命名和跨平台文件操作契约。该检查是离线静态契约，不替代真实模型评测。
- 改入口、mode 或其直引资料时，同步 [route-loading-contracts.json](skills/_shared/route-loading-contracts.json) 并运行 `node scripts/check-route-loading.js`；它逐路由校验允许的直接 Markdown 资料、选择/条件 guard、兼容索引、eval 绑定和资源字符预算，禁止矛盾式全量预读以及根路由绕过 mode。`node scripts/check-route-loading.js --report` 输出当前入口体积、直引数量和预算利用率基线；字符数是静态回归指标，不冒充模型 token 实测。
- `node scripts/run-host-evals.js --preflight --host codex --case <场景> --workspace <Git 根目录>` 离线预检配置、技能资源、干净提交基线、`required_fixture_paths` 声明的必要文件和结果路径，只读文件与 Git，不启动宿主、克隆、运行评分器、下载依赖或联网。报告分为 `verified / invalid / unresolved`；发现无效项退出 1，凭据、服务和忽略的依赖保持未验证，不能当作模型结果。`--output` 仅校验目的地，预检报告始终输出到 stdout。真实运行自动复用预检；脏工作区须先在独立夹具保留需要测试的内容，不自动提交或清理原项目。
- `node scripts/run-host-evals.js --probe` 只探测 Claude Code、Cursor Agent、Codex CLI 与安装清单，不调用模型。真实抽样显式传 `--live --host <host> --case <场景> --workspace <Git 工作区>`；运行器在临时 Git clone 中执行，并把当前 checkout 的 `skills/` 复制到 clone 内 Git 忽略的只读评估目录，避免宿主沙箱访问用户目录，也不改传入工作区。可写场景还必须传 `--allow-write`，并校验声明的写入范围、中文路径下的目标产物内容、路由、退出状态与工作区漂移；副作用检查比较前后 HEAD、语义索引、受保护 Git 元数据和文件哈希，包含忽略文件及 Skill 快照；已提交改动和快照篡改也会失败。检查只证明最终状态差异，不能证明没有短暂写入或外部副作用，不能代替宿主沙箱。文本正反向断言只代表输出信号，仍需人工核对业务语义；声明了 outcome verifier 的场景另对实际实现执行独立行为检查（当前为分页 fixture），评分器也不得改工作区。结果保留声明产物的路径、大小和 SHA-256；单文件不超过 64 KiB、总计不超过 256 KiB 时同时保留正文，超限或产物缺失明确注明，不凭空补全文本。宿主诊断仅保留有界首尾摘要。
- 自然触发用 `--invocation catalog|native`，样例为 `natural-review-selection` 和 `natural-no-skill-control`。`catalog` 只提供四个入口的发现元数据，让 Agent 自选或不选，适用于三个宿主适配器；它验证目录内选择，不能证明宿主自动发现。`native` 把快照安装到隔离 clone 的 `.agents/skills`，按安装约定去入口 BOM；任务不点名技能或路由，当前仅 Codex 适配器支持以完成的 JSON 命令事件核验入口读取。回执必须指向本次快照；只自报、读失败或读用户目录都不算原生发现通过。命令识别是针对该 fixture 的证据检查，不是任意 shell 的安全审计。
- 新旧版本比较可传 `--skill-source <旧版完整 skills 目录>`，任务与评分器保持当前版本。快照排除 eval 答案和契约评分文件；结果记录 Skill/任务/评分契约/评分器指纹、fixture revision、宿主版本、入口、模型和 reasoning effort。Codex 比较时显式固定 `--model <模型> --effort <强度>`；用 `node scripts/compare-host-evals.js <old.json> <new.json>` 检查记录条件是否一致，默认模型、缺少条件、不同 grader 或宿主进程未完成会拒绝比较。相同记录条件不能排除未记录的宿主配置和服务波动；一组通过样例只支持未见回归，不能宣称总体提升。
- 最小加载 live 案例为 `review-check-minimal-loading`、`analysis-incident-minimal-loading`、`handoff-minimal-loading`、`dev-doc-compact-minimal-loading`。它们要求宿主自报实际打开的 `LOADED_RESOURCES`（不等同于独立工具调用审计），校验必需/禁止资料和资源数上限，并在 JSON 结果记录耗时、输出字符数、加载资料数与 Skill 快照来源。不可用宿主只能报告 probe 状态，不能用静态检查冒充 live 结果。宿主失败、超时或输出截断错误时，JSON 的 `assessment.passed` 与退出码一致判为失败，即使输出满足文本断言。
- `dev-doc-autonomous-plan` 是可写能力案例：它验证已裁决的跨前后端需求能保留请求、响应、过滤与错误语义，并形成可验收结果、真实依赖和并行关系；不要求固定 WP 数、文件分层、角色人数、字段措辞或 Workflow Brief。
- 改安装脚本时，运行 `node scripts/check-installers.js`；它在隔离用户目录安装共用 agents 副本，验证共享依赖、dry-run、事务回滚、并发锁、schema 迁移、备份列表/恢复/保留、归档摘要校验、漂移检测、`SKILL.md` 去 BOM、旧目录写入拒绝及重复诊断。
- 改 `board.js`、`build.js`、`board-add.js`、`index.html`、`css` 时，按需提升 `BOARD_VERSION`。
- 文档/审查类 skill 的少问、证据预填、冲突暴露规则来自 [skills/_shared/interaction-policy.md](skills/_shared/interaction-policy.md)。
- 开发阶段门禁来自 [skills/_shared/workflow-gates.md](skills/_shared/workflow-gates.md)。
- 跨 AI / 跨 skill 的轻量交接格式来自 [skills/_shared/workflow-brief.md](skills/_shared/workflow-brief.md)。
- 跨 Skill 的 finding、Review 与验证状态语义来自 [skills/_shared/workflow-chain.md](skills/_shared/workflow-chain.md)；它不规定下一步矩阵，Agent 按当前证据自主选择动作。
- 每个 skill 的 `SKILL.md` 是执行步骤权威来源；只保留有运行价值的聚焦资源，不为兼容索引本身创建文件。
- 每个入口/mode 的直引资料白名单、`always / routed / conditional / index_only` 加载策略、eval suite/tag 和字符预算以 [route-loading-contracts.json](skills/_shared/route-loading-contracts.json) 为准；新增资料必须先说明进入条件，不得把 examples 或模式模板升级为无差别必读。

## 自定义

仅在共用目录维护用户级副本；优先修改仓库源文件并经验证后更新安装：

```text
~/.agents/skills/<skill-name>/
```

常改的位置：

- `SKILL.md`：执行步骤、触发说明、工具约束。
- `yan-dev-doc/SKILL.md` 直接承载自适应方案与交付标准；仅契约或看板发布再加载对应协议。
- 示例只在能补足模板无法表达的关键边界时保留，不作为目录标配。
- `agents/openai.yaml`：Codex UI 展示名、短描述、默认提示。

文档/审查类 skill 默认不输出维护反馈。只有运行中确实暴露规则缺口，或评测显式设置 `EvaluationMode=true` 时，才追加 `【Skill 维护反馈】`，避免污染正常业务交付。

## 设计说明

- [docs/workflow-guide.md](docs/workflow-guide.md)：完整操作手册。
- [GitHub 同类 Skill 参考与优化验证](docs/research/2026-10-10-skill-benchmarks.md)：首轮高星仓库来源与新旧对照。
- [更多示例与行为验证](docs/research/2026-10-10-more-examples.md)：新增 6 个仓库、18 份参考材料、相邻反例与隔离实测。
- [跨 Agent 的论文与评测优化](docs/research/2026-10-10-agent-literature.md)：截至 2026-10-10 的一手文献、能力适配、来源边界及行为评分。
- [docs/why-yan-dev-doc.md](docs/why-yan-dev-doc.md)：为什么先生成开发文档。
- [docs/why-code-reading.md](docs/why-code-reading.md)：什么时候代码地图能帮助理解复杂实现。
