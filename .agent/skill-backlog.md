# Skill Quality Backlog

## 状态说明

- 待分析：已发现线索，尚未确认是否需要修改。
- 待处理：问题明确，可进入某轮迭代。
- 处理中：当前轮正在处理。
- 已完成：已修改并验证。
- 暂缓：有价值但当前不适合处理。
- 无需处理：分析后确认不是问题。
- 需要用户确认：涉及高风险或业务口径，需要用户决定。

## 待办列表

- 编号：SQ-001
  问题描述：缺少长期自治迭代状态文件，无法可靠恢复轮次、待办、基线和风险边界。
  影响范围：自治维护流程、上下文恢复。
  优先级：P1
  发现轮次：启动基线
  当前状态：已完成
  相关文件：`.agent/skill-iteration-state.md`、`.agent/skill-quality-report.md`、`.agent/skill-backlog.md`

- 编号：SQ-002
  问题描述：当前工作区已有大量未提交修改，后续迭代需要明确避免覆盖这些文件，必要时优先处理未触碰文件。
  影响范围：全部修改流程、Git 安全边界。
  优先级：P1
  发现轮次：启动基线
  当前状态：已完成
  相关文件：`.agent/dirty-worktree-baseline.md`、`git status --short --branch`

- 编号：SQ-003
  问题描述：README/AGENTS/CLAUDE 与实际 Skill 清单、agents metadata、eval 场景的同步关系需要进一步抽样检查，避免文档入口漂移。
  影响范围：安装后使用说明、Codex/Claude/Cursor 触发方式。
  优先级：P2
  发现轮次：启动基线
  当前状态：已完成
  相关文件：`scripts/check-skill-inventory.js`、`README.md`、`AGENTS.md`、`CLAUDE.md`、`skills/*/agents/openai.yaml`、`skills/*/evals.json`

- 编号：SQ-006
  问题描述：新增的 `scripts/check-skill-inventory.js` 尚未接入 `scripts/check-all.js`，全量校验不会执行 inventory 语义检查。
  影响范围：本地完整校验入口。
  优先级：P2
  发现轮次：第 3 轮
  当前状态：已完成
  相关文件：`scripts/check-all.js`、`scripts/check-skill-inventory.js`

- 编号：SQ-004
  问题描述：跨 Skill 的边界描述较长，需抽样检查是否存在 review-fix/review-check/review-repair/review-loop 触发重叠或互相替代的歧义。
  影响范围：Review Gate 相关 Skill。
  优先级：P2
  发现轮次：启动基线
  当前状态：已完成
  相关文件：`scripts/check-review-boundaries.js`、`skills/review-*/SKILL.md`、`skills/_shared/workflow-chain.md`

- 编号：SQ-007
  问题描述：`conversation-handoff` 缺少与其他文档类 Skill 一致的非交互/无人值守入口级停机规则。
  影响范围：`conversation-handoff`
  优先级：P2
  发现轮次：第 5 轮
  当前状态：已完成
  相关文件：`skills/conversation-handoff/SKILL.md`

- 编号：SQ-008
  问题描述：文档生成类 Skill 的失败分支、非交互停机、看板安全、零写入模式和临时交接不登记看板等边界缺少最小自动校验。
  影响范围：`dev-doc`、`bug-fix`、`biz-flow`、`code-reading`、`conversation-handoff`
  优先级：P2
  发现轮次：第 6 轮
  当前状态：已完成
  相关文件：`scripts/check-document-boundaries.js`、`skills/dev-doc/SKILL.md`、`skills/bug-fix/SKILL.md`、`skills/biz-flow/SKILL.md`、`skills/code-reading/SKILL.md`、`skills/conversation-handoff/SKILL.md`

- 编号：SQ-009
  问题描述：新增或强化的边界规则需要 eval 场景覆盖，尤其是 `conversation-handoff` 的非交互/无人值守 Blocked/NeedsConfirmation 分支。
  影响范围：`skills/conversation-handoff/evals.json` 及 eval 校验。
  优先级：P2
  发现轮次：第 7 轮
  当前状态：已完成
  相关文件：`skills/conversation-handoff/evals.json`、`scripts/check-evals.js`

- 编号：SQ-010
  问题描述：新增校验脚本已接入 `check-all.js`，但 README/AGENTS/CLAUDE 的脚本清单可能未同步说明，影响维护者发现单项检查入口。
  影响范围：仓库维护说明、脚本入口文档。
  优先级：P2
  发现轮次：第 8 轮
  当前状态：已完成
  相关文件：`README.md`、`AGENTS.md`、`CLAUDE.md`、`scripts/check-all.js`

