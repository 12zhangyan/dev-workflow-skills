---
name: dev-doc
description: 在编码前把新功能、前后端改造、接口签名变化、重构、性能或配置需求落成有证据、可执行、可验收的开发方案。仅当用户明确要求“开发方案/改造方案/实施文档/先设计再编码”，或存在尚未裁决的接口、权限、状态、DB、事务、跨模块高风险决策而必须先形成可审核方案时使用；用户已经明确要求直接实现且范围与验收口径足够清楚时不要触发。HTML 看板仅在用户明确要求或适用项目规则要求发布时登记。Bug/业务流/代码影响分析改用 project-analysis 的 incident/business/understanding；审查任务包、只读审查、findings 修复或单 AI 闭环改用 code-review 的 package/check/repair/loop。Codex 用自然语言点名 dev-doc skill；Claude Code 可用 /dev-doc；Cursor 按当前 skill 入口或自然语言点名。
argument-hint: [任务名称]
arguments: task
disable-model-invocation: true
allowed-tools: Write, Read, Edit, Bash, Glob, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# 开发文档生成（开发工作流 - Step 1）

## 任务定位

本 Skill 是显式的 Plan Gate 工具：把需要先评审的需求落成文档，驱动后续编码、自测和 Code Review。它不是所有实现任务的必经步骤；用户直接要求修改代码且关键边界已有证据时，由编码 Agent 直接实施和验证，不为流程完整性强行生成 dev-doc。

用户只要求理解现有代码结构、调用链、接口契约或兼容性影响，且明确不要实施方案时，使用 `code-reading`，不生成 dev-doc 或看板条目。若这些只读结论是开发方案的前置证据，可先运行 `code-reading`，再把证据交给本 Skill 产出方案。

**一次运行的核心产物是 md 执行文档**：精确的文件路径、变更清单、约束条件、可执行 Todo，写给 Codex / Cursor / Claude Code 或开发者照着执行。

**HTML 看板是可选发布产物**：只有用户明确要求“登记/更新/发布看板”，或当前项目规则明确要求 dev-doc 同步看板时才执行 Step 5.5/5.6。普通方案生成不初始化、不升级、不写入看板，也不为看板推断服务/模块归属。

md 文档必须**可执行**——结尾给出明确的下一步 Todo 清单。

## 执行流程

### 共享交互协议

先执行 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)：证据预填 → 风险分级 → 单点确认 → 冲突显式记录。信息槽位只用于查漏，不是逐条问卷。

**交互能力兼容与降级：** 不按产品名猜工具，先检查当前宿主、会话和模式实际暴露的能力。Claude Code 可能提供 `AskUserQuestion`，Codex 可能在特定模式提供结构化用户提问能力，Cursor 或其他模式可能只支持普通聊天；`AskQuestion` 仅视为宿主可能使用的别名，未实际暴露时不得调用。

同一会话可能出现多个候选提问工具。只选择**当前确实已暴露且参数结构兼容**的工具，不按名称列表盲试。某个候选返回“不可用 / 当前模式不支持 / 调用失败”后，记录该失败并且同一问题不再重试该工具；若还有另一个已暴露且兼容的候选，可切换一次，否则立即进入聊天降级。工具失败不能触发自动选择默认项，也不能让流程卡在重复调用工具名上。

按以下顺序处理封闭选项：
1. 当前模式暴露一个或多个可用的结构化单选工具 → 按上述能力规则选择一个；失败时至多切换到另一个已暴露候选，每次只问一个问题。
2. 没有结构化工具或调用明确失败，但当前是可等待回复的交互会话 → 降级为普通聊天单选，格式为：`请选择：A. ... / B. ... / C. ...（默认建议：<选项或暂不选择>；理由/依据：...）`，然后等待回复。
3. 当前是 `-p`、批处理、自动化等非交互/无人值守运行 → 低风险未知可按下述证据口径记录假设后继续；高风险未知必须写入 `blockers`，输出 `Plan Gate 未通过` 并立即停止。此分支不进入 Step 4-5.6，不写 md、OpenAPI、看板或索引，也不运行 build；不得用默认项代替用户授权。

- 默认建议按证据优先级推导：`用户明确范围 > 正式需求/接口契约 > 目标模块代码 > 相邻实现`，并写明依据。高优先级证据与低优先级证据冲突时不推荐具体选项，记录到 `conflicts` 并写 `默认建议：暂不选择，待确认`；不得用相邻实现扩大用户已确认范围。
- 默认建议只是推荐口径，不代表用户已经授权。接口范围/契约、状态流转、权限、数据归属、DB 结构、回滚语义、文件覆盖等高风险或会改变执行路径的问题，必须收到用户明确选择后再继续；不得因工具不可用、调用失败或运行超时而静默采用默认项。
- 低风险且不阻塞方案的问题，可以写明 `若无异议，暂按 <有证据的默认项> 推进` 后继续，并把该口径记录到 `assumptions` /「判断依据与待确认」。
- 例如确认接口面时，可询问：`请选择接口范围：A. 对齐既有上传/列表/删除能力 / B. 仅实现本次明确涉及的接口（默认建议：<根据范围说明和相邻实现推导>；理由/依据：<证据位置>）`；这是接口契约边界，收到用户选择前不得把任何选项写成已确认事实。

同时遵循 [../_shared/workflow-gates.md](../_shared/workflow-gates.md)：本 skill 完成的是 Plan Gate；输出必须说明产物路径、阻塞项/冲突/假设、VCS Gate、Verification Gate、Review Gate 和后续 code-reading / 人工 review 入口。

