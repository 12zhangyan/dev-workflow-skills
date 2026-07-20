# Skill Iteration State

当前迭代：第 54 / 1000 轮（按用户要求结束优化）

## 当前状态

- 状态：第 54 轮已完成；本轮收尾后停止，不再进入下一轮
- 仓库：`dev-workflow-skills`
- 分支：`main...origin/main`
- 最近基线时间：2026-07-19 01:37 Asia/Shanghai
- Skill 数量：9 个正式 Skill，1 个 `_shared` 公共规则目录
- 文件类型：Markdown、JSON eval、YAML agent metadata、Node.js scripts、Shell/PowerShell/cmd installers、HTML/CSS/JS board assets
- 基线校验：`node scripts/check-all.js` 通过

## 已识别 Skill

- `biz-flow`
- `bug-fix`
- `code-reading`
- `conversation-handoff`
- `dev-doc`
- `review-check`
- `review-fix`
- `review-loop`
- `review-repair`

## 当前风险

- 工作区启动时已有大量未提交修改和新增文件；这些改动视为用户或前序任务工作，不得回滚或覆盖。
- 后续迭代应优先选择未被现有 dirty diff 触碰的文件，或在修改已变更文件前先读取 diff 并明确边界。
- Windows PowerShell 5.1 在 CP936 下会把无 BOM UTF-8 文档按本地 ANSI 解码；`skills/**/*.md` 已统一带 BOM，读取其他 Markdown 时使用 `Get-Content -Encoding UTF8` 或 Node.js UTF-8 读取。

## 最近验证结果

```text
node scripts/check-all.js
ok all checks passed
```

包含：
- script checks passed (15 scripts)
- board sync and syntax checks passed (BOARD_VERSION = 23)
- board behavior checks passed
- AGENTS.md and CLAUDE.md are in sync
- documentation checks passed (113 maintained local links)
- skill inventory checks passed (9 skills)
- skill metadata checks passed (9 skills, 32 markdown files)
- Workflow Brief checks passed (9 skills)
- review/document boundary checks passed；Windows 明确跳过 POSIX board-shell 行为 smoke
- installer checks and Windows local smoke passed
- interaction policy references are in sync
- evals checks passed (9 skills, 141 scenarios)
- project-html/build.js completed
- git diff --check passed with line-ending warnings only

## 迭代日志

### 第 1 / 1000 轮

- 本轮发现的问题：缺少长期自治迭代状态文件，无法可靠恢复轮次、待办、基线和风险边界。
- 本轮修改内容：新增 `.agent/` 下的状态、质量报告、待办列表。
- 修改文件：
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-quality-report.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-all.js` 通过；`git status --short --branch` 显示本轮仅新增 `.agent/`，其余 dirty 文件为启动前已存在。
- 是否产生新问题：未发现。注意 `git diff -- .agent` 不显示未跟踪文件，后续查看 `.agent/` 内容需直接读文件或先纳入版本控制。
- 下一轮候选任务：从 `skill-backlog.md` 中选择最高优先级且不覆盖已有 dirty diff 的项目。

### 第 2 / 1000 轮

- 本轮发现的问题：工作区启动时已有大量 dirty 文件，后续若无基线会难以判断变更归属。
- 本轮修改内容：新增 dirty worktree baseline，记录受保护文件和后续修改规则。
- 修改文件：
  - `.agent/dirty-worktree-baseline.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-all.js` 通过；Node.js UTF-8 读取 `.agent/dirty-worktree-baseline.md`、`.agent/skill-iteration-state.md`、`.agent/skill-backlog.md` 正常；`git status --short --branch` 仅新增 `.agent/` 属于本 Agent。
- 是否产生新问题：未发现。仍保留 Git 全局 ignore 权限 warning 和行尾 warning 为既有环境噪声。
- 下一轮候选任务：抽样检查 README/AGENTS/CLAUDE 与实际 Skill 清单和 agent metadata 的同步关系。

### 第 3 / 1000 轮

- 本轮发现的问题：Skill 清单、核心文档引用和 OpenAI agent metadata 的一致性检查分散在多个脚本中，缺少一个可单独运行的 inventory 视图。
- 本轮修改内容：新增只读脚本 `scripts/check-skill-inventory.js`，扫描 Skill 目录、frontmatter、`agents/openai.yaml` 和核心文档引用。
- 修改文件：
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-skill-inventory.js` 通过；`node scripts/check-skill-inventory.js` 通过并输出 9 个 Skill；`node scripts/check-scripts.js` 通过且识别 13 个脚本；`node scripts/check-all.js` 通过。
- 是否产生新问题：未发现。注意新增脚本尚未接入 `scripts/check-all.js`，当前仅作为独立校验和被 `check-scripts.js` 做语法检查。
- 下一轮候选任务：评估是否将 `scripts/check-skill-inventory.js` 接入 `scripts/check-all.js`；若修改 dirty baseline 文件，先读取 `scripts/check-all.js` 当前 diff。

### 第 4 / 1000 轮

- 本轮发现的问题：`scripts/check-skill-inventory.js` 未接入全量校验入口，默认 `node scripts/check-all.js` 无法覆盖 inventory 语义检查。
- 本轮修改内容：在 `scripts/check-all.js` 的 `check-docs.js` 之后插入 `check-skill-inventory.js`。
- 修改文件：
  - `scripts/check-all.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-all.js` 通过，输出确认执行 `node scripts/check-skill-inventory.js`；`git diff -- scripts/check-all.js` 显示本轮新增 inventory 入口，启动前已有 `check-board-behavior.js` 入口保持不动。
- 是否产生新问题：未发现。
- 下一轮候选任务：分析 review 系 Skill 边界，重点检查 review-check/review-repair/review-loop 是否有触发歧义。

### 第 5 / 1000 轮

- 本轮发现的问题：Review Gate 四个 Skill 的高风险边界主要靠人工维护，缺少自动校验防止后续改动删掉只读/可写/停机/循环上限规则。
- 本轮修改内容：新增 `scripts/check-review-boundaries.js`，并接入 `scripts/check-all.js`。
- 修改文件：
  - `scripts/check-review-boundaries.js`
  - `scripts/check-all.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-review-boundaries.js` 通过；首次运行发现 review-loop 匹配短语过窄，已调整为现有正文的反引号写法；`node scripts/check-review-boundaries.js` 通过；`node scripts/check-all.js` 通过并执行该校验。
- 是否产生新问题：未发现。新增脚本绑定的是高风险边界短语，后续若正文重写但语义保留，应同步调整脚本。
- 下一轮候选任务：检查 non-review 文档类 Skill 是否都有失败分支和停止条件校验。

### 第 6 / 1000 轮

- 本轮发现的问题：`conversation-handoff` 缺少与其他文档类 Skill 一致的非交互/无人值守入口级停机规则。
- 本轮修改内容：在共享协议下补充非交互分支，要求边界/证据/路径/权限/高风险确认不足时输出 `Blocked` / `NeedsConfirmation`，不猜测、不覆盖。
- 修改文件：
  - `skills/conversation-handoff/SKILL.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：BOM 检查通过；新增非交互规则存在；`node scripts/check-skill-metadata.js`、`node scripts/check-workflow-briefs.js`、`node scripts/check-evals.js`、`node scripts/check-all.js` 均通过；diff 仅新增一段共享协议规则。
- 是否产生新问题：未发现。
- 下一轮候选任务：为文档类 Skill 增加自动边界校验，防止后续删掉非交互停机、看板安全或零写入规则。

### 第 7 / 1000 轮

- 本轮发现的问题：文档类 Skill 的关键安全边界已有正文规则，但缺少自动校验防止后续漂移。
- 本轮修改内容：新增 `scripts/check-document-boundaries.js`，校验文档类 Skill 的非交互停机、看板安全、零写入、敏感信息和 Workflow Brief 边界，并接入 `scripts/check-all.js`。
- 修改文件：
  - `scripts/check-document-boundaries.js`
  - `scripts/check-all.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-document-boundaries.js` 通过；首次运行发现两处匹配过窄，已对齐现有正文和 `code-reading/reference.md`；`node scripts/check-document-boundaries.js` 通过；`node scripts/check-all.js` 通过并执行该校验。
- 是否产生新问题：未发现。新增脚本依赖关键边界短语，未来 Skill 正文重写时需同步维护。
- 下一轮候选任务：检查 eval 场景是否覆盖新增边界，优先补缺失的非交互/无人值守场景。

### 第 8 / 1000 轮

- 本轮发现的问题：`conversation-handoff` 新增的非交互/无人值守入口级停机规则缺少 eval 场景和必需 tag 守护。
- 本轮修改内容：新增 eval id=11，覆盖无人值守模式下边界不清和目标文件冲突时输出 `Blocked` / `NeedsConfirmation`；`scripts/check-evals.js` 要求 conversation-handoff 具备 `non_interactive_blocker` tag。
- 修改文件：
  - `skills/conversation-handoff/evals.json`
  - `scripts/check-evals.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`skills/conversation-handoff/evals.json` JSON 解析通过，场景数为 11 且包含 `non_interactive_blocker`；`node scripts/check-evals.js` 通过（9 skills, 131 scenarios）；`node scripts/check-all.js` 通过；diff 仅追加 eval 和必需 tag。