- 编号：SQ-011
  问题描述：`check-docs.js` 尚未要求 README 维护命令块列出所有核心单项校验脚本，未来新增脚本后可能再次出现文档遗漏。
  影响范围：文档校验脚本、README 维护体验。
  优先级：P2
  发现轮次：第 9 轮
  当前状态：已完成
  相关文件：`scripts/check-docs.js`、`README.md`

- 编号：SQ-012
  问题描述：README 脚本清单和 `check-docs.js` 目前仍是双写维护，可分析是否从 `scripts/check-all.js` 自动推导需要出现在 README 的命令，减少未来遗漏。
  影响范围：文档校验脚本、维护成本。
  优先级：P3
  发现轮次：第 10 轮
  当前状态：已完成
  相关文件：`scripts/check-docs.js`、`scripts/check-all.js`、`README.md`

- 编号：SQ-013
  问题描述：`agents/openai.yaml` 的 `default_prompt` 是 Codex UI 入口提示，需抽样检查是否与各 `SKILL.md` 的路由边界一致，避免 UI 入口诱导错用 skill。
  影响范围：Codex UI skill 触发和路由准确性。
  优先级：P2
  发现轮次：第 11 轮
  当前状态：已完成
  相关文件：`skills/review-repair/agents/openai.yaml`、`scripts/check-skill-inventory.js`、`skills/review-repair/SKILL.md`

- 编号：SQ-014
  问题描述：继续抽样非 review-repair 的 OpenAI UI prompt，重点检查 `conversation-handoff`、`biz-flow` 是否缺少“不要替代 dev-doc/review/biz/bug 等相邻 skill”的路由边界。
  影响范围：Codex UI skill 触发和跨 Skill 分工。
  优先级：P2
  发现轮次：第 12 轮
  当前状态：已完成
  相关文件：`skills/conversation-handoff/agents/openai.yaml`、`skills/biz-flow/agents/openai.yaml`、`scripts/check-skill-inventory.js`

- 编号：SQ-015
  问题描述：`check-skill-metadata.js` 对 `agents/openai.yaml` 只检查字段存在，未显式校验单行引号是否闭合；未来 metadata 中缺少闭合引号可能被轻量正则误判通过。
  影响范围：OpenAI agent metadata 结构校验。
  优先级：P2
  发现轮次：第 13 轮
  当前状态：已完成
  相关文件：`scripts/check-skill-metadata.js`、`skills/*/agents/openai.yaml`

- 编号：SQ-016
  问题描述：`check-skill-inventory.js` 也解析 `agents/openai.yaml`，但其 scalar 去引号逻辑仍未检查引号闭合，和 `check-skill-metadata.js` 口径不一致。
  影响范围：Skill inventory 校验与 metadata 校验一致性。
  优先级：P2
  发现轮次：第 14 轮
  当前状态：已完成
  相关文件：`scripts/check-skill-inventory.js`、`scripts/check-skill-metadata.js`

- 编号：SQ-017
  问题描述：新增的边界/metadata 校验脚本目前主要靠当前仓库正例验证，可分析是否需要最小负例自测来证明会拦截关键坏样本。
  影响范围：校验脚本可靠性。
  优先级：P3
  发现轮次：第 15 轮
  当前状态：已完成
  相关文件：`scripts/check-skill-inventory.js`、`scripts/check-review-boundaries.js`、`scripts/check-document-boundaries.js`、`scripts/check-skill-metadata.js`

- 编号：SQ-018
  问题描述：边界校验脚本依赖关键短语，当前失败信息能指出缺失短语，但脚本内缺少说明这些短语是“行为边界护栏”而非普通文案检查；未来维护者可能误删或误判。
  影响范围：`check-review-boundaries.js`、`check-document-boundaries.js` 可维护性。
  优先级：P3
  发现轮次：第 16 轮
  当前状态：已完成
  相关文件：`scripts/check-review-boundaries.js`、`scripts/check-document-boundaries.js`

- 编号：SQ-019
  问题描述：README/AGENTS 对 boundary 脚本的说明可能只写了 guardrails，需检查是否足以让维护者理解它们不是普通 Markdown lint。
  影响范围：维护者文档体验。
  优先级：P3
  发现轮次：第 17 轮
  当前状态：已完成
  相关文件：`README.md`、`AGENTS.md`、`CLAUDE.md`