### Step 0：参数检查

- `$task` 为空 → 询问用户："这次要做什么任务？用一句话描述（如 '用户登录优化'）"
- 任务名规范化：
  - 英文：转小写 + 空格转 `-`（`user login` → `user-login`）
  - 中文：保留原样（`用户登录优化`）
  - 文件名清洗：`/ \ : * ? " < > |` 及多余空格统一替换为 `-`（`用户 Login/优化` → `用户-Login-优化`）

### Step 1：静默收集环境上下文（不打扰用户）

执行以下命令，结果**用作引导提问和 Step 6 输出填充**，不展示给用户：

```bash
# VCS 类型检测（记住 VCS_TYPE=git/svn/none，用于 Step 6 填入代码审查命令）
vcs_root="$PWD"
vcs_type="none"
while [ "$vcs_root" != "/" ]; do
  if [ -e "$vcs_root/.git" ]; then vcs_type="git"; break; fi
  if [ -d "$vcs_root/.svn" ]; then vcs_type="svn"; break; fi
  parent=$(dirname "$vcs_root")
  [ "$parent" = "$vcs_root" ] && break
  vcs_root="$parent"
done
case "$vcs_type" in
  git)
    echo "VCS_TYPE=git"
    git -c "safe.directory=$vcs_root" -C "$vcs_root" branch --show-current 2>/dev/null
    git -c "safe.directory=$vcs_root" -C "$vcs_root" status --short 2>/dev/null
    git -c "safe.directory=$vcs_root" -C "$vcs_root" log --oneline -3 2>/dev/null
    ;;
  svn)
    echo "VCS_TYPE=svn"
    svn info "$vcs_root" 2>/dev/null | grep -E "^(Relative URL|Revision):"
    svn log "$vcs_root" -l 3 2>/dev/null
    ;;
  *) echo "VCS_TYPE=none" ;;
esac
# 项目类型检测（记住结果，用于 Step 6 填入验证命令；支持 monorepo 子目录）
find "$vcs_root" -maxdepth 3 \( -name pom.xml -o -name build.gradle -o -name package.json \) 2>/dev/null
```

判断规则：先按目录结构识别 Git/SVN，不要用"git 命令失败"推断为无 VCS。Git 出现 dubious ownership / safe.directory 报错时，只使用 `git -c "safe.directory=$vcs_root"` 做本次只读命令，不修改全局 git 配置。

### Step 2：确认任务类型、复杂度和归属（少问、先判断）

#### 既有文档增量修订快捷路径

当用户同时给出**一篇或多篇可读的既有 dev-doc md 路径**和一段边界明确的增量描述时，先逐篇读取旧文档并启用 `IncrementalRevision`，无需重新走完整新需求问答：

1. 将全部旧文档记录为 `前置文档`。只有一篇时使用单链接；有多篇时使用“文档名称 + 仓库相对链接 + 承接主题/范围”的逐项必读清单，不得只保留或只读取日期最近的一篇；旧文档只作证据，不默认覆盖或追加。
2. 从全部旧文档继承服务/模块、背景、既有接口契约、禁止改动和验证口径，只围绕增量差异补槽位；非阻塞信息不重复确认。多篇文档口径冲突时按证据优先级显式记录 `conflicts`，不得按文档时间新旧静默覆盖。对话中被用户明确否决的旧口径也必须保留为 `conflicts(status=resolved)`，写清旧口径、否决证据、最终口径和实现禁令；不得因已裁决就从文档消失，也不得把它继续算作 blocker。
3. 若增量只是多值取首、校验/路由/过滤/状态判断或副作用调整，且 method/path、请求、响应、状态码/错误码和鉴权输入均无变化，暂归为 `行为变更`。
4. “默认行为变更”只是有证据的预分类，不是跳过核验：发现新增接口或任一契约面变化时立即升级为 `新增接口 / 契约变更`，恢复对应 API/OpenAPI 章节。
5. 纯行为变更或仅调用既有接口时，生成精简增量文档，删除「三、API 设计」和「十三、Apifox 接口规范」，不生成 OpenAPI，且看板 `apis[]` 为空。
6. 新文档只写增量背景、与前置文档关系、变更边界、最小技术改动、兼容性、Todo、验证和评审点；未变化的大段内容用前置文档链接承接，不复制全文。AI 执行口径的前置条件必须要求执行方逐篇读取清单中的全部前置文档，并说明每篇承接的约束。

旧文档不存在、不可读、不是 dev-doc，或增量描述会改变业务/API/权限/DB 决策时，不启用快捷路径，回到标准流程并按阻塞规则处理。

#### 简单实现精简模式

仅当以下条件**全部满足**时启用 `Compact`：同一模块内最多 2 个生产代码切点（如解析支持类 + Service 接入点）和 1 个聚焦测试；只是向后兼容的解析/适配/分支支持；method/path、请求、响应、状态码/错误码和鉴权输入不变；不涉及 DB、权限、状态流转、事务边界、外部副作用、跨模块发布或 blocker/conflict；目标与验证口径已有证据。用户说“直接实现”且证据满足时可自动选择，不再为模式单独提问。