- 是否产生新问题：未发现。
- 下一轮候选任务：检查新增脚本是否需要 README/AGENTS 脚本清单同步；若已有同步检查覆盖则记录无需处理。

### 第 9 / 1000 轮

- 本轮发现的问题：新增校验脚本已进入 `check-all.js`，但 README/AGENTS/CLAUDE 的脚本清单缺少这些单项入口。
- 本轮修改内容：同步 README 命令块和 AGENTS/CLAUDE Individual checks 说明，加入 `check-skill-inventory.js`、`check-review-boundaries.js`、`check-document-boundaries.js`，并补 `check-board-behavior.js` 的说明。
- 修改文件：
  - `README.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-agent-doc-sync.js` 通过；`node scripts/check-docs.js` 通过；`node scripts/check-skill-inventory.js` 通过；`node scripts/check-all.js` 通过。diff 中 README/AGENTS/CLAUDE 的看板说明大段变化为启动前已有 dirty 改动，本轮只同步脚本清单相关文本。
- 是否产生新问题：未发现。
- 下一轮候选任务：让 `check-docs.js` 也守护 README 脚本清单，避免未来再次遗漏。

### 第 10 / 1000 轮

- 本轮发现的问题：README 已同步新增校验脚本，但 `scripts/check-docs.js` 未要求这些命令存在，文档清单仍可能漂移。
- 本轮修改内容：将 `check-board-behavior.js`、`check-skill-inventory.js`、`check-review-boundaries.js`、`check-document-boundaries.js` 加入 README 必需文本。
- 修改文件：
  - `scripts/check-docs.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-docs.js` 通过；`node scripts/check-docs.js` 通过；`node scripts/check-all.js` 通过；diff 仅新增 README 必需脚本名。
- 是否产生新问题：未发现。
- 下一轮候选任务：检查脚本清单是否可从 `check-all.js` 自动推导，减少维护双写；若收益不足则记录暂缓。

## 暂停记录

- 当前完成轮次：第 10 / 1000 轮
- 暂停原因：已完成一个可审查 checkpoint；工作区启动前已有大量未提交修改，继续扩大到更多 dirty 文件前应先让用户审查当前新增脚本、文档清单和 `conversation-handoff` 规则。
- 已完成的主要改进：建立 `.agent` 长期状态；记录 dirty baseline；新增并接入 skill inventory、review boundary、document boundary 三类校验；补强 `conversation-handoff` 非交互停机规则及 eval；同步 README/AGENTS/CLAUDE 和 `check-docs.js`。
- 尚未完成的问题：可评估 `check-docs.js` 是否从 `check-all.js` 自动推导脚本清单；可继续抽样 eval 覆盖和边界脚本抗重写能力。
- 建议的下一步：用户审查当前 diff 后，继续第 11 轮处理 `SQ-012` 或先整理/提交已有工作区改动。
- 是否需要用户确认：建议确认后继续，尤其是是否允许继续修改启动前已有 dirty 文件。

### 第 11 / 1000 轮

- 本轮发现的问题：README 脚本清单与 `check-docs.js` 仍存在双写维护；未来 `check-all.js` 新增检查后可能再次遗漏 README。
- 本轮修改内容：`check-docs.js` 改为读取 `scripts/check-all.js`，自动解析检查命令并要求 README 维护命令块包含对应命令。
- 修改文件：
  - `scripts/check-docs.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-docs.js` 通过；`node scripts/check-docs.js` 通过；`node scripts/check-all.js` 通过；diff 仅新增从 `scripts/check-all.js` 自动推导 README 命令清单的逻辑。
- 是否产生新问题：未发现。若未来 `check-all.js` 的 `checks` 数组结构大改，`check-docs.js` 会显式报 `no parseable check entries`。
- 下一轮候选任务：抽样检查 `agents/openai.yaml` 的 default_prompt 是否与 SKILL.md 路由边界一致。

### 第 12 / 1000 轮

- 本轮发现的问题：`review-repair/agents/openai.yaml` 的 `default_prompt` 强调按 findings 修复，但未明确“只想审查/找问题应路由到 review-check”，与 `SKILL.md` 的入口边界相比不够完整。
- 本轮修改内容：补充 `review-repair` UI prompt 的 review-check 路由边界；在 `check-skill-inventory.js` 中加入该边界的回归校验。
- 修改文件：
  - `skills/review-repair/agents/openai.yaml`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-skill-inventory.js` 通过；`node scripts/check-skill-metadata.js` 通过；`node scripts/check-all.js` 通过。tracked diff 显示 `review-repair/agents/openai.yaml` 仅补充 UI prompt 路由边界；`scripts/check-skill-inventory.js` 仍为未跟踪新增脚本，已由命令验证。
- 是否产生新问题：未发现。
- 下一轮候选任务：继续抽样 `conversation-handoff` / `biz-flow` 的 OpenAI UI prompt 是否需要路由边界，或记录无需处理。

### 第 13 / 1000 轮

- 本轮发现的问题：`conversation-handoff` 和 `biz-flow` 的 SKILL 正文写了相邻 Skill 分工，但 OpenAI UI `default_prompt` 未体现这些路由边界。
- 本轮修改内容：为 `conversation-handoff` 补充 dev-doc/bug-fix/review-fix/review-check/review-repair 路由；为 `biz-flow` 补充 dev-doc/code-reading/review-check/review-fix 路由；在 inventory 校验中守住这些关键词。
- 修改文件：
  - `skills/conversation-handoff/agents/openai.yaml`
  - `skills/biz-flow/agents/openai.yaml`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-skill-inventory.js` 通过；`node scripts/check-skill-metadata.js` 通过；`node scripts/check-all.js` 通过。tracked diff 仅显示两个 `agents/openai.yaml` 的 prompt 路由句，未改执行正文。
- 是否产生新问题：未发现。
- 下一轮候选任务：检查 `agents/openai.yaml` 是否需要 YAML 结构更严格的引号/缩进校验。

### 第 14 / 1000 轮

- 本轮发现的问题：`check-skill-metadata.js` 对 OpenAI metadata 的单行 scalar 只取值，不检查开头引号是否闭合。
- 本轮修改内容：新增 raw scalar 和去引号函数；当 `display_name`、`short_description`、`default_prompt` 以单/双引号开头但未用同类引号闭合时显式失败。
- 修改文件：
  - `scripts/check-skill-metadata.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-skill-metadata.js` 通过；`node scripts/check-skill-metadata.js` 通过；`node scripts/check-all.js` 通过；diff 仅增强 scalar 引号闭合校验。
- 是否产生新问题：未发现。
- 下一轮候选任务：检查 `check-skill-inventory.js` 是否也需要复用相同 scalar 校验逻辑，避免两个 metadata 解析口径不一致。

### 第 15 / 1000 轮