- 编号：SQ-020
  问题描述：README 新增的 boundary check 维护说明尚未被 `check-docs.js` 守护，未来仍可能被删除。
  影响范围：README 文档校验。
  优先级：P3
  发现轮次：第 18 轮
  当前状态：已完成
  相关文件：`scripts/check-docs.js`、`README.md`

- 编号：SQ-021
  问题描述：`.agent/skill-quality-report.md` 的 checkpoint 停留在第 10 轮，未反映第 11-19 轮新增的 README 自动推导校验、UI prompt 路由边界、metadata 自测和 boundary 维护说明。
  影响范围：长期自治恢复、维护者质量基线判断。
  优先级：P3
  发现轮次：第 19 轮
  当前状态：已完成
  相关文件：`.agent/skill-quality-report.md`

- 编号：SQ-005
  问题描述：PowerShell 直接读取部分中文 Markdown 时显示 mojibake；需要确认是否仅为终端编码问题，或存在非预期编码文件影响 Windows 维护体验。
  影响范围：Windows 开发者可读性、安装和维护文档。
  优先级：P3
  发现轮次：启动基线
  当前状态：已完成
  相关文件：`README.md`、`scripts/check-docs.js`、`scripts/check-skill-metadata.js`、`skills/**/*.md`
  处理结论：29 个 Skill Markdown 均为有效 UTF-8 且带 BOM；乱码来自 Windows PowerShell 5.1 在 CP936 下默认误解码无 BOM UTF-8 文档。metadata 校验现已递归守护全部 Skill Markdown，README 说明其他文档需显式使用 UTF-8 读取。

- 编号：SQ-022
  问题描述：Skill Markdown 包含大量运行时相对链接和标题锚点，但全量检查未验证目标是否存在，重命名文件或标题后可能留下断链。
  影响范围：全部 `skills/**/*.md` 的渐进加载和共享协议引用。
  优先级：P2
  发现轮次：第 22 轮
  当前状态：已完成
  相关文件：`scripts/check-docs.js`、`scripts/check-scripts.js`、`AGENTS.md`、`CLAUDE.md`

- 编号：SQ-023
  问题描述：`dev-doc/SKILL.md` 已达到 499 行，贴近 500 行上限；需分析是否有可下沉到 reference/shared 的低收益细节，避免继续增长导致加载成本和可维护性恶化。
  影响范围：`dev-doc` 的触发后 token 消耗、渐进加载和维护空间。
  优先级：P2
  发现轮次：第 22 轮
  当前状态：已完成
  相关文件：`skills/dev-doc/SKILL.md`、`skills/dev-doc/reference.md`、`skills/_shared/*.md`
  处理结论：将仅在异常时需要的常见错误表原样下沉到 reference，主入口保留显式失败处理和门禁规则；SKILL.md 从 499 行/25107 字符降为 478 行/22943 字符。

- 编号：SQ-024
  问题描述：`code-reading` 没有 `examples.md`；CodeMap 与 ImpactAnalysis 的落盘/零写入边界只有模板和 eval 描述，缺少可按需加载的最小已填示例。
  影响范围：双模式输出格式的可执行性、示例与正文一致性、可选 token 成本。
  优先级：P3
  发现轮次：第 23 轮
  当前状态：已完成
  相关文件：`skills/code-reading/SKILL.md`、`skills/code-reading/examples.md`、`AGENTS.md`、`CLAUDE.md`
  处理结论：新增 CodeMap 与 ImpactAnalysis 各一个短例，主入口要求仅在首次执行或模式易混淆时按对应锚点加载；inventory 已从 no-examples 变为 examples。

- 编号：SQ-025
  问题描述：`conversation-handoff` 仍没有 `examples.md`；需判断事实/推断/缺口分层和非交互 Blocked 分支是否需要最小已填示例，或现有短 SKILL + reference 已足够。
  影响范围：跨对话交接准确性、可选示例 token 成本。
  优先级：P3
  发现轮次：第 24 轮
  当前状态：已完成
  相关文件：`skills/conversation-handoff/SKILL.md`、`skills/conversation-handoff/examples.md`、`AGENTS.md`、`CLAUDE.md`
  处理结论：新增一个完整 PartiallyComplete 证据分层示例和一个短 Blocked/NotWritten 分支；主入口只在首次生成或边界易混淆时按场景加载，并明确示例不得复制为当前事实。