`Compact` 只生成一份 `docs/<日期>/<任务名>.md`，使用 [精简文档模板](reference.md#精简文档模板)，保留范围/非目标、兼容性依据、两个以内改动点、验证、回滚、Todo 和评审点；跳过 Step 5.1、5.5、5.6，不生成 OpenAPI、看板、单页或索引。任一条件不满足，或预计范围扩张时立即升级为 `Standard`；给了既有 dev-doc 路径时优先使用 `IncrementalRevision`。

**先从 `$task`、路径、已有代码、接口名、模块名、Step 1 上下文推断并预填。封闭选项只有在会影响文档结构或后续执行时才使用当前模式实际提供的结构化单选工具；工具不可用时按“交互能力兼容与降级”处理。自由文本问题只问阻塞项。**

任务类型可明显判断时直接记录并继续；不确定或会影响模板时再问（结构化单选工具可用则使用，否则按降级规则处理）：

> 任务类型是？（新功能 / Bug 修复 / 重构 / 性能优化 / API 联调 / 配置变更）

若用户选"Bug 修复"且目的是记录现象、分析根因 → 提示："这类任务建议改用 project-analysis skill，mode=incident（专门的 Bug 记录与根因分析流程，会登记到看板的 Bug 区）。继续用 dev-doc 吗？" 用户确认继续才往下走。

复杂度可按改动范围、模块数量、接口数量和代码证据判断时直接记录；只有复杂度会改变拆分策略、模型建议或验收范围时才确认。

> 复杂度我初步判断是「<建议值>」，对吗？（简单：改动一眼可见，约 ≤50 行 / 中等：50–500 行 / 复杂：>500 行、跨模块或方案不明确）

若用户选"复杂"，只在当前宿主确实支持模型切换时建议选择高推理档；Claude Code 可提示 `/model opus`，Cursor/Codex 使用当前宿主实际提供的模型入口，不虚构命令。

归属优先从当前目录、包名、Controller、模块名推断；无法确定时再问（Step 5.5 写看板时直接使用，避免收尾时再打断）：

> 这属于哪个微服务/模块？格式 `服务/模块`（如 `订单服务/支付`；单体项目填 `项目名/模块名`；不确定填 `通用/通用`）

### Step 3：按类型补齐需求（只问阻塞问题）

**规则：先把用户已说清楚的内容、代码里能确定的入口/字段/状态、现有文档里的约束填入草稿；不要机械按槽位逐条问。确需询问时每次只问一个，并说明为什么这个答案会影响方案。**

具体查漏槽位见 [reference.md](reference.md#step-3-查漏槽位)：简单任务最多补 2 个槽位；新功能 / Bug / 重构 / 性能 / API 联调 / 配置变更最多补 5 个槽位。可以 0 问，不要为了凑数量提问。

提问引导：利用 Step 1 拿到的 git 上下文和源码线索做引导式提问。
- 能从代码/文档确定 → 直接填入，并在文档中写来源或依据。
- 低风险未知（只影响描述文案、非核心命名）→ 明确写"暂按……假设"，继续生成。
- 高风险未知（状态流转、权限边界、数据归属、接口契约、DB 结构、回滚语义）→ 暂停并只问这一项。
- 用户答"不知道"/"待定" → 记为 `待补充`，但不要继续追问同类非阻塞细节。
必要信息足够后告知用户："信息足够，开始生成文档；未确认项会集中标注。"

涉及接口时，对**每个接口**先分类，不能用“本任务涉及接口”笼统代替：

| 分类 | 判定口径 | 文档与产物 |
|------|----------|------------|
| 新增接口 | 新 method/path | 进入 API 设计、OpenAPI、看板 `apis[]` |
| 契约变更 | 修改 method/path、请求字段/类型/必填性、响应字段/类型、状态码/错误码结构、鉴权输入等调用方契约 | 进入 API 设计、OpenAPI、看板 `apis[]`，明确兼容影响 |
| 行为变更 | method/path 和请求/响应契约不变，只收紧服务端校验、路由、过滤、状态判断或副作用 | 写入技术方案、接口影响分类、兼容性与测试；不重写该接口 OpenAPI，不登记到看板 `apis[]` |
| 仅调用既有接口 | 调用方式和既有契约/行为均不修改 | 只写调用关系；不生成该接口 OpenAPI，不登记到看板 `apis[]` |

用户说“原参数不动”时，先核对响应结构、状态码/错误码和鉴权输入是否也保持不变；只有这些契约面均不变，才能归为行为变更。一个任务同时包含原接口行为收紧和新接口时，OpenAPI 只包含新接口及真正发生契约变化的接口，禁止顺手全量重写原接口规范。

### Step 4：路径处理（跨平台）

一条 bash 命令完成日期获取和目录创建：

```bash
d=$(date +%F) && mkdir -p "docs/$d" && echo "$d"
```

命令输出即为日期字符串（如 `2026-05-31`），拼接为最终路径 `docs/<日期>/<任务名>.md`。

**冲突处理**：先用确定性命令判断目标路径状态，不能用 Read 失败推断文件不存在。将 Step 4 得到的最终候选路径赋给 `target`：

```bash
if [ ! -e "$target" ]; then
  echo MISSING
elif [ -f "$target" ] && [ -r "$target" ]; then
  echo EXISTS_READABLE
else
  echo EXISTS_UNREADABLE_OR_UNKNOWN
fi
```

- `MISSING` → 直接生成。
- `EXISTS_READABLE` → Read 现有内容后，使用当前可用的结构化单选工具询问；工具不可用时按交互降级规则处理：
  - `A` 覆盖（整个文件重写）
  - `B` 加时间戳后缀（`<任务名>-1530.md`）
  - `C` 加版本号后缀（`<任务名>-v2.md`）
  - `D` 取消
  - `E` 追加更新（保留现有内容，在文档末尾追加「变更记录」段落）
- `EXISTS_UNREADABLE_OR_UNKNOWN`，或确定存在但 Read 失败 → 记录 blocker，输出 `Plan Gate 未通过`，不得写目标文件、OpenAPI、看板或索引。
- 非交互/无人值守运行遇到任何已存在或状态未知的目标路径 → 不自动选择覆盖/后缀/追加；记录 blocker 并停止所有落盘步骤。

### Step 5：生成文档

`Standard` / `IncrementalRevision` 加载完整模板：[reference.md](reference.md#文档模板)；`Compact` 加载 [精简文档模板](reference.md#精简文档模板)。
参考已填示例：[examples.md](examples.md)

**核心规则**：
- 只使用用户提供的信息和代码/文档证据；未确认的标 `待补充` 或明确假设，不能把猜测写成事实
- **显式暴露需求冲突**：如果用户需求与现有代码路径、状态机、字典值、权限模型、数据归属或表复用方式冲突，按共享协议的冲突记录模板写入「判断依据与待确认」；对话中已被用户否决的方案写为“需求冲突（已裁决）”，后续执行只采用最终口径，不要静默折中或复活旧方案
- **停止规则**：交互会话中已经安全确定新文件路径时，存在阻塞型 `blockers` 或 `conflicts` 可只生成待确认文档，不生成可直接粘贴执行的编码提示；非交互 blocker、目标路径不可读或路径冲突未选择时，在落盘前停止，不生成 md/OpenAPI/看板/索引，也不运行 build
- **开闭原则贯穿全文档**：方案优先扩展，必须修改的要在"最小影响分析"说明原因
- **AI 执行口径必须写实**：在技术方案里明确前置条件、执行顺序、验收标准、禁止改动；不要只写"按方案实现"
- **不相关章节直接删除**：纯后端任务不留前端章节，简单 Bug 不写复杂流程图
- **接口文档仅由新增/契约变更触发**：仅当本次存在新增接口或契约变更时，才保留「三、API 设计」与「十三、Apifox 接口规范」。纯行为变更或仅调用既有接口不触发 OpenAPI；混合任务只把新增/契约变更接口写入两节和看板 `apis[]`，原接口行为收紧留在技术方案、接口影响分类、兼容性和测试中，不全量重写原接口规范
- **增量修订保持短小**：`IncrementalRevision` 只描述相对前置文档的变化，并在文首写可点击的仓库相对链接；多篇前置文档必须逐项写名称、链接和承接范围，并要求执行方全部读取，不得只读最近一篇；不复制未变化章节。快捷路径的行为变更预分类必须经过契约面核验，不能凭“一句话边界”掩盖真实接口变化
- **Apifox/OpenAPI 独立产物**：满足上一条时，必须把可导入 Apifox 的 OpenAPI 3.0 YAML 单独生成到 `docs/apifox/<日期>/<任务名>.openapi.yaml`，并更新 `docs/apifox/INDEX.md`；md 的「十三、Apifox 接口规范」只放文件位置、导入说明、接口索引和维护规则，不再内嵌完整 YAML
- **OpenAPI 填写口径**：根据用户提供的接口信息填入 `paths` / `components.schemas`；未确认字段用 `# 待补充` 注释标记。后续接口变更优先更新同一个 `apiSpecPath` 文件，不要只改 md 接口表或另起新 YAML 文件
- **数据库门禁**：数据库操作始终只读。新增库/表/字段/索引/约束等结构变化属于高风险未知，必须先取得用户明确同意；文档只能生成“DBA 变更申请草案 + 建议 DDL/回滚方案 + 影响评估 + 只读验证 SQL”，不得执行 DDL、数据修复或把“在 test/prod 执行 SQL”写成 AI Todo。未获同意时记为 blocker，不进入 Implementation Gate

### Step 5.1：生成 Apifox/OpenAPI 文件与索引（仅接口变更时）

当 Step 5 判定存在新增接口或契约变更时执行；只有行为变更或仅调用既有接口时跳过本步。

```bash
mkdir -p "docs/apifox/$d"
```

执行顺序：
1. 确认最终 `mdPath`（Step 4 冲突处理后的真实路径）与 `apiSpecPath`，两者文件名后缀保持一致。
2. 创建或更新 `apiSpecPath`，写入可导入 Apifox 的 OpenAPI 3.0 YAML。
3. 创建或更新 `docs/apifox/INDEX.md`，按 `源 md + OpenAPI 文件` 作为去重键；命中既有行就更新该行，不重复追加。
4. 回填 md「十三、Apifox 接口规范」：只写文件位置、导入方式、接口索引和维护规则，不内嵌完整 YAML。
5. 回填看板 entry：写入 `apiSpecPath`、`apiIndexPath`，并在 `apis[]` 中只登记新增或契约变更接口；行为变更接口不得混入。

产物规则：
- OpenAPI 文件路径：`docs/apifox/<日期>/<任务名>.openapi.yaml`
- Apifox 索引路径：`docs/apifox/INDEX.md`
- 若 Step 4 因文件冲突选择了时间戳/版本号后缀，OpenAPI 文件名必须使用同一个后缀，保证 md 与 YAML 一一对应
- 若 Step 4 选择 A 覆盖或 E 追加更新，优先更新同一个 OpenAPI 文件，不重复生成第二份
- `docs/apifox/INDEX.md` 至少包含：日期、服务/模块、任务、OpenAPI 文件、源 md、接口列表、维护备注
- md「十三、Apifox 接口规范」必须写明 `apiSpecPath`、`apiIndexPath`、Apifox 导入方式，以及“后续接口变更要更新此 YAML 文件”的维护规则
- 看板 entry 必须同步写入 `apiSpecPath`；生成索引时写入 `apiIndexPath: "docs/apifox/INDEX.md"`
- `docs/INDEX.md` 只由 `node project-html/build.js` 覆盖生成，不手工编辑；它会从看板 `apiSpecPath` 生成 OpenAPI 链接列

优先运行随 skill 安装的确定性校验器：
```bash
validator=""
for root in "$HOME/.codex/skills" "$HOME/.claude/skills" "$HOME/.cursor/skills" "$HOME/.agents/skills"; do
  candidate="$root/dev-doc/scripts/validate-openapi.js"
  [ -f "$candidate" ] && validator="$candidate" && break
done
[ -n "$validator" ] && node "$validator" "$apiSpecPath"
test -f docs/apifox/INDEX.md && grep -q "$apiSpecPath" docs/apifox/INDEX.md && grep -q "$mdPath" docs/apifox/INDEX.md
```

按以下结果分流，禁止把 YAML 校验失败误判成环境受限：
1. 校验器成功并输出 `OPENAPI_VALIDATION_MODE=full:<parser>` → 记录“完整解析校验通过，Apifox 实际导入未验证”。
2. 校验器成功并输出 `OPENAPI_VALIDATION_MODE=light:no-yaml-parser` → 记录“静态结构校验通过（无 YAML parser），Apifox 实际导入未验证”。
3. 找不到校验器，或宿主明确报告工作区外 skill 路径被沙箱/权限/访问策略阻止、脚本无法启动 → 运行 [reference.md 的工作区内 OpenAPI 静态校验降级](reference.md#工作区内-openapi-静态校验降级)，只读取 `apiSpecPath`，输出 `OPENAPI_VALIDATION_MODE=light:workspace-inline`。不得要求放宽用户目录权限，也不得仅凭人工目测判定通过。
4. 校验器已经启动并报告 `FAIL:`、YAML 解析错误、缺少 operationId、重复 operationId 或未解析 `$ref` → 这是产物失败；先修正 YAML，再重跑原校验器。此分支不得切到轻量校验规避失败。

完整校验器在环境已有 `yaml` / `js-yaml` 时解析 YAML 并检查 OpenAPI 3.x、HTTP operation、`operationId` 非空/唯一和本地 `$ref`；无 YAML parser 或工作区内降级时仍检查这些静态结构。任何模式都不能证明 Apifox 实际导入成功。未确认字段只写 `# 待补充` 注释或文档待确认清单，不得创建 `pendingField` 等伪契约字段。

### Step 5.5：同步更新 HTML 看板

**进入条件**：用户明确要求登记/更新/发布 HTML 看板，或适用的项目级规则明确要求同步看板。未命中时跳过 Step 5.5 和 5.6，记录 `BoardPublishStatus: NotRequested`；不得因为仓库里恰好存在 `project-html/` 就自动升级或写入。

看板为多文件结构，**skill 默认只通过 `board-add.js` 更新轻量目录与人类方案详情，不手改外壳/样式/逻辑**。外壳版本较低时只按下方升级命令复制模板外壳，绝不覆盖 `data/`。

> **⚠️ 强制规则**：修改 `data/changes.js` 的主路径只能是 `node project-html/board-add.js project-html/data/_entry.json`，**禁止用 Write 整体重写**。只有 `node` 不存在时，才允许用 Edit 在标记行降级追加/更新。判断看板"是否存在"必须用下方的 `test -f`（确定性判断），不要凭 Read 工具的报错/记忆去猜——上下文压缩后误判"不存在"走到 Write 模板分支，是已发生过的真实事故（21 条记录被整体覆盖成 4 条）。

```
project-html/
  index.html        ← 外壳（加载 css/js/data）
  css/board.css     ← 样式
  js/board.js       ← 渲染逻辑（服务→模块两级树 / 浏览索引 / 接口索引 / Bug 视图）
  data/changes.js   ← 轻量目录（首页 / 搜索 / 筛选）
  data/details/     ← 独立的人类方案详情（点击条目后按需加载）
```

**定位：看板条目不是 md 的摘录，而是一篇独立的、给人看的技术说明。** md 写给 AI 执行（精确路径、指令式），看板写给「没参与本次开发的同事」阅读——Reviewer、接手的人、三个月后的自己。输入 entry 是一篇完整的人类方案，`board-add.js` 会确定性拆成轻量目录与详情文件。**不得读取 md 后截取段落充当看板内容**；两份产物只通过 `docPath` 等结构元数据关联。
字段分两类：

**结构字段（照搬，不加工）：**

| JS 字段 | 来源 |
|---------|------|
| `service` / `module` | Step 2 确认的归属（`服务/模块` 前后半段） |
| `title` | `$task`（任务名） |
| `date` | Step 4 获取的日期 |
| `type` / `complexity` | Step 2 确认值 |
| `status` | 固定值 `草稿` |
| `branch` | Step 1 检测到的 Git branch 名 |
| `docPath` | 本次生成的 md 路径（看板用它链接源文档） |
| `apiSpecPath` | Apifox/OpenAPI YAML 路径；仅接口变更时填写 |
| `apiIndexPath` | Apifox/OpenAPI 索引路径；生成 YAML 时固定为 `docs/apifox/INDEX.md` |
| `apis` | md `## 三、API 设计` 表格 → `{method, url, operationId, desc, request?, response?, specPath?}[]`；**仅登记新增或契约变更接口**，纯行为变更/仅调用不登记；有 `apiSpecPath` 时必须非空 |

**叙述字段（不要从 md 截取片段，基于已收集的信息面向人类重新撰写）：**
写作要求：完整句子、讲清楚"为什么"、不留模板腔、不写"详见 md"。可用 `\n` 分段，看板按段落渲染。必须同时照顾两类读者：业务人员读完能知道影响、目标、验收口径；开发人员读完能知道方案、改动边界、下一步动作。检验标准：一个不了解这个任务的同事读完，能在站会上转述这次改动。

| JS 字段 | 写什么 |
|---------|--------|
| `background` | 为什么做这件事：业务痛点 + 触发契机，3–5 句。不要复述任务名 |
| `goals` / `scopeIn` / `scopeOut` | 用业务和方案边界表达目标、包含范围与非目标，不写 Agent 操作步骤 |
| `solution` | 用大白话讲整体怎么实现的：数据怎么流、新增了什么、动了什么，1–2 段 |
| `coreDesign` | 关键技术取舍：选了什么方案、放弃了什么备选、为什么，1–2 段；没有真正的取舍就省略此字段 |
| `keyImpl` | 3–6 条决策点 → `{title: 决策名, desc: 问题→做法→原因，2–3 句}`；不是代码清单的复读 |
| `flowchart` | 让人快速理解方案流转的 Mermaid 图（不含 ` ``` ` 标记） |

**Agent 专属字段禁止写入看板 entry**：`changeList`、`todos`、`stackTrace`、`codeLocation`。精确文件路径、修改动作、实现顺序、验证命令、行号和原始诊断证据只写 md；`board-add.js` 也会在写入时丢弃这些字段，作为最后一道防线。
**字符串转义**（否则看板 JS 语法错误，整页打不开）：
- 字段值含双引号 → 转义为 `\"`；含换行 → 合并为一段或用 `\n`
- `flowchart` 用反引号模板字面量包裹；内容本身含反引号时改用双引号 + `\n` 转义

创建、比较或升级看板外壳时，按需读取 [共享看板外壳引导](../_shared/board-shell-bootstrap.md)。其中每个命令块都会重新定位模板目录，复制时只在缺失状态初始化 `data/changes.js`，不会覆盖既有数据。

**判断看板是否存在**（bash 确定性判断，不靠模型解读 Read 结果）：

```bash
test -f project-html/data/changes.js && echo EXISTS || echo MISSING
```

- **MISSING** →
  1. 若 `project-html/index.html` 已存在且内含 `const changes`（旧版单文件看板）→ 先把其中的 `changes` / `htmlChangelog` 两个数组原样迁移到新建的 `data/changes.js`（带标记行）。
  2. 否则执行共享引导的「定位并复制或升级外壳」——其中 `test -f ... || cp` 会补上一份**空的** `data/changes.js` 模板。两种情况这一步都不写数据，交给下方 ② 的 `board-add.js` 统一写入（首次创建同样要进入 Step 5.6 构建）。
  3. **检测 VCS**（仅本次新建时提示一次，不代为执行）：
     ```bash
     if [ -d .svn ]; then echo "💡 检测到 SVN 工作副本，建议执行: svn add project-html --depth=infinity，把看板数据纳入版本管理"; elif [ -d .git ]; then echo "💡 检测到 Git 仓库，建议把 project-html/ 加入版本管理: git add project-html"; fi
     ```
- **EXISTS** → 先执行共享引导的「只读比较版本」。输出 `BOARD_SHELL_UPGRADE_REQUIRED` 时再执行「定位并复制或升级外壳」（`data/` 不动）；升级目标为 v23 或更高时，再运行 `node project-html/board-add.js --migrate`，把旧富记录拆为目录 + 人类方案详情，并输出一行：`🔄 看板外壳与数据结构已升级到 v<N>`。输出 `BOARD_SHELL_CURRENT` 时直接进入 ②。

**② 用 board-add.js 写入条目（确定性脚本，替代手工 Edit）**

把本次提取的字段组成一个 entry 对象、连同变更日志描述写进一个临时 JSON 文件，交给脚本一次性写入。**备份、按 `docPath` 查重、转义、记录数回归校验全在脚本里完成**——AI 只负责产出结构化字段，不再手改 `data/changes.js`，从根上杜绝「误判看板不存在 → 整体覆盖」事故。

下例是**存在接口变更**时的写法；如果本次没有新增接口或接口签名变更，必须删除 `apiSpecPath` / `apiIndexPath` 两个字段，并保持 `apis: []`。如果生成了 `apiSpecPath`，`apis` 必须至少包含一条接口，接口级 `specPath` 可省略；只有一个任务拆出多个 OpenAPI 文件时才给单个接口写 `specPath` 覆盖任务级路径。

```bash
cat > project-html/data/_entry.json <<'JSON'
{
  "changelog": "新增文档：<title>",
  "entry": {
    "service": "<service>", "module": "<module>", "title": "<title>",
    "date": "<date>", "type": "<type>", "complexity": "<complexity>",
    "status": "草稿", "branch": "<branch>", "docPath": "<docPath>",
    "apiSpecPath": "<apiSpecPath>", "apiIndexPath": "docs/apifox/INDEX.md",
    "background": "<background>",
    "goals": [<goals>], "scopeIn": [<scopeIn>], "scopeOut": [<scopeOut>],
    "apis": [{"method":"POST","url":"/api/v1/example","operationId":"createExample","desc":"新增示例资源"}],
    "solution": "<solution>", "coreDesign": "<coreDesign>",
    "flowchart": "<flowchart>",
    "keyImpl": [<keyImpl>]
  }
}
JSON
node project-html/board-add.js project-html/data/_entry.json && rm -f project-html/data/_entry.json
```

写 entry 的规则：
- **标准 JSON**：字符串值用双引号，内部换行写成 `\n`，**不要用反引号**；`flowchart` 也是普通 JSON 字符串（用 `\n` 分行，不含 ` ``` ` 标记）。非空字段才写，空数组可省略。
- **查重自动处理**：脚本按 `docPath` 命中既有条目时**就地更新并保留原 status，以及输入中省略的 lifecycle/pinned 治理字段**，同时维护 `updatedAt`；否则追加。Step 4 选了 A 覆盖 / E 追加更新时无需特殊操作，只把 `changelog` 文案改成 `更新文档：<title>` 即可。
- **职责拆分**：脚本把 entry 拆为 `data/changes.js` 轻量目录和 `data/details/<detailId>.js` 人类方案详情；目录不携带正文，详情不携带 Agent 专属字段。升级到 v23 时先运行一次 `node project-html/board-add.js --migrate` 拆分旧富记录。
- **结果与回滚**：脚本打印 `✓ 看板已追加/更新…（目录 X → Y，详情 …）`；若校验失败（语法错误或记录数下降）脚本会**放弃写入并保持原文件不动**，按提示排查后重试，不要去手改文件。
- **`node` 不存在** → 跳过脚本，降级手工：用 Edit 在 `// ─── 在此行上方追加新记录 ───` 上方插入同一个对象（注意 JS 转义：双引号 `\"`、换行 `\n`），并在 `// ─── 在此行上方追加变更日志 ───` 上方插入 `{ date: "<date>", desc: "新增文档：<title>" }`；改完提示用户手动打开看板确认页面正常。

输出一行提示：`📄 HTML 看板已更新：project-html/data/changes.js + project-html/data/details/（浏览器打开 project-html/index.html 查看）`

### Step 5.6：生成轻量详情页 + 文档总索引（构建）

仅当 Step 5.5 的看板进入条件成立且条目已成功写入时执行；`BoardPublishStatus: NotRequested` 时不得运行 `build.js`。

`data/changes.js` 通过 `node --check` 后，运行构建脚本（一条命令完成单页与索引）：

```bash
node project-html/build.js
```

它会：
1. 为**每条**记录增量维护轻量详情页 `project-html/pages/<slug>.html`（共享 CSS + 渲染逻辑 + 本地 mermaid；内容未变化时不重写，只清理孤儿页）
2. 构建时合并轻量目录与对应人类方案详情，并由目录重新生成 `docs/INDEX.md` 文档总索引（按服务/模块归类，含 md 源文档与单页链接）
3. **首次运行**（`docs/archive/` 不存在）扫描项目根目录，把散落的旧 md 文档、旧看板 HTML、接口文档**复制**（不删原件）到 `docs/archive/` 统一归档，并登记进 `INDEX.md`

需要把某一条记录作为单个 HTML 文件外发时，显式运行：

```bash
node project-html/build.js --standalone "<docPath 或 slug>"
```

产物写入 `project-html/exports/<slug>.html`，其中才会内联 CSS、渲染逻辑和 Mermaid。不要在常规构建中为全部记录生成自包含文件。

- `node` 不存在 → 跳过本步，提示用户："未检测到 node，无法生成单页与索引，请安装 node 后运行 `node project-html/build.js`"
- 输出脚本回显（含总数、实际写入数和孤儿清理数），并提示：`📑 已生成轻量详情页 pages/ 与文档总索引 docs/INDEX.md`

### Step 6：输出 Next Steps

模板见 [reference.md](reference.md#完成后输出格式)。

`Compact` 改用 [精简模式完成输出](reference.md#精简模式完成输出)，artifacts 只列 md，明确看板/OpenAPI/索引均为 `NotApplicable (Compact)`。Standard / IncrementalRevision 未请求看板时写 `BoardPublishStatus: NotRequested`，不把它描述为失败或待补任务。

核心要素：
1. 文件路径（可直接打开）
2. 关键决策 3 句话摘要
3. Codex / Cursor / Claude Code 执行提示（可直接粘贴给当前 AI 宿主）
4. 当前门禁：`Plan Gate 已完成`；若存在 blocker/conflict，写 `Plan Gate 未通过` 并停止，不输出可执行编码提示
5. 执行结果回填要求：要求实现方逐项回填 Todo 完成情况、变更文件、验证命令、偏离项；实现结束立即读取 `git status --short` / `svn status`，把新增源码、测试、配置、OpenAPI 和正式 docs 的未纳管清单显式交给用户，不得直接跳到 review-loop 后才暴露 VCS blocker
6. 验证命令：用 Step 1 检测到的项目类型自动填入；多模块项目优先给模块级命令（例如 `mvn -f <module-pom> test` 或 `mvn -pl <module> -am test`）。每条命令标记 `TestDependencyClass`（`Hermetic / ServiceBacked / LiveExternal / Mixed`）和所需依赖；默认本地/CI 命令只能包含 Hermetic 与受控 ServiceBacked 测试，真实 AI/SaaS 调用必须拆到独立 profile、tag 或 secret-protected job，不能让默认 `test/verify` 依赖真实密钥
7. 验证通过后 Todo：先输出 VCS checkpoint，再按 [../_shared/workflow-chain.md](../_shared/workflow-chain.md) 输出 `code-review package → check → repair` 或 `loop`，随后进入 `project-analysis understanding` 的真实可用调用方式；存在未纳管关键文件时必须显式列出，但 loop 仍可读取、修复、验证和复审这些文件，只能把最终 Submit/VCS Gate 结论标为阻塞；三端均可用自然语言点名 skill 与 mode，不虚构已删除的旧命令
8. `【Workflow Brief】` 块（PlanGate 阶段，见 reference.md）：供下一位 AI 先读索引、再按 tokenHint 读取 md 方案与相关源码，不必粘贴文档全文

## 规则

- **不污染主对话**：Step 1 的 git 检查结果不展示，仅作为内部上下文
- **不编造内容**：未确认的章节统一标 `待补充`
- **数据库只读**：结构变更只产出 DBA 申请材料和建议 SQL；未获用户明确同意不得进入执行 Todo，更不得执行 DDL/数据修复
- **开闭原则优先**：方案设计偏向扩展新代码，而非修改现有
- **可执行导向**：文档不是终点，是驱动后续工作的起点

## 检查清单

### 生成前检查
- [ ] $task 已解析（不为空）
- [ ] 任务类型和复杂度已判定；如影响执行策略，已向用户确认
- [ ] 封闭选项已按“结构化工具 → 交互聊天 → 非交互 blocker”分流；默认建议有证据，高风险选项已获用户明确确认
- [ ] 信息槽位已用于查漏；阻塞项已确认，非阻塞未知已标注假设或 `待补充`
- [ ] 如启用 `IncrementalRevision`，全部前置文档可读且已链接；多篇时已逐项标注承接范围并要求执行方全部读取；只写增量差异，未把预分类当成已确认契约
- [ ] 对话中被明确否决的旧方案已记录为 `conflicts(status=resolved)`，包含最终口径和实现禁令，未误列为 blocker/openFindings
- [ ] 如启用 `Compact`，全部资格条件成立，产物仅一份精简 md；任一高风险/跨模块/契约变化已升级 `Standard`
- [ ] 文件路径冲突已处理
- [ ] 不相关章节已删除（避免大量"待补充"）
- [ ] 最小影响分析已包含
- [ ] AI 执行口径已写清前置条件、执行顺序、验收标准、禁止改动
- [ ] 如涉及数据库结构变化，已取得用户明确同意并仅生成 DBA 申请草案；Todo 未要求 AI 执行 DDL/数据修复
- [ ] 实现 Todo 均为"动词 + 对象 + 结果"，没有无法验收的泛化表述
- [ ] 代码评审关注点已填写

### 生成后检查
- [ ] 已逐接口区分新增 / 契约变更 / 行为变更 / 仅调用；“原参数不动”已继续核对响应、状态码/错误码和鉴权输入
- [ ] 如存在新增接口或契约变更，OpenAPI 与看板 `apis[]` 只包含这些接口，未全量重写行为收紧的原接口
- [ ] OpenAPI 校验已记录 `OPENAPI_VALIDATION_MODE`；工作区外 skill 路径受限时已使用 `light:workspace-inline`，真实校验失败未被降级掩盖
- [ ] 如只有行为变更或仅调用既有接口，已删除「三、API 设计」和「十三、Apifox 接口规范」，且看板 `apis` 为 `[]`、未写 `apiSpecPath`
- [ ] Codex / Cursor / Claude Code 执行提示已按当前宿主能力生成，未混用不可用命令
- [ ] 已判定 BoardPublishStatus；仅在用户或项目规则要求发布时使用 `node project-html/board-add.js` 写入看板
- [ ] 看板 entry 未包含 `changeList` / `todos` / `stackTrace` / `codeLocation`，精确执行信息只保留在 md
- [ ] 仅在看板条目成功写入后运行 `node project-html/build.js`；NotRequested 时未运行
- [ ] 完成输出已包含 `【Workflow Brief】` 块（Step 6 第 8 项）

## 相关资源

- 完整文档模板与信息槽位：[reference.md](reference.md)
- 已填示例（新功能 / Bug 修复）：[examples.md](examples.md)
- 看板模板（外壳 + 样式 + 逻辑 + 数据占位）：[assets/board/](assets/board/)
- 中文文档规范：**必需背景：** `chinese-documentation` skill
- 可选前置：需求仍混沌时，可先用 `superpowers:brainstorming` 收敛范围；其输出必须回填到本 skill 的范围、非目标、blockers、conflicts 或 assumptions，不能代替 Plan Gate
- 后续步骤：`review-fix`（生成 Review 任务包并汇总修复）、`review-check`（只读审查）、`review-repair`（按 findings 直修）、`code-reading`（生成代码地图）；实际调用写法以共享 workflow-chain 为准

## 失败处理

执行失败、产物异常或行为偏离预期时，按需加载 [reference.md 的常见错误与恢复](reference.md#常见错误与恢复)，匹配现象后再重试；正常流程不预加载该表。未命中已知项时显式报告失败与保留状态，不猜测原因，也不得绕过 Plan/VCS/Verification Gate。