- 本轮发现的问题：`check-skill-inventory.js` 解析 `agents/openai.yaml` 时仍直接剥离首尾引号，未检查引号闭合，与 metadata 校验口径不一致。
- 本轮修改内容：在 inventory 脚本中增加同类 `unquoteYamlScalar()`，解析 `interface` block 字段时检查单/双引号闭合。
- 修改文件：
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-skill-inventory.js` 通过；`node scripts/check-skill-inventory.js` 通过；`node scripts/check-all.js` 通过。由于 `scripts/check-skill-inventory.js` 仍是未跟踪新增文件，普通 `git diff` 不展示其内容，但 `check-scripts` 和 `check-all` 已执行覆盖。
- 是否产生新问题：未发现。
- 下一轮候选任务：检查新增校验脚本自身是否有最小负例或自测需求；收益不足则暂缓。

### 第 16 / 1000 轮

- 本轮发现的问题：metadata scalar 引号闭合校验只有当前仓库正例验证，没有最小负例自测。
- 本轮修改内容：`check-skill-metadata.js` 和 `check-skill-inventory.js` 增加 `--self-test`，覆盖 plain/quoted/unbalanced quoted scalar；`check-scripts.js` 调用两个 self-test。
- 修改文件：
  - `scripts/check-skill-metadata.js`
  - `scripts/check-skill-inventory.js`
  - `scripts/check-scripts.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-skill-metadata.js --self-test` 通过；`node scripts/check-skill-inventory.js --self-test` 通过；`node scripts/check-scripts.js` 通过并调用两个 self-test；`node scripts/check-all.js` 通过。
- 是否产生新问题：未发现。`scripts/check-skill-inventory.js` 是未跟踪新增脚本，普通 tracked diff 不展示其 self-test 改动。
- 下一轮候选任务：检查 review/document boundary 脚本是否需要说明其关键短语约束，避免未来误删时不理解失败原因。

### 第 17 / 1000 轮

- 本轮发现的问题：边界校验脚本失败信息只写 `missing boundary text`，没有说明这些短语代表行为护栏，维护者可能误判为普通文案约束。
- 本轮修改内容：将 review/document boundary 脚本的缺失提示改为 `missing behavior guardrail text`，并提示保留等价规则或同步脚本。
- 修改文件：
  - `scripts/check-review-boundaries.js`
  - `scripts/check-document-boundaries.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-review-boundaries.js` 通过；`node scripts/check-document-boundaries.js` 通过；`node scripts/check-scripts.js` 通过；`node scripts/check-all.js` 通过。
- 是否产生新问题：未发现。
- 下一轮候选任务：检查 README/AGENTS 是否需要说明新增 boundary 脚本是行为护栏而非普通文案 lint；若已有说明足够则暂缓。

### 第 18 / 1000 轮

- 本轮发现的问题：维护文档列出了 boundary 脚本，但没有明确这些检查是高风险行为护栏，不是普通文案 lint。
- 本轮修改内容：README 增加中文维护说明；AGENTS/CLAUDE 增加同步英文说明，要求等价改写时同步对应脚本。
- 修改文件：
  - `README.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-agent-doc-sync.js` 通过；`node scripts/check-docs.js` 通过；`node scripts/check-all.js` 通过。
- 是否产生新问题：未发现。
- 下一轮候选任务：检查 `check-docs.js` 是否需要守护这句 boundary check 维护说明，避免说明再次丢失。

### 第 19 / 1000 轮

- 本轮发现的问题：README 的 boundary check 维护说明尚未纳入 `check-docs.js` 必需文本。
- 本轮修改内容：在 README required needles 中加入 `高风险行为护栏，不是普通文案 lint`。
- 修改文件：
  - `scripts/check-docs.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-docs.js` 通过；`node scripts/check-docs.js` 通过；`node scripts/check-agent-doc-sync.js` 通过；`node scripts/check-all.js` 通过。
- 是否产生新问题：未发现。
- 下一轮候选任务：更新 `.agent/skill-quality-report.md` 的 checkpoint 到第 19 轮，并继续从 backlog 中选择未完成高价值问题。

### 第 20 / 1000 轮

- 本轮发现的问题：第 19 轮 checkpoint 已写入质量报告，但 backlog 中 `SQ-021` 仍标为待处理；状态摘要中的 eval 场景数也停留在 130，与实际 131 不一致。
- 本轮修改内容：将 `SQ-021` 标记为已完成，同步当前轮次、checkpoint 时间和 eval 场景数。
- 修改文件：
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node scripts/check-all.js` 通过（9 skills, 131 scenarios）；首次临时状态断言因正则转义过度而误报，改用段落解析后确认当前轮次、`SQ-021` 状态和场景数一致；Git 状态核对未发现新增无关修改。
- 是否产生新问题：未发现。
- 下一轮候选任务：分析 `SQ-005`，确认 PowerShell 中文 mojibake 是终端读取方式问题还是源文件编码异常。

### 第 21 / 1000 轮

- 本轮发现的问题：Windows PowerShell 5.1 在 CP936 下默认误解码无 BOM UTF-8 文档；现有 metadata 校验只检查固定命名的 Skill Markdown，未覆盖 `_shared` 和未来新增的其他 `skills/**/*.md`。
- 本轮修改内容：将 metadata 编码校验扩展到全部 Skill Markdown，要求 UTF-8 BOM 且字节序列为有效 UTF-8；自测增加 BOM/非法 UTF-8 正反例；README 补充 PowerShell 5.1 显式 UTF-8 读取方式并由文档检查守护。
- 修改文件：
  - `scripts/check-skill-metadata.js`
  - `scripts/check-docs.js`
  - `README.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：字节审计确认 29/29 个 Skill Markdown 均带 BOM 且为有效 UTF-8；PowerShell 对比确认 README 默认读取与显式 UTF-8 不同、带 BOM 的 `SKILL.md` 相同；`node --check scripts/check-skill-metadata.js`、`--self-test`、metadata/doc 定向检查和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：未发现。仓库根文档继续保持有效 UTF-8 无 BOM，避免无依据扩大编码改动。
- 下一轮候选任务：扫描剩余 Skill 的 token/结构和 eval 覆盖，选择一个未被近期高频修改的高价值问题。

### 第 22 / 1000 轮

- 本轮发现的问题：29 个 Skill Markdown 含 93 个真实相对链接/锚点，但现有全量检查不验证它们；文件或标题重命名可能让 Agent 的渐进加载入口失效。
- 本轮修改内容：`check-docs.js` 新增 fenced code block 感知的本地链接和 GitHub 风格锚点校验，支持四反引号中嵌套三反引号模板及重复标题后缀；新增 parser 自测并由 `check-scripts.js` 调用；同步 AGENTS/CLAUDE 的单项检查说明。
- 修改文件：
  - `scripts/check-docs.js`
  - `scripts/check-scripts.js`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：初始一次性审计命令两次因 Windows PowerShell 5.1 参数引号/反引号转义而未执行，改为仓库内 parser 后，`node --check scripts/check-docs.js`、`node scripts/check-docs.js --self-test`、`node scripts/check-docs.js`（93 links）、`node scripts/check-scripts.js`、agent 文档同步和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：发现 `dev-doc/SKILL.md` 已达 499 行，登记为 `SQ-023`，本轮未扩大处理。
- 下一轮候选任务：分析 `SQ-023`，识别 `dev-doc` 中可无损下沉或去重的内容，并以 eval/边界检查证明行为未丢失。

### 第 23 / 1000 轮

- 本轮发现的问题：`dev-doc/SKILL.md` 的核心流程和高风险门禁均有 eval 依据，不适合为减行硬删；末尾常见错误表只在异常时使用，却随每次触发加载。
- 本轮修改内容：将常见错误表原样移入 `reference.md#常见错误与恢复`，补目录入口；SKILL 主入口改为显式失败处理指令，要求异常时按需加载，未命中时报告失败且不得绕过门禁。
- 修改文件：
  - `skills/dev-doc/SKILL.md`
  - `skills/dev-doc/reference.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：主入口从 499 行/25107 字符降至 478 行/22943 字符；脚本逐行确认 21 个排障表行原样迁移；UTF-8 BOM、metadata、95 个本地链接、document boundaries、9 skills/131 evals 和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：未发现。登记 `SQ-024`，后续分析两个无 examples Skill 是否存在真实示例缺口。
- 下一轮候选任务：先分析 `code-reading` 的 CodeMap/ImpactAnalysis 双模式是否因无示例导致输出边界难以执行，再决定是否增加最小示例。

### 第 24 / 1000 轮

- 本轮发现的问题：`code-reading` 的 CodeMap/ImpactAnalysis 只有空模板与 eval 期望，没有已填示例校准“持久化阅读产物”和“聊天零写入影响分析”的差异。
- 本轮修改内容：新增两个使用同一虚构 Java 场景的短示例，分别展示证据化代码地图和契约影响分析；SKILL 仅在首次执行或模式易混淆时按对应锚点加载；同步 AGENTS/CLAUDE 资源表。
- 修改文件：
  - `skills/code-reading/examples.md`
  - `skills/code-reading/SKILL.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：首次全量检查发现示例中的 Workflow Brief 为求简短漏了 `vcs`/`api`，同时校验器抛 TypeError；补齐标准字段后，BOM、双模式关键文本、metadata（30 Markdown）、inventory、98 个本地链接、document boundaries、131 evals、Workflow Brief、agent 文档同步和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：登记 `SQ-026`（Workflow Brief 校验器缺字段时崩溃）为更高优先级；`conversation-handoff` 示例评估拆为 `SQ-025`，未在本轮扩大处理。
- 下一轮候选任务：修复 `SQ-026`，让 malformed Workflow Brief 输出完整、稳定的 FAIL 诊断而非 TypeError，并增加负例自测。

### 第 25 / 1000 轮