- 编号：SQ-026
  问题描述：`check-workflow-briefs.js` 发现 Workflow Brief 缺字段/顺序错误后仍直接调用 `values.vcs.includes`，会抛 TypeError，导致失败信息不完整并中断后续文件检查。
  影响范围：Workflow Brief 结构校验的异常处理和诊断可用性。
  优先级：P2
  发现轮次：第 24 轮
  当前状态：已完成
  相关文件：`scripts/check-workflow-briefs.js`、`scripts/check-scripts.js`
  处理结论：校验逻辑改为纯函数返回诊断列表，缺失/重复/未知/空字段分别报告；语义子字段仅在父字段存在时检查。负例同时验证缺 vcs/api 和 tests 子字段错误，不再抛 TypeError。

- 编号：SQ-027
  问题描述：新增或删除 `examples.md` 时需要人工同步 AGENTS/CLAUDE 的 Skill supporting-files 列；现有 inventory 只报告 examples/no-examples，未验证维护文档是否与实际资源一致。
  影响范围：Skill 资源清单、维护者发现按需示例的能力、文档漂移。
  优先级：P3
  发现轮次：第 26 轮
  当前状态：已完成
  相关文件：`scripts/check-skill-inventory.js`、`AGENTS.md`、`CLAUDE.md`、`skills/*/examples.md`
  处理结论：inventory 现在解析两份文档的 `## Skills` 表，以文件系统 Skill 清单为真源校验行、精确入口、`reference.md` 和 `examples.md` 声明；自测证明漏写 examples 会失败，当前 9/9 Skill 对账通过。

- 编号：SQ-028
  问题描述：Review Gate 对 `deferred` 与 `deferred-next-batch` 的状态枚举不一致；前者表示低收益/当前不处理，后者表示有证据且明确排入下一批，但 shared chain、review-repair 和 review-loop 各自漏掉或混用了其中一个。
  影响范围：finding ID 回填、未关闭项判断、下一批修复交接。
  优先级：P2
  发现轮次：第 28 轮
  当前状态：已完成
  相关文件：`skills/_shared/workflow-chain.md`、`skills/review-repair/SKILL.md`、`skills/review-loop/SKILL.md`、`skills/review-loop/reference.md`、`skills/review-fix/reference.md`
  处理结论：统一五种逐 finding 终态，并明确 `deferred` 不承诺下一批、`deferred-next-batch` 明确排入下一批；执行正文和输出模板已同步，全量检查通过。

- 编号：SQ-029
  问题描述：`TestEvidenceStatus` 的完整六状态在 review-fix/review-loop 模板中分别漏掉 `NotRun` / `NotApplicable`，且修复后四状态子集缺少显式阶段解释。
  影响范围：测试证据状态传递、Verification Gate 停机结论、模板输出一致性。
  优先级：P2
  发现轮次：第 29 轮
  当前状态：已完成
  相关文件：`skills/_shared/workflow-chain.md`、`skills/review-fix/reference.md`、`skills/review-loop/reference.md`、`scripts/check-review-boundaries.js`
  处理结论：材料/只读阶段统一允许六状态，代码修改后强制重新收敛到 Passed/Failed/NotRun/EnvironmentBlocked；两个遗漏模板已补齐，边界脚本已守护两类集合。

- 编号：SQ-030
  问题描述：共享 Workflow Brief 未被结构校验，parser 会误识别内联 marker；`openFindings` 同时漏普通 deferred 并错误包含 rejected 终态。
  影响范围：跨 Skill/跨对话交接、未关闭 finding 路由、token 读取上限。
  优先级：P2
  发现轮次：第 30 轮
  当前状态：已完成
  相关文件：`scripts/check-workflow-briefs.js`、`skills/_shared/workflow-brief.md`、`skills/conversation-handoff/reference.md`、`skills/review-repair/reference.md`
  处理结论：共享协议已纳入独立 marker 解析；自测守护 5 文件上限和 rejected 终态；普通 deferred 可追踪但不自动重跑，rejected 不再进入 openFindings。

- 编号：SQ-031
  问题描述：多个 Workflow Brief 的 nextCommand 未覆盖 next 声明的 EnvironmentBlocked/下一批分支，或只给模糊 Skill 占位符；校验器允许人工动作写 `无`。
  影响范围：Plan Gate、Review Loop、ImpactAnalysis 的跨 AI 后续执行。
  优先级：P2
  发现轮次：第 31 轮
  当前状态：已完成
  相关文件：`scripts/check-workflow-briefs.js`、`skills/dev-doc/reference.md`、`skills/review-loop/reference.md`、`skills/code-reading/reference.md`
  处理结论：三个模板已补齐可复制命令；校验器会拒绝人工空命令、未知 Skill、明确状态分支遗漏和模糊调用占位符。