- 本轮发现的问题：Workflow Brief 校验器在字段顺序错误后仍假设 `tests`、`vcs`、`api`、`tokenHint` 存在，malformed 输入会抛 TypeError 并截断诊断。
- 本轮修改内容：提取返回诊断列表的纯校验函数；增加缺失、重复、未知和空字段诊断；父字段不存在时跳过对应 `.includes`，但保留缺字段失败；新增 malformed Brief 自测并接入 `check-scripts.js`。
- 修改文件：
  - `scripts/check-workflow-briefs.js`
  - `scripts/check-scripts.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：`node --check scripts/check-workflow-briefs.js` 通过；`--self-test` 同时确认 field order、missing vcs、missing api、tests missing class 四类诊断且无异常堆栈；当前 9 Skill 正例、`check-scripts.js` 和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：未发现。
- 下一轮候选任务：分析 `SQ-025`，判断 `conversation-handoff` 的事实/推断/缺口与非交互 Blocked 分支是否需要最小示例。

### 第 26 / 1000 轮

- 本轮发现的问题：`conversation-handoff` 的 reference 只有空模板，缺少已填示例展示“对话声明测试通过但当前无输出”如何分为已证实、推断、待确认，以及无人值守路径冲突如何零写入停机。
- 本轮修改内容：新增 PartiallyComplete 完整移交示例和 Blocked/NotWritten 短分支；示例包含完整 Workflow Brief、NotRun 证据口径和敏感键名脱敏；SKILL 只在首次生成或边界易混淆时按锚点加载；同步 AGENTS/CLAUDE 资源表。
- 修改文件：
  - `skills/conversation-handoff/examples.md`
  - `skills/conversation-handoff/SKILL.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
- 验证结果：两次临时断言分别因 PowerShell 吞反引号、跨文件期望混用而误报，改为分文件 `rg` 后通过；UTF-8 BOM、Workflow Brief、metadata（31 Markdown）、inventory（9/9 examples）、100 个本地链接、document boundaries、131 evals、agent 文档同步和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：登记 `SQ-027`，当前 supporting-files 清单尚未自动核对 examples 的实际存在性。
- 下一轮候选任务：分析并处理 `SQ-027`，让 inventory 确定性检查 AGENTS/CLAUDE 资源列与 examples 存在性同步。

### 第 27 / 1000 轮

- 本轮发现的问题：`check-agent-doc-sync.js` 只能证明 AGENTS/CLAUDE 内容相同，不能证明两份 Skill 表与文件系统一致；新增或删除 `examples.md` 后，两份文档可能一起漂移且全量检查仍通过。
- 本轮修改内容：为 `check-skill-inventory.js` 增加限定于 `## Skills` 区段的三列表格解析和文件系统对账；校验每个 Skill 行、精确入口、`reference.md` 声明、未知/重复行，以及 `examples.md` 声明与磁盘存在性一致；自测覆盖正常表格解析和漏写 examples 负例。
- 修改文件：
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：`node --check scripts/check-skill-inventory.js`、`--self-test`、inventory 正例、`check-agent-doc-sync.js`、`check-scripts.js` 和 `node scripts/check-all.js` 均通过；确认 9/9 Skill 的 AGENTS/CLAUDE 表格入口及 examples 声明与文件系统一致。
- 是否产生新问题：未发现；有意不把 scripts/assets 的自然语言说明纳入精确对账，避免本轮扩展为脆弱的全文清单检查。
- 下一轮候选任务：按最近优化覆盖度扫描尚未在第 20-27 轮直接优化的 review 系 Skill，优先寻找会影响 findings 追踪或停止条件的可执行性问题。

### 第 28 / 1000 轮

- 本轮发现的问题：共享 workflow chain 只列 `deferred-next-batch`，`review-repair` 最终输出只列 `deferred`，`review-loop` 的归一化又把低收益和超批次都归入 `deferred`；这与 reference 中两个状态的不同语义冲突，可能让下一位 AI 错把“不承诺后续”当成“已排入下一批”。
- 本轮修改内容：统一逐 finding 终态为 `fixed / deferred / deferred-next-batch / blocked / rejected`；明确前两种 deferred 的承诺差异；同步 review-repair、review-loop 执行步骤及 review-loop/review-fix 输出模板。
- 修改文件：
  - `skills/_shared/workflow-chain.md`
  - `skills/review-repair/SKILL.md`
  - `skills/review-loop/SKILL.md`
  - `skills/review-loop/reference.md`
  - `skills/review-fix/reference.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：五文件状态词/BOM 断言通过；`check-skill-metadata.js`、`check-docs.js`、`check-review-boundaries.js`、`check-evals.js` 和 `node scripts/check-all.js` 均通过（9 skills、31 Markdown、100 links、131 evals）。
- 是否产生新问题：未发现。现有 review-repair eval 分别覆盖普通 deferred 状态和超批次 `deferred-next-batch`，无需为同一行为重复新增场景。
- 下一轮候选任务：继续审计 review 输出契约，重点核对 `TestEvidenceStatus` 的允许值在 shared chain、各 SKILL 与 reference 模板中是否一致。

### 第 29 / 1000 轮

- 本轮发现的问题：共享链路定义 `TestEvidenceStatus` 六种完整状态，但 review-fix 的任务包/回收模板漏了 `NotRun`，review-loop 总结模板漏了 `NotApplicable`；同时 review-repair 的四状态列表没有说明是修改代码后的收敛子集，容易被误改成允许沿用 `NotProvided`。
- 本轮修改内容：补齐 review-fix 与 review-loop 模板的六状态词汇；在 shared chain 明确材料收集/只读阶段可用六种、修改代码后必须重新判定为 `Passed / Failed / NotRun / EnvironmentBlocked`；边界脚本同时守护完整集合和修复后子集。
- 修改文件：
  - `skills/_shared/workflow-chain.md`
  - `skills/review-fix/reference.md`
  - `skills/review-loop/reference.md`
  - `scripts/check-review-boundaries.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：状态集合/BOM 断言、`node --check scripts/check-review-boundaries.js`、review boundary、metadata、docs、eval 和 `node scripts/check-all.js` 均通过。一次临时 Node 断言因 PowerShell 吞反引号误报，改用 `String.fromCharCode(96)` 归一化后通过。
- 是否产生新问题：未发现。修复后四状态子集是有意门禁：无验证时写 `NotRun`，不能用 `NotProvided` 或 `NotApplicable` 绕过验证。
- 下一轮候选任务：轮换离开 review 状态词，扫描公共 Workflow Brief 的 tokenHint 与 changed 文件读取上限是否在各 Skill 输出模板中一致且可执行。

### 第 30 / 1000 轮

- 本轮发现的问题：Workflow Brief 校验器只检查各 Skill reference/examples，不检查共享协议；原子串扫描会把正文中的内联 marker 误当模板。共享/交接模板还漏了普通 `deferred`，review-repair 则把终态 `rejected` 放入 `openFindings`，会误导下一位 AI 重跑已拒绝项。
- 本轮修改内容：解析器改为只识别独立 marker 行并纳入共享协议；自测覆盖内联 marker、错误 8 文件上限和 rejected 误入 openFindings；共享与 conversation-handoff 模板补普通 deferred；review-repair 将 rejected 留在处理表，并按 blocked/next-batch/deferred 分流 nextCommand。
- 修改文件：
  - `scripts/check-workflow-briefs.js`
  - `skills/_shared/workflow-brief.md`
  - `skills/conversation-handoff/reference.md`
  - `skills/review-repair/reference.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：`node --check`、Workflow Brief `--self-test`、9 Skill + shared 正例、metadata、100 links、review boundaries 和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：未发现。普通 deferred 仍保留 ID 供追踪，但不会自动进入下一批；rejected 是终态，不再出现在未关闭列表。
- 下一轮候选任务：检查 `nextCommand` 是否存在“人工动作却写无”或引用不存在 Skill 的模板漂移，并优先用现有 Workflow Brief parser 做确定性校验。

### 第 31 / 1000 轮

- 本轮发现的问题：dev-doc 的 next 声明 EnvironmentBlocked 分支但 nextCommand 漏失；review-loop 的环境阻塞/下一批分支也无可复制命令；code-reading 让下一位 AI 自行拼接调用；校验器自测还把“人工确认 + nextCommand: 无”当合法样本。
- 本轮修改内容：补齐三个模板的环境、下一批、人工确认和具体 Skill 调用；Workflow Brief 校验新增非空人工动作、已知 Skill 名、稳定状态分支对称和模糊占位符检查；自测覆盖三类负例。
- 修改文件：
  - `scripts/check-workflow-briefs.js`
  - `skills/dev-doc/reference.md`
  - `skills/review-loop/reference.md`
  - `skills/code-reading/reference.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：Workflow Brief 脚本语法、自测、shared + 9 Skill 模板、metadata、100 links 和 `node scripts/check-all.js` 均通过。
- 是否产生新问题：未发现。校验只解析稳定英文状态标签和 `<skill-name> skill` 引用，不试图理解任意自然语言分支。
- 下一轮候选任务：轮换到仓库索引面，检查 README 的 Skill 清单是否能由文件系统确定性对账，而不是只验证“文中某处出现名称”。

### 第 32 / 1000 轮

- 本轮发现的问题：README 的“选择 skill”九行表是用户主要路由入口，但现有检查只确认名称在全文某处出现；表格漏项、重复项或已删除 Skill 残留可被其他段落提及掩盖。
- 本轮修改内容：inventory 新增 README 专用三列表解析，以文件系统正式 Skill 清单为真源校验精确一行、无重复和无未知项；自测覆盖正常两行表与漏行负例。
- 修改文件：
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：inventory 语法、自测、实际 9 Skill 对账、docs 检查和 `node scripts/check-all.js` 均通过；README 当前无需内容修改。
- 是否产生新问题：未发现。校验仅约束稳定表头和 Skill 名列，中文用途/产物文案仍可独立优化。
- 下一轮候选任务：统计 9 个 SKILL.md 的 frontmatter description 与主入口体积，选择一个触发重叠或高 token 的具体问题，不做无依据压缩。

### 第 33 / 1000 轮

- 本轮发现的问题：biz-flow 正文、OpenAI UI prompt 和 eval 已定义 dev-doc/code-reading/review-check/review-fix 分流，但 portable frontmatter description 只写正向场景；仅依赖 frontmatter 的宿主可能把开发方案、代码地图或审查任务误路由到 biz-flow。
- 本轮修改内容：在 biz-flow description 中补齐四个相邻 Skill 的选择边界；inventory 增加该 portable discovery surface 的关键词守护。
- 修改文件：
  - `skills/biz-flow/SKILL.md`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：biz-flow BOM/description 断言、metadata、inventory 自测与正例、9 个既有 biz-flow routing/边界 eval 所在全量 eval 校验，以及 `node scripts/check-all.js` 均通过。
- 是否产生新问题：未发现。description 只增加路由句，不复制执行步骤；现有 routing eval 已覆盖 dev-doc、code-reading 和 review-check 行为。
- 下一轮候选任务：检查 review-check 的 portable description 和 eval 是否能把“只读看问题”“已有 findings 直修”“单 AI 审查并修复”三类请求稳定分开。

### 第 34 / 1000 轮

- 本轮发现的问题：`review-check` 正文虽声明只读边界，但 portable frontmatter description 与 OpenAI 默认提示未完整区分已有 findings 直修、单 AI 审查修复闭环和多 AI 任务包/汇总；仅依赖 discovery surface 的宿主可能误触发只读审查。
- 本轮修改内容：frontmatter 与 UI prompt 补齐 `review-repair`、`review-loop`、`review-fix` 路由；正文相邻 Skill 列表补齐 direct repair 与 single-agent loop；新增单 AI 闭环 eval，并为已有直修 eval 增加路由标签；eval 与 inventory 校验器守护这些入口。
- 修改文件：
  - `skills/review-check/SKILL.md`
  - `skills/review-check/agents/openai.yaml`
  - `skills/review-check/evals.json`
  - `scripts/check-evals.js`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：review-check 13 个场景结构检查、metadata、inventory、eval、review boundary 定向检查均通过；`node scripts/check-all.js` 全量通过（15 个检查脚本、9 个 Skill、31 个 Markdown、100 个本地链接、132 个 eval 场景，`BOARD_VERSION = 23`）；`git diff --check` 仅报告既有 CRLF 转换提示。
- 是否产生新问题：未发现。description 仅增加相邻职责路由，不复制修复或编排步骤；新增 eval 直接覆盖最易混淆的 single-agent closure 请求。
- 下一轮候选任务：轮换离开 review discovery，扫描 `bug-fix` 或 `dev-doc` 的 portable description、UI prompt 与 eval 是否存在未守护的相邻 Skill 边界，优先选择会导致错误执行的具体缺口。

### 第 35 / 1000 轮

- 本轮发现的问题：`code-reading` portable description 未排除开发/改造方案产物，OpenAI 默认提示只路由缺陷判断，漏了实施方案、已有 findings 直修和测试/产品业务流；这些近邻请求也没有完整的路由 eval 标签。
- 本轮修改内容：description 与 UI prompt 统一 `dev-doc / review-check / review-repair / biz-flow` 边界；为既有只读找问题场景增加标签，并新增方案、直修和业务流三个近邻场景；eval 与 inventory 校验器守护四个路由。保留“先用 code-reading 收集证据、再由 dev-doc 产出方案”的组合路径。
- 修改文件：
  - `skills/code-reading/SKILL.md`
  - `skills/code-reading/agents/openai.yaml`
  - `skills/code-reading/evals.json`
  - `scripts/check-evals.js`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：metadata、inventory 自测/正例和 eval 首次通过；document boundary 首次因 description 将稳定短语“`不判断缺陷或关闭 findings`”改成顿号形式而失败，恢复原短语并独立保留“`不输出实施方案`”后通过；最终 `node scripts/check-all.js` 全量通过（9 个 Skill、31 个 Markdown、100 个本地链接、135 个 eval 场景，`BOARD_VERSION = 23`）。
- 是否产生新问题：未发现。定向失败未被绕过，稳定行为护栏已恢复且新增路由仍保留。
- 下一轮候选任务：检查 `bug-fix` 的诊断文档与 `biz-flow` 业务说明边界，尤其是“复盘线上事故业务链路”这类混合请求是否存在触发歧义；仅在能给出可验证近邻场景时修改。

### 第 36 / 1000 轮

- 本轮发现的问题：`bug-fix` 的 frontmatter 与 OpenAI 默认提示已排除只读审查、直修和开发方案，却未排除“只给测试/产品梳理正常业务流且不诊断单次故障”的请求；这类请求可能被错误要求补齐复现、根因和修复边界。
- 本轮修改内容：按主交付物增加 `bug-fix -> biz-flow` 路由，明确仅在不诊断单次故障的正常业务流场景转走；新增退款审批近邻 eval，并由 eval/inventory 校验器守护 metadata 与 UI prompt 的 `biz-flow` 入口。
- 修改文件：
  - `skills/bug-fix/SKILL.md`
  - `skills/bug-fix/agents/openai.yaml`
  - `skills/bug-fix/evals.json`
  - `scripts/check-evals.js`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：metadata、inventory 自测/正例、eval 和 document boundary 定向检查均通过；`node scripts/check-all.js` 全量通过（9 个 Skill、31 个 Markdown、100 个本地链接、136 个 eval 场景，`BOARD_VERSION = 23`）；精确 diff 确认本轮只改 discovery、eval 和守护规则。
- 是否产生新问题：未发现。事故复盘只要仍要求现象、复现、根因证据或修复边界，就继续由 bug-fix 处理，不会因包含流程说明自动转走。
- 下一轮候选任务：验证反向近邻场景：`biz-flow` 收到要求沉淀线上事故现象、复现、根因和修复边界时，portable/UI discovery 是否应明确路由 `bug-fix`。

### 第 37 / 1000 轮

- 本轮发现的问题：`biz-flow` 的 frontmatter 与 OpenAI 默认提示未排除以单次线上事故现象、复现、根因证据和修复边界为主交付物的请求；请求中只要提到业务链路，就可能误产出测试业务流文档。
- 本轮修改内容：按主交付物增加 `biz-flow -> bug-fix` 路由，明确业务链路可作为事故背景但不能替代故障诊断；新增重复扣款事故近邻 eval，并由 eval/inventory 校验器守护 metadata 与 UI prompt 的 `bug-fix` 入口。
- 修改文件：
  - `skills/biz-flow/SKILL.md`
  - `skills/biz-flow/agents/openai.yaml`
  - `skills/biz-flow/evals.json`
  - `scripts/check-evals.js`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：metadata、inventory 自测/正例、eval 和 document boundary 定向检查均通过；`node scripts/check-all.js` 全量通过（9 个 Skill、31 个 Markdown、100 个本地链接、137 个 eval 场景，`BOARD_VERSION = 23`）；精确 diff 确认本轮只增加 discovery 路由、eval 和守护规则。
- 是否产生新问题：未发现。正常业务流中即使发现实现冲突，仍可由 biz-flow 记录冲突并再分流；只有主目标是单次事故诊断/修复边界时才转 bug-fix。
- 下一轮候选任务：轮换到工程化检查，审计 `check-evals.js` 是否验证 eval ID 的唯一性、连续性或 tag 类型，优先修复可能让场景被静默覆盖/遗漏的结构缺口。

### 第 38 / 1000 轮