- 编号：SQ-032
  问题描述：README 的正式 Skill 选择表未与文件系统对账，仅靠全文名称出现检查，可能漏行、重复或保留已删除 Skill。
  影响范围：用户选路入口、Skill 职责发现、README 索引准确性。
  优先级：P3
  发现轮次：第 32 轮
  当前状态：已完成
  相关文件：`scripts/check-skill-inventory.js`、`README.md`
  处理结论：inventory 现在解析 `### 3. 选择 skill` 三列表并要求每个正式 Skill 精确出现一次；当前 9 行对账通过，自测证明漏行会失败。

- 编号：SQ-033
  问题描述：biz-flow 的 portable frontmatter description 未携带正文/UI prompt/eval 已定义的相邻 Skill 路由边界。
  影响范围：Codex 等依赖 frontmatter 的 Skill 发现与触发准确性。
  优先级：P2
  发现轮次：第 33 轮
  当前状态：已完成
  相关文件：`skills/biz-flow/SKILL.md`、`scripts/check-skill-inventory.js`、`skills/biz-flow/evals.json`
  处理结论：description 已明确开发方案、代码地图、只读审查和多 AI 任务包分别路由到 dev-doc/code-reading/review-check/review-fix；inventory 守护关键词，现有 eval 覆盖行为。

- 编号：SQ-034
  问题描述：`review-check` 的 portable frontmatter description 与 OpenAI 默认提示未完整区分只读审查、已有 findings 直修、单 AI 审查修复闭环和多 AI 任务包/汇总。
  影响范围：`review-check` 的触发准确性、review 系 Skill 边界和错误执行风险。
  优先级：P2
  发现轮次：第 34 轮
  当前状态：已完成
  相关文件：`skills/review-check/SKILL.md`、`skills/review-check/agents/openai.yaml`、`skills/review-check/evals.json`、`scripts/check-evals.js`、`scripts/check-skill-inventory.js`
  处理结论：portable description、UI prompt 和正文相邻 Skill 列表已统一路由到 review-repair/review-loop/review-fix；新增 single-agent closure 场景并标记 direct-repair 场景，确定性校验守护路由词与 eval 标签。

- 编号：SQ-035
  问题描述：`code-reading` 的 discovery surface 和 eval 未完整区分只读结构/影响理解与实施方案、缺陷判断、已有 findings 直修、测试/产品业务流。
  影响范围：`code-reading` 的触发准确性、零写入边界和相邻 Skill 路由。
  优先级：P2
  发现轮次：第 35 轮
  当前状态：已完成
  相关文件：`skills/code-reading/SKILL.md`、`skills/code-reading/agents/openai.yaml`、`skills/code-reading/evals.json`、`scripts/check-evals.js`、`scripts/check-skill-inventory.js`
  处理结论：frontmatter 与 UI prompt 已统一路由到 dev-doc/review-check/review-repair/biz-flow；新增三个近邻负例并标记既有只读审查负例，确定性校验守护四类路由。方案请求可先以 code-reading 收集证据，但方案产物仍由 dev-doc 负责。

- 编号：SQ-036
  问题描述：`bug-fix` discovery surface 未排除不诊断单次故障、只面向测试/产品梳理正常业务流的请求。
  影响范围：`bug-fix` 触发准确性、无关根因材料追问和错误文档产物风险。
  优先级：P2
  发现轮次：第 36 轮
  当前状态：已完成
  相关文件：`skills/bug-fix/SKILL.md`、`skills/bug-fix/agents/openai.yaml`、`skills/bug-fix/evals.json`、`scripts/check-evals.js`、`scripts/check-skill-inventory.js`
  处理结论：frontmatter/UI prompt 已按主交付物把纯正常业务流请求路由到 biz-flow；新增近邻 eval 和确定性关键词/标签守护，保留包含事故诊断目标的 bug-fix 场景。

- 编号：SQ-037
  问题描述：`biz-flow` discovery surface 未排除以单次事故现象、复现、根因证据和修复边界为主交付物的请求。
  影响范围：`biz-flow` 触发准确性、事故证据分层和错误文档产物风险。
  优先级：P2
  发现轮次：第 37 轮
  当前状态：已完成
  相关文件：`skills/biz-flow/SKILL.md`、`skills/biz-flow/agents/openai.yaml`、`skills/biz-flow/evals.json`、`scripts/check-evals.js`、`scripts/check-skill-inventory.js`
  处理结论：frontmatter/UI prompt 已按主交付物把单次事故诊断路由到 bug-fix；新增近邻 eval 和确定性关键词/标签守护。业务链路可作为事故背景，正常流程与测试口径仍由 biz-flow 负责。