- 本轮发现的问题：`check-evals.js` 已正确校验正整数/重复 ID 和 tags 基本类型，原候选无需处理；但顶层 JSON 或 eval 元素为 `null`/标量/数组时会直接解引用并抛 TypeError，非法标量 tags 在报错后仍会进入 `for...of` 再次崩溃，导致稳定文件定位和后续诊断丢失。
- 本轮修改内容：提取顶层文档、单条 eval 和安全 tags 的纯结构函数；非对象返回明确 `root/eval must be an object`，非法 tags 只参与格式失败、不进入覆盖统计；空白 tags 也视为非法。新增自测覆盖 null 顶层、null/字符串/数组元素、合法项、重复 ID、空白和标量 tags，并接入 `check-scripts.js`。
- 修改文件：
  - `scripts/check-evals.js`
  - `scripts/check-scripts.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：`node --check scripts/check-evals.js`、`node scripts/check-evals.js --self-test`、当前 9 Skill/137 场景正例、`node scripts/check-scripts.js` 和 `node scripts/check-all.js` 均通过；全量检查继续包含 `git diff --check`，只有既有 CRLF 提示。
- 是否产生新问题：未发现。保留原 ID/prompt/expected_output/tags 诊断顺序和文本；仅新增 malformed 根/元素的前置诊断及空白 tag 拒绝。
- 下一轮候选任务：轮换审计其他校验器的 malformed 输入行为，优先检查 `check-skill-inventory.js` 或 `check-skill-metadata.js` 是否仍有 parser 自测未覆盖的异常崩溃路径；若已有防护则换候选。

### 第 39 / 1000 轮

- 本轮发现的问题：inventory/metadata 对缺失 frontmatter、缺表和编码错误已有显式失败，不存在原预想的异常崩溃；但 `SKILL.md` frontmatter 及 `agents/openai.yaml` 的 `interface`/`policy` 重复键会被轻量解析器静默覆盖，不同宿主 YAML 解析器可能采用不同值，造成名称、触发描述、默认提示或隐式调用策略漂移。
- 本轮修改内容：metadata 校验器新增无依赖的重复键扫描，仅检查 frontmatter 顶层键和 OpenAI 两个平面块的直接子键；重复时保留首值用于后续诊断但整体验证失败。自测覆盖重复 frontmatter、重复 interface key，以及跨 interface/policy 同名键不误报。
- 修改文件：
  - `scripts/check-skill-metadata.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：`node --check scripts/check-skill-metadata.js`、metadata `--self-test`、当前 9 Skill/31 Markdown 正例、`node scripts/check-scripts.js` 和 `node scripts/check-all.js` 均通过；确认当前仓库无重复 discovery metadata key。
- 是否产生新问题：未发现。扫描限定在项目现有单层 metadata 规范，不解释字符串内容，也不把不同 YAML 块中的同名键视为重复。
- 下一轮候选任务：轮换到安装后实际能力，审计本地安装器的三端复制范围与新增 `agents/openai.yaml` / eval/examples 资源是否有确定性 smoke test，而不继续扩展 YAML lint。

### 第 40 / 1000 轮

- 本轮发现的问题：`check-installers.js` 只匹配脚本文本和 CMD ASCII，无法证明整目录资源被复制、同名旧 Skill 被完整替换、无关用户 Skill 保留，或 Codex 仅去除 `SKILL.md` BOM。安装器回归可在静态检查全绿时漏过。
- 本轮修改内容：校验器新增跨平台隔离 smoke：Windows 在临时 `USERPROFILE` 执行真实 `install-local.cmd codex`；POSIX 构造本地 tar fixture 后执行真实 `install.sh codex`。两条路径均预置无关 Skill 和同名 stale 文件，随后逐目录树、逐文件字节对比源 `skills/`，只允许所有 `SKILL.md` 缺少源 BOM。`install.sh` 增加 `DEV_WORKFLOW_SKILLS_TARBALL` 覆盖以支持无网络 fixture；同步 README/AGENTS/CLAUDE 维护说明。
- 修改文件：
  - `install.sh`
  - `scripts/check-installers.js`
  - `README.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：Node 语法、当前 Windows 实际安装 smoke、agent 文档同步、docs 检查和 `node scripts/check-all.js` 均通过；全量输出明确为 `Windows local smoke passed`，临时目录在 finally 清理，真实用户目录未触达。POSIX 分支因本机 WSL 未安装未实际运行，代码使用 Node 生成本地 tar + `file://` URL，待 POSIX 执行环境验证。
- 是否产生新问题：发现 README 维护规则仍写“覆盖 8 个 skill”，与当前 9 个不符，登记 `SQ-041`；同时 `.github/workflows/check.yml` 只执行 board-sync、interaction-policy 和 eval 三项，新增 installer smoke 与多数全量检查尚未进入 CI，登记更高优先级 `SQ-042`。
- 下一轮候选任务：优先处理 `SQ-042`，评估把 CI 改为 `node scripts/check-all.js` 是否会安全覆盖现有三项并在 Ubuntu 实际验证 POSIX installer smoke；若属于需要用户确认的远程流程变更则暂停该项，先处理 `SQ-041`。

### 第 41 / 1000 轮

- 本轮发现的问题：GitHub Actions 的三条现有命令均已包含在 `check-all`，`check-board-sync.sh` 也只是 Node 脚本兼容包装；但 CI 未执行其余 metadata、inventory、Workflow Brief、boundary、installer、docs/build/diff 检查，PR gate 与本地成功判据不一致。
- 本轮修改内容：保留 workflow 名和 `jobs.board` 标识，避免无意改变既有分支保护 context；将三个重复子步骤替换为唯一权威入口 `node scripts/check-all.js`。`check-docs.js` 新增反向守护，CI 若移除全量入口会失败；AGENTS/CLAUDE 改为说明 check-all 同时是本地与 CI 套件，shell wrapper 仅为兼容入口。
- 修改文件：
  - `.github/workflows/check.yml`
  - `scripts/check-docs.js`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：`check-docs.js` 语法、自测和正例、agent 文档同步、workflow 人工结构对账及 `node scripts/check-all.js` 均通过；当前全量运行仍完成 Windows installer smoke。未 commit/push，因此 GitHub Ubuntu runner 与 POSIX installer smoke 尚未产生远端执行证据。
- 是否产生新问题：未发现。CI 预计从 3 个子检查扩展为 15 个有序步骤，当前 Windows 全量耗时约 21 秒；Ubuntu 实际耗时和 shell smoke 结果须由后续 PR run 证实。
- 下一轮候选任务：处理现有 `SQ-041`，将 README 的硬编码 Skill 数量改为当前 9 个并让 inventory/docs 校验确定性守护，避免再次漂移。

### 第 42 / 1000 轮

- 本轮发现的问题：README 声称 eval 套件覆盖 8 个 Skill，而文件系统/inventory/eval 校验均显示 9 个；直接改成 9 仍会在新增 Skill 后再次漂移。
- 本轮修改内容：维护规则改为“覆盖全部正式 Skill”，删除重复计数源；`check-docs.js` 守护该不变量。正式 Skill 数量继续由 inventory 动态枚举，逐 Skill eval 存在性、最低场景数和总场景数由 `check-evals.js` 动态验证。
- 修改文件：
  - `README.md`
  - `scripts/check-docs.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：docs parser 自测与正例、inventory（9 Skill）、eval（9 Skill/137 场景）和 `node scripts/check-all.js` 均通过；精确 diff 只涉及 README 不变量及其守护。
- 是否产生新问题：未发现。文档不再硬编码数量，但用户仍可从 inventory/check-evals 输出获得当前精确基线。
- 下一轮候选任务：待办已清空；按覆盖轮换扫描尚未被近期直接审计的 `review-fix` portable discovery 与多 AI/单 AI/直修边界，只有发现可复现误路由时才修改。

### 第 43 / 1000 轮

- 本轮发现的问题：`review-fix` portable description 已区分一次只读审查和 findings 直修，却未路由同一 AI 审查/修复/验证/复审闭环；OpenAI prompt 只提 review-check，连 review-repair 也漏失。单 AI 请求可能误生成多 AI 任务包并停在分发阶段。
- 本轮修改内容：frontmatter、UI prompt 和正文相邻 Skill 列表统一三路：一次只读审查 `review-check`、已有 findings 立即直修 `review-repair`、同一 AI 完整闭环 `review-loop`。既有一次审查 eval 增加标签，新增直修与单 AI 闭环两个近邻场景；eval/inventory 校验器守护三条路由。
- 修改文件：
  - `skills/review-fix/SKILL.md`
  - `skills/review-fix/agents/openai.yaml`
  - `skills/review-fix/evals.json`
  - `scripts/check-evals.js`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：metadata、inventory 自测/正例、eval、review boundary 和 `node scripts/check-all.js` 均通过；review-fix 增至 14 个场景，集合总计 139，Skill Markdown BOM/UTF-8 仍正常。
- 是否产生新问题：未发现。review-fix 第二阶段仍可汇总返回 findings 形成 fix-handoff；只有用户明确不需要任务包/交接且要求立即修改时才转 review-repair。
- 下一轮候选任务：审计 `review-repair` portable description/UI prompt 是否明确排除“没有 findings、先审查再修”的 review-loop 场景；避免继续修改 review-fix 本身。

### 第 44 / 1000 轮

- 本轮发现的问题：`review-repair` 能拒绝只读审查和空 findings，却未区分“没有 findings，但要求同一个 AI 审查、修复、验证和复审”的完整闭环；正文还把这类输入笼统导向 `review-check` 或 `review-fix`，可能丢失用户要求的自动修复与复审阶段。
- 本轮修改内容：frontmatter、UI prompt、触发边界和相邻 Skill 列表补齐 `review-loop` 路由；新增空 findings 单 AI 闭环 eval；inventory、eval 和 review boundary 检查分别守护 portable、UI、场景和正文路由。同步修复状态文件顶部停在第 33 轮的恢复摘要。
- 修改文件：
  - `skills/review-repair/SKILL.md`
  - `skills/review-repair/agents/openai.yaml`
  - `skills/review-repair/evals.json`
  - `scripts/check-evals.js`
  - `scripts/check-skill-inventory.js`
  - `scripts/check-review-boundaries.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：BOM/JSON/脚本语法、metadata、inventory、eval 和 review boundary 均通过；首次 inventory 定向检查发现稳定短语大小写漂移，恢复原护栏后复验通过；最终 `node scripts/check-all.js` 全量通过（9 个 Skill、31 个 Markdown、100 个本地链接、140 个 eval 场景，`BOARD_VERSION = 23`，Windows installer smoke 通过）。
- 是否产生新问题：未发现。已有 findings 的直修入口不变；只有需要先产生 findings 且明确要求同一 AI 完整闭环时才路由 `review-loop`。
- 下一轮候选任务：轮换离开 review 系，审计 `dev-doc` discovery surface 是否能把故障诊断、测试业务流、纯代码地图和只读审查请求稳定导向相邻 Skill；仅在存在可复现误路由时修改。

### 第 45 / 1000 轮

- 本轮发现的问题：`dev-doc` 已分流故障诊断、测试业务流和 review 请求，但 frontmatter、OpenAI prompt 与 eval 未排除“只读代码地图/调用链/契约兼容影响分析且不要实施方案”的请求；`code-reading` 已有反向路由，两个 Skill 的 discovery 不对称。OpenAI prompt 还漏了 frontmatter/eval 已存在的多 AI `review-fix` 路由。
- 本轮修改内容：按主交付物增加 `dev-doc -> code-reading` 路由，并保留先读代码取证、再回 dev-doc 产出方案的组合路径；新增近邻 eval；inventory/eval 校验器守护 portable、UI 和场景标签。UI prompt 同步现有 `review-fix` 路由。
- 修改文件：
  - `skills/dev-doc/SKILL.md`
  - `skills/dev-doc/agents/openai.yaml`
  - `skills/dev-doc/evals.json`
  - `scripts/check-evals.js`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：dev-doc BOM/JSON、脚本语法、metadata、inventory、eval 和 document boundary 定向检查均通过；最终 `node scripts/check-all.js` 全量通过（9 个 Skill、31 个 Markdown、100 个本地链接、141 个 eval 场景，`BOARD_VERSION = 23`，Windows installer smoke 通过）。
- 是否产生新问题：未发现。需要方案的请求仍由 dev-doc 处理；只有明确不要方案产物的只读结构/影响理解才转 code-reading。
- 下一轮候选任务：轮换到公共或工程化契约，检查 eval 校验是否能阻止同一 Skill 内重复 prompt/重复语义标签导致覆盖统计虚高；若现有实现已覆盖则换到共享 Workflow Brief/chain 的路径契约。

### 第 46 / 1000 轮

- 本轮发现的问题：`check-evals.js` 会拒绝重复 ID 和重复 tag，但同一 Skill 内复制 prompt 后只改 ID 仍可通过，导致最低场景数和总场景数增长而有效覆盖不变。当前 141 个场景经确定性扫描没有重复。
- 本轮修改内容：增加 Skill 内 prompt 归一化去重，首尾空白与连续空白差异视为同一输入，并在失败信息中指出首次出现位置；不跨 Skill 比较、不忽略大小写、不做语义相似度判断。自测新增不同 ID 的空白变体重复负例，同时让重复 ID 负例使用不同 prompt，避免测试互相遮蔽。
- 修改文件：
  - `scripts/check-evals.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：脚本语法、`check-evals --self-test`、9 Skill/141 场景正例和 `check-scripts` 均通过；最终 `node scripts/check-all.js` 全量通过，包含 Windows installer smoke 与 `git diff --check`（仅既有行尾提示）。
- 是否产生新问题：未发现。跨 Skill 的相同用户输入仍可用于验证不同路由；大小写或代码字面量差异不会被合并。
- 下一轮候选任务：审计 `skills/_shared/workflow-chain.md` 与 `scripts/check-workflow-briefs.js` 对 nextCommand 目标 Skill 和路径的对账，优先寻找文档中写了可复制命令但校验只看名称、不验证目标存在的缺口。

### 第 47 / 1000 轮

- 本轮发现的问题：Workflow Brief 已能拒绝空人工动作、未知 Skill 和遗漏状态分支，原候选无需修改；但作为“各 skill 完成后下一步”唯一权威的 `workflow-chain.md`，职责表和下一步映射只覆盖 8 个正式 Skill，完全遗漏 `conversation-handoff`，且现有检查无法发现清单缺项。
- 本轮修改内容：补充 `conversation-handoff` 的任意阶段职责，以及“新对话读取 handoff 后按 Workflow Brief 的 next/nextCommand 恢复原阶段”的入口，不把它强制接到固定 Review 主链。inventory 新增两个 chain 表解析器：职责表与文件系统精确一对一，下一步表要求每个正式 Skill 至少出现一次、允许有阶段限定的多分支，并拒绝完全重复标签和未知 Skill。自测覆盖合法多分支和缺失下一步行。
- 修改文件：
  - `skills/_shared/workflow-chain.md`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：inventory 语法、自测和 9 Skill 正例、docs、interaction-policy sync、metadata 均通过；最终 `node scripts/check-all.js` 全量通过（31 个 Markdown、100 个本地链接、141 个 eval 场景、Windows installer smoke）。
- 是否产生新问题：未发现。`review-fix` 的任务包/修复交接两条限定分支仍合法；职责表重复或 chain 漏列任一新 Skill 会明确失败。
- 下一轮候选任务：检查 `code-reading` 的 `CodeMap`/`ImpactAnalysis` 双模式是否在 workflow-chain 被压成单一“人工 review → 提交”路径；若确有冲突，补模式级下一步和确定性守护。

### 第 48 / 1000 轮

- 本轮发现的问题：`code-reading` 的 SKILL/reference/eval 明确区分 `CodeMap` 与零写入 `ImpactAnalysis`，后者可转开发方案、缺陷判断或人工确认；共享 chain 却只写“生成代码地图”并统一导向“人工 review → 提交”，会把聊天只读影响分析误推到 Submit 路径。
- 本轮修改内容：职责行补齐双模式；下一步映射拆成 `CodeMap` 和 `ImpactAnalysis` 两个限定分支，分别给出人工 review/提交，以及 dev-doc/review-check/人工确认的可复制入口。inventory parser 暴露行标签并支持必需分支标签，自测证明缺少任一必需模式会失败。
- 修改文件：
  - `skills/_shared/workflow-chain.md`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：inventory 语法、自测、9 Skill 正例、code-reading 13 个场景所在全量 eval 和 docs 检查均通过；最终 `node scripts/check-all.js` 全量通过（31 个 Markdown、100 个本地链接、141 个 eval 场景、Windows installer smoke）。
- 是否产生新问题：未发现。多分支计数仍把 code-reading 视为一个正式 Skill；只有下一步标签按模式拆分。
- 下一轮候选任务：审计 workflow-chain 每行“默认下一步”中点名的所有正式 Skill，是否都在 Claude Code 与 Codex 两列提供可复制入口；修复只列分支但无命令的情况并加确定性检查。

### 第 49 / 1000 轮

- 本轮发现的问题：workflow-chain 的 `review-check` 行声明可把 findings 贴回 `review-fix` 汇总，但双宿主命令只给 `review-repair`；`review-repair` 行声明大改后应二次 `review-check`，命令却只给 `code-reading`。两个合法分支无法从单一权威表直接执行。
- 本轮修改内容：为 review-check 补齐 review-fix 汇总命令，为 review-repair 补齐二次 review-check 命令。inventory parser 保留映射行单元格，提取默认下一步中反引号标出的正式 Skill，要求 Claude Code 列有 `/skill-name` 或自然语言入口、Codex 列有自然语言 `skill-name skill` 或等价斜杠入口；路径片段不算调用。自测覆盖缺少单宿主命令。
- 修改文件：
  - `skills/_shared/workflow-chain.md`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：inventory 语法、自测和 9 Skill 正例、review boundary、docs 以及独立 branch-command 审计均通过；最终 `node scripts/check-all.js` 全量通过（31 个 Markdown、100 个本地链接、141 个 eval 场景、Windows installer smoke）。
- 是否产生新问题：未发现。校验只覆盖默认下一步明确点名的正式 Skill，不要求人工动作或外部方法论伪装成仓库 Skill。
- 下一轮候选任务：轮换到 token/重复内容审计，扫描不同 SKILL.md 的长段落或大型命令块重复；只处理能减少实际上下文或规则漂移且不破坏 Skill 自解释性的具体重复。

### 第 50 / 1000 轮

- 本轮发现的问题：跨 Skill 精确重复扫描发现 dev-doc/bug-fix/biz-flow 各内联同一段约 892 字符的看板模板定位/复制命令；更严重的是 bug-fix 与 biz-flow 的 EXISTS 版本检查直接使用 `$src`，但该分支没有在同一 shell 命令中赋值，宿主每次启动独立 shell 时会读取空路径。
- 本轮修改内容：新增按需加载的 `skills/_shared/board-shell-bootstrap.md`，提供“定位并复制/升级”和“只读比较版本”两个自包含 Bash 块；每块都重新定位四个安装根，复制只在缺失时初始化 `data/changes.js`，版本比较输出确定性 marker。三个主 Skill 删除重复块、保留各自 entry kind/字段/board-add/build 流程并引用共享文档；document boundary 守护链接与数据不覆盖/版本 marker。
- 修改文件：
  - `skills/_shared/board-shell-bootstrap.md`
  - `skills/dev-doc/SKILL.md`
  - `skills/bug-fix/SKILL.md`
  - `skills/biz-flow/SKILL.md`
  - `scripts/check-document-boundaries.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：4 个 Markdown BOM、共享链接/锚点、脚本语法、document boundary、docs 和 metadata 均通过；共享两个 Bash 块经 Git Bash `-n` 语法检查通过；重复长段落由 8 组降到 6 组，三个主 SKILL 合计减少 87 行。最终 `node scripts/check-all.js` 全量通过（9 Skill、32 Markdown、102 本地链接、141 eval、Windows installer smoke）。