- 编号：SQ-038
  问题描述：`check-evals.js` 遇到非对象顶层/场景或标量 tags 时可能抛 TypeError，不能稳定输出文件级诊断并继续检查。
  影响范围：eval CI 诊断、生成/合并异常文件的恢复效率、后续 Skill 覆盖检查完整性。
  优先级：P2
  发现轮次：第 38 轮
  当前状态：已完成
  相关文件：`scripts/check-evals.js`、`scripts/check-scripts.js`
  处理结论：结构校验已改为纯函数并对 malformed 根/元素显式失败，非法 tags 不再进入迭代；自测覆盖 null/标量/数组、重复 ID、空白/标量 tags，且由 check-scripts 自动执行。

- 编号：SQ-039
  问题描述：Skill frontmatter 与 OpenAI metadata 平面块中的重复 YAML 键会被静默覆盖，可能让不同宿主采用不同 discovery 值。
  影响范围：Skill 名称/描述、OpenAI 默认提示、隐式调用策略和跨宿主触发一致性。
  优先级：P2
  发现轮次：第 39 轮
  当前状态：已完成
  相关文件：`scripts/check-skill-metadata.js`
  处理结论：metadata 校验器现在拒绝 frontmatter 顶层及 interface/policy 直接子键重复；自测覆盖重复与跨块非误报，当前 9 个 Skill 均通过。

- 编号：SQ-040
  问题描述：安装器校验只有关键词/ASCII 检查，不能证明安装后的 Skill 目录树、资源字节、同名替换、无关 Skill 保留和 Codex BOM 归一化行为。
  影响范围：三端安装后的实际能力、Codex discovery、agents/evals/examples/scripts/assets 完整性。
  优先级：P1
  发现轮次：第 40 轮
  当前状态：已完成
  相关文件：`install.sh`、`scripts/check-installers.js`、`README.md`、`AGENTS.md`、`CLAUDE.md`
  处理结论：新增隔离实际安装 smoke；Windows 执行 local CMD，POSIX 执行本地 tar fixture 的 install.sh，逐树/逐字节校验并只允许 Codex SKILL.md 去 BOM。当前 Windows 路径已实际通过。

- 编号：SQ-041
  问题描述：README 维护规则仍称 eval 套件覆盖 8 个 Skill，与当前 9 个正式 Skill 不一致。
  影响范围：维护者质量基线和新增 Skill 后的文档准确性。
  优先级：P3
  发现轮次：第 40 轮
  当前状态：已完成
  相关文件：`README.md`、`scripts/check-docs.js` 或 `scripts/check-skill-inventory.js`
  处理结论：README 改为不易漂移的“覆盖全部正式 Skill”，由 check-docs 守护该表述；精确数量与覆盖继续由 inventory/check-evals 动态证明。

- 编号：SQ-042
  问题描述：GitHub Actions 只运行 board-sync、interaction-policy 和 eval 三项，没有执行 metadata、inventory、Workflow Brief、boundary、installer smoke 等完整 `check-all` 套件。
  影响范围：PR 回归拦截、POSIX installer smoke、文档/Skill 契约持续集成。
  优先级：P1
  发现轮次：第 40 轮
  当前状态：已完成
  相关文件：`.github/workflows/check.yml`、`scripts/check-all.js`、`scripts/check-docs.js`、`AGENTS.md`、`CLAUDE.md`
  处理结论：保留既有 workflow/job 标识，将 CI 步骤统一为 `node scripts/check-all.js`；check-docs 反向守护该入口，本地全量通过。远端 Ubuntu runner 结果需在提交/PR 后确认。

- 编号：SQ-043
  问题描述：`review-fix` discovery surface 未完整区分多 AI 任务包/汇总、一次只读审查、已有 findings 直修和同一 AI 审查修复闭环。
  影响范围：review 系 Skill 触发准确性、错误任务包产物和不必要 token/人工分发。
  优先级：P2
  发现轮次：第 43 轮
  当前状态：已完成
  相关文件：`skills/review-fix/SKILL.md`、`skills/review-fix/agents/openai.yaml`、`skills/review-fix/evals.json`、`scripts/check-evals.js`、`scripts/check-skill-inventory.js`
  处理结论：metadata/UI/正文统一路由 review-check/review-repair/review-loop；三个近邻场景均有 eval 标签和确定性 discovery 守护。