- 是否产生新问题：未发现产品回归。本机 WSL 无发行版，非登录 Git Bash 又无法解析自带 coreutils，隔离行为 smoke 无法形成 POSIX 实证；三次夹具失败均在环境准备层并已安全清理/恢复 HOME 与 PATH，不能宣称命令行为已在本机执行通过。
- 下一轮候选任务：为共享 board bootstrap 增加 POSIX 条件行为 smoke，并接入现有检查，使 Ubuntu CI 验证首次复制、数据保留、current/upgrade marker；Windows 明确跳过行为执行但继续静态/语法守护。

### 第 51 / 1000 轮

- 本轮发现的问题：共享 board bootstrap 的两个 Bash 块只有静态短语和语法证据，尚未在可用 POSIX 环境中自动验证首次复制、重复运行时的数据保留，以及 current/upgrade marker。
- 本轮修改内容：`check-document-boundaries.js` 现在始终提取并要求恰好两个 Bash 代码块；非 Windows 在 `os.tmpdir()` 下创建隔离 HOME/项目和已安装模板副本，通过 stdin 执行两个块，验证外壳/vendor/脚本/data 初始化、`changes.js` 与 detail sentinel 保留、当前版本和降级版本 marker；清理前验证临时路径归属。Windows 保留静态检查并明确报告跳过行为 smoke。
- 修改文件：
  - `scripts/check-document-boundaries.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：`node --check scripts/check-document-boundaries.js`、定向 document boundary、`check-scripts` 和 `node scripts/check-all.js` 全部通过；全量基线为 9 Skill、32 Markdown、102 本地链接、141 eval、15 个检查步骤、`BOARD_VERSION = 23`，Windows installer smoke 通过。Windows 输出 `POSIX board-shell behavior smoke skipped on Windows`，没有遗留同前缀临时目录；真实 POSIX 行为仍需提交后的 Ubuntu CI 结果作平台证据。
- 是否产生新问题：未发现产品回归。候选扫描发现 `conversation-handoff/reference.md` 的外层三反引号模板被内部三反引号提示块提前闭合，末尾围栏未闭合；登记为 `SQ-052`，未混入本轮修改。
- 下一轮候选任务：修复 conversation-handoff 模板围栏，并给现有文档检查增加确定性的未闭合 fenced-code-block 守护，先全仓扫描确认没有其他受影响文件。

### 第 52 / 1000 轮

- 本轮发现的问题：`conversation-handoff/reference.md` 用三反引号包裹完整 Markdown 模板，内部同长度 `text` fence 使真实 Markdown 在第 57 行提前闭合，第 72 行又打开未闭合 fence；既有 `check-docs` 把带 info string 的 opening marker 误判为 closing，且不检查 EOF 未闭合状态。
- 本轮修改内容：把模板外层改为四反引号；重写 docs 围栏状态机，按最多 3 个前导空格、同字符且长度不短于 opening、closing 行不得带 info string 等规则解析，并对全部 Skill Markdown 报告 opening 行号。自测覆盖合法较长外层和原缺陷负例。首次全量随后发现 Workflow Brief 校验器只接受恰好三个反引号终止，已放宽为至少三个纯反引号/波浪号并用四反引号正例守护。
- 修改文件：
  - `skills/conversation-handoff/reference.md`
  - `scripts/check-docs.js`
  - `scripts/check-workflow-briefs.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：修复模板前，新检查确定性报 `reference.md` 第 72 行未闭合且仅此一处；修复后 docs 自测/正例、Workflow Brief 自测/正例、metadata/BOM 和 script checks 均通过。首次全量因四反引号兼容缺口失败，修复后第二次 `node scripts/check-all.js` 全量通过（9 Skill、32 Markdown、102 本地链接、141 eval、Windows installer smoke）；`git diff --check` 仅既有行尾提示。
- 是否产生新问题：未发现产品回归。扫描确认 `check-docs` 的本地链接/锚点检查当前只覆盖 `skills/`，README 和正式 docs 仍缺确定性路径守护，登记为 `SQ-053`。
- 下一轮候选任务：扩展本地文档链接检查到 README 与维护中的 docs，先处理 inline-code 中伪链接和生成物/归档边界，避免误报后再纳入 CI。

### 第 53 / 1000 轮

- 本轮发现的问题：`check-docs.js` 的本地路径/锚点检查只扫描 `skills/`；README、workflow guide、why 文档等入口文件中的相对链接失效时，全量检查仍可能通过。直接扩展还会把 inline-code 中的 Markdown 示例误当真实链接。
- 本轮修改内容：构造“全部 Skill Markdown + `requiredDocs` 中明确维护的 Markdown”去重清单，保留生成的 `docs/INDEX.md`、日期产物和归档排除边界；新增成对 backtick-run inline-code 过滤，忽略代码 span 内伪链接，同时保留 ``[`label`](target)`` 的真实目标。自测守护维护清单、生成物排除和 inline-code 行为。
- 修改文件：
  - `scripts/check-docs.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 验证结果：脚本语法、自测和正例通过，维护链接基线由 102 增至 113；临时 `_shared` 故障注入稳定报出缺失目标，随后通过 `apply_patch` 删除并确认 `Test-Path=False`。`check-scripts` 与 `node scripts/check-all.js` 全量通过（9 Skill、32 Markdown、113 维护链接、141 eval、Windows installer smoke），`git diff --check` 仅既有行尾提示。
- 是否产生新问题：未发现产品回归。长流程扫描发现 `review-loop` 正文/reference/eval 都限制最多两轮，但 frontmatter description 和 OpenAI default prompt 没有同步停机上限，登记为 `SQ-054`。
- 下一轮候选任务：把 review-loop 的两轮上限、残留 Critical/Important/验证阻塞时停止且不进入 Submit Gate 的边界同步到 portable description 与 OpenAI prompt，并用 inventory 守护。

### 第 54 / 1000 轮（最终收尾）

- 本轮发现的问题：接手时 `SQ-054` 的产品改动已写入工作区，但状态仍是待处理，且缺少最终定向与全量验证记录。
- 本轮补充内容：确认 `review-loop` frontmatter description 已将“直到没有”限定为最多 2 个修复循环；OpenAI default prompt 已要求残留 Critical/Important、`Failed` 或 `EnvironmentBlocked` 时保留 finding ID、输出 `PartiallyFixed`/`Blocked` 并禁止进入 Submit Gate；inventory 已同时守护 portable description 与 UI prompt 的关键停机边界。本轮不再新增产品优化。
- 修改文件：
  - `skills/review-loop/SKILL.md`
  - `skills/review-loop/agents/openai.yaml`
  - `scripts/check-skill-inventory.js`
  - `.agent/skill-iteration-state.md`
  - `.agent/skill-backlog.md`
  - `.agent/skill-quality-report.md`
- 定向验证：`node --check scripts/check-skill-inventory.js`、`node scripts/check-skill-inventory.js --self-test`、inventory 正例、metadata、review boundary 和 eval 检查均通过（9 个 Skill、32 个 Markdown、141 个 eval 场景）。
- 最终验证：`node scripts/check-all.js` 全量通过（15 个检查步骤、9 个 Skill、32 个 Skill Markdown、113 个维护链接、141 个 eval 场景、`BOARD_VERSION = 23`、Windows installer smoke、`git diff --check`）；Windows 按设计跳过 POSIX board-shell 行为 smoke，该平台证据由 Ubuntu CI 提供。
- 停止原因：用户明确要求只补完最后一次优化，不继续轮回优化。