- 编号：SQ-044
  问题描述：`review-repair` discovery surface 未排除没有 findings、但要求同一 AI 完成审查、修复、验证和复审的 `review-loop` 场景。
  影响范围：review 系 Skill 触发准确性、空 findings 猜修风险和完整闭环执行成功率。
  优先级：P2
  发现轮次：第 44 轮
  当前状态：已完成
  相关文件：`skills/review-repair/SKILL.md`、`skills/review-repair/agents/openai.yaml`、`skills/review-repair/evals.json`、`scripts/check-evals.js`、`scripts/check-skill-inventory.js`、`scripts/check-review-boundaries.js`
  处理结论：portable/UI/正文均按有无 findings 分流 direct repair 与 single-agent loop；新增近邻 eval，三个检查器分别守护 discovery、场景标签和正文行为边界。

- 编号：SQ-045
  问题描述：`dev-doc` discovery surface 未排除只读代码地图、调用链或兼容影响分析且明确不要实施方案的 `code-reading` 请求；OpenAI prompt 同时遗漏既有 `review-fix` 路由。
  影响范围：`dev-doc` 触发准确性、无谓方案/看板落盘、token 消耗和与 `code-reading` 的双向边界。
  优先级：P2
  发现轮次：第 45 轮
  当前状态：已完成
  相关文件：`skills/dev-doc/SKILL.md`、`skills/dev-doc/agents/openai.yaml`、`skills/dev-doc/evals.json`、`scripts/check-evals.js`、`scripts/check-skill-inventory.js`
  处理结论：portable/UI/正文均按是否需要方案产物分流 dev-doc 与 code-reading；新增只读近邻 eval，discovery 与 tag 由检查器守护；UI 同步多 AI review-fix 路由。

- 编号：SQ-046
  问题描述：eval 校验未拒绝同一 Skill 内只改 ID 的重复 prompt，可能让场景数量和覆盖指标虚高。
  影响范围：`skills/*/evals.json`、eval 覆盖可信度和 token 成本。
  优先级：P3
  发现轮次：第 46 轮
  当前状态：已完成
  相关文件：`scripts/check-evals.js`
  处理结论：按 trim + 连续空白折叠后的 prompt 在 Skill 内去重，诊断包含首次位置；自测覆盖重复，当前 141 个场景均无冲突。

- 编号：SQ-047
  问题描述：共享 workflow-chain 的职责表和下一步映射遗漏正式 Skill `conversation-handoff`，且没有与文件系统对账。
  影响范围：跨对话恢复入口、工作流单一权威文档和新增 Skill 后的索引完整性。
  优先级：P2
  发现轮次：第 47 轮
  当前状态：已完成
  相关文件：`skills/_shared/workflow-chain.md`、`scripts/check-skill-inventory.js`
  处理结论：chain 补齐 conversation-handoff 的任意阶段职责和恢复入口；inventory 对职责表精确对账、对下一步表做全量覆盖/未知项/重复标签检查，并用自测守护多分支规则。

- 编号：SQ-048
  问题描述：workflow-chain 把 code-reading 的 CodeMap 与 ImpactAnalysis 压成单一“代码地图 → 人工 review/提交”路径，与 Skill 的双模式契约冲突。
  影响范围：Understanding Gate 后续路由、聊天零写入分析和共享单一权威映射。
  优先级：P2
  发现轮次：第 48 轮
  当前状态：已完成
  相关文件：`skills/_shared/workflow-chain.md`、`scripts/check-skill-inventory.js`
  处理结论：chain 职责与下一步按 CodeMap/ImpactAnalysis 分支对齐；inventory 要求两个限定标签同时存在，自测覆盖缺分支失败。

- 编号：SQ-049
  问题描述：workflow-chain 的 review-check→review-fix 与 review-repair→review-check 分支只出现在默认下一步说明中，Claude/Codex 命令列缺少可执行入口。
  影响范围：findings 汇总、修复后二次审查、跨宿主工作流执行成功率。
  优先级：P2
  发现轮次：第 49 轮
  当前状态：已完成
  相关文件：`skills/_shared/workflow-chain.md`、`scripts/check-skill-inventory.js`
  处理结论：两条分支补齐双宿主命令；inventory 自动要求默认下一步中点名的每个正式 Skill 在两列均有真实调用，自测覆盖单宿主遗漏。

- 编号：SQ-050
  问题描述：三个看板 Skill 重复内联模板复制命令，且 bug-fix/biz-flow 的 EXISTS 分支依赖前一 shell 调用中的 `$src`，版本检查在独立 shell 下不可执行。
  影响范围：dev-doc、bug-fix、biz-flow 的看板创建/升级、初始上下文 token 和共享规则漂移。
  优先级：P1
  发现轮次：第 50 轮
  当前状态：已完成
  相关文件：`skills/_shared/board-shell-bootstrap.md`、`skills/dev-doc/SKILL.md`、`skills/bug-fix/SKILL.md`、`skills/biz-flow/SKILL.md`、`scripts/check-document-boundaries.js`
  处理结论：公共命令下沉为按需加载的两个自包含 Bash 块，每次自行定位模板且不覆盖数据；三份 SKILL 合计减 87 行，边界/链接/BOM/安装 smoke 均有守护。

- 编号：SQ-051
  问题描述：新增共享 board bootstrap 在 Windows 仅完成 Bash 语法验证；本机没有可运行的 POSIX coreutils 环境，复制/数据保留/版本 marker 尚缺行为 smoke。
  影响范围：共享看板引导的跨平台回归证据。
  优先级：P2
  发现轮次：第 50 轮
  当前状态：已完成
  相关文件：`skills/_shared/board-shell-bootstrap.md`、`scripts/check-document-boundaries.js`、`.github/workflows/check.yml`
  处理结论：document boundary 检查始终要求两个 Bash 块；非 Windows 在隔离 HOME/项目中验证复制、数据保留和版本 marker，Windows 明确 skip 行为执行且继续静态/语法检查。当前本机全量通过，Ubuntu 行为证据待提交后由既有 CI 产生。

- 编号：SQ-052
  问题描述：`conversation-handoff/reference.md` 用三反引号包裹完整 Markdown 模板，内部又含三反引号 `text` 提示块，导致外层围栏提前闭合并在 Workflow Brief 后留下未闭合围栏；现有文档检查未发现该结构错误。
  影响范围：conversation-handoff 模板的独立可读性、Agent 对输出边界的理解、Markdown 结构回归检测。
  优先级：P2
  发现轮次：第 51 轮
  当前状态：已完成
  相关文件：`skills/conversation-handoff/reference.md`、`scripts/check-docs.js`、`scripts/check-workflow-briefs.js`
  处理结论：模板外层改为四反引号；docs 检查按围栏字符/长度/info-string/缩进规则检测全部 Skill Markdown 的未闭合块并有原缺陷负例；Workflow Brief 提取器兼容至少三个反引号或波浪号的纯终止行。

- 编号：SQ-053
  问题描述：`check-docs.js` 的本地链接与 Markdown 锚点检查只遍历 `skills/`；README、workflow guide、why 文档等正式入口的相对路径或锚点失效时仍可能通过全量检查。
  影响范围：用户入口文档、维护指南、CI 文档回归能力。
  优先级：P2
  发现轮次：第 52 轮
  当前状态：已完成
  相关文件：`scripts/check-docs.js`、`README.md`、`docs/*.md`
  处理结论：链接检查现覆盖全部 Skill Markdown 与 requiredDocs 中的维护文档，共 113 个本地链接；inline-code 伪链接被过滤、真实 code-label 链接保留，生成索引/日期产物/归档明确排除。故障注入证明缺失目标会失败且临时文件已清理。

- 编号：SQ-054
  问题描述：`review-loop` 的正文、reference 和 eval 都限制最多 2 个修复循环，但 frontmatter description 仍用“直到没有 Critical/Important”触发且未声明上限，OpenAI default prompt 也未携带循环停机和残留 blocker 不进入 Submit Gate 的边界；现有检查只守正文。
  影响范围：review-loop portable discovery、Codex UI 默认提示、无限重试风险和 Submit Gate 准确性。
  优先级：P1
  发现轮次：第 53 轮
  当前状态：已完成
  相关文件：`skills/review-loop/SKILL.md`、`skills/review-loop/agents/openai.yaml`、`scripts/check-skill-inventory.js`
  处理结论：portable description 与 OpenAI default prompt 均明确最多 2 个修复循环；两轮后仍有 Critical/Important、验证失败或环境阻塞时保留 finding ID，输出 `PartiallyFixed`/`Blocked` 并停止在 Submit Gate 之前。inventory 同时守护两处停机短语，定向检查已通过。
