# dev-doc Reference

> SKILL.md 的详细规范——文档模板、信息槽位、输出格式。
> 此文件在 Step 3-6 按需加载，不在 SKILL.md 启动时注入。

## 目录

- [Step 3 查漏槽位](#step-3-查漏槽位)
- [文档模板](#文档模板)
- [Apifox OpenAPI 文件模板](#apifox-openapi-文件模板)
- [Apifox 索引模板](#apifox-索引模板)
- [完成后输出格式](#完成后输出格式)
- [HTML 看板模板](#html-看板模板)

---

## Step 3 查漏槽位

> 使用方式：先执行 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)。下表是信息槽位，不是逐条必问题卷；能从用户输入、代码、接口、现有文档中确定就直接填。只有“何时必须问”命中的阻塞项才问用户。

| 任务类型 | 槽位 | 可从哪里推断 | 何时必须问 |
|----------|------|--------------|------------|
| 简单任务 | 问题/目标、实现方向 | 任务名、当前文件、diff、相邻代码 | 目标或改动对象完全不清楚 |
| 新功能 | 背景、目标范围、技术方案、数据/接口变化、相关类/接口 | 需求描述、Controller/Service、接口文档、现有模块结构 | 状态/权限/数据归属/API 契约会影响方案 |
| Bug 修复 | 现象、根因证据、影响范围、修复边界、回归风险 | 报错、日志、堆栈、测试现象、最近改动 | 无法复现或根因没有证据却要生成修复 Todo |
| 重构/性能 | 动机、目标指标、兼容性、验证方式、灰度/回滚 | 现有代码重复点、慢查询/日志、性能指标、调用方 | 兼容性或性能目标不明确 |
| API 联调 | 对方服务、联调环境、逐接口变化分类（新增/契约/行为/仅调用）、接口契约、异常降级、上线节奏 | Swagger/Apifox/PDF、现有 client、Controller/DTO、配置、Mock | 请求/响应/状态码/错误码/鉴权契约或行为收紧边界不明确 |
| 配置变更 | 配置项、影响范围、变更方式、回滚方案、验证方式 | yml/env/Nacos/Apollo、配置读取代码、部署文档 | 影响生产行为、需要重启、回滚方式不明确 |

---

## 文档模板

````markdown
# $task 开发文档

> 日期：<YYYY-MM-DD>
> 任务类型：<新功能 / Bug 修复 / 重构 / 性能优化>
> 复杂度：<简单 / 中等 / 复杂>
> 状态：草稿
> 关联分支/路径：<Git: branch 名 | SVN: 路径如 trunk / branches/feature-xxx>
> 关联版本：<Git: commit hash | SVN: revision 号如 r1234 | 暂无>
> 前置文档：<无 | [既有 dev-doc](仓库相对路径)>
> 文档模式：<Standard | IncrementalRevision>

---

## 一、需求说明

### 背景
[需求来源、触发原因、解决的问题]

> `IncrementalRevision`：这里只写相对前置文档的增量原因与边界，未变化背景由前置文档承接。

### 目标
- [ ] [明确的目标 1]
- [ ] [明确的目标 2]

### 范围
- ✅ 包含：[本次涉及的功能/模块]
- ❌ 不包含：[明确排除的内容，防止范围蔓延]

### 判断依据、明确假设与待确认

| 类型 | 内容 | 依据 | 处理口径 |
|------|------|------|----------|
| 事实 | [已由代码/文档/用户明确的信息] | [文件/接口/用户原话] | [直接采用] |
| 假设 | [低风险未知的默认口径] | [路径/命名/相邻实现] | [继续推进，后续可调整] |
| 需求冲突 | [用户说法与现有逻辑的冲突] | [代码/字典/状态机证据] | [建议口径；阻塞时先确认] |
| 阻塞问题 | [不确认就不能编码的点] | [缺失证据] | [先问用户，不生成执行提示] |
| 未确认项 | [非阻塞待确认] | [暂缺] | [不影响当前方案] |

---

## 二、技术方案

### 方案概述
[一句话描述整体技术思路]

### 核心设计
[关键设计决策：数据结构、算法、架构选择及原因]

### AI 执行口径

> 写给后续执行代码的 AI / 开发者：必须具体到可照做，避免"理解后自行发挥"。

- **前置条件**：[执行前必须确认的配置、表结构、接口契约、依赖服务]
- **执行顺序**：[先改什么，再改什么；跨模块时说明顺序原因]
- **验收标准**：[做到什么算完成，最好能对应命令、接口响应、页面/日志/数据结果]
- **禁止改动**：[明确不能碰的文件、接口签名、历史逻辑或数据结构]

### 最小影响分析（开闭原则）
- **新增内容**：[新增的类 / 方法 / 接口]
- **不变内容**：[明确列出不会被修改的现有代码]
- **必须修改**：[如有，说明原因及为何无法用扩展替代]

### 接口影响分类（涉及接口时保留）

| Method + URL | 分类 | 契约是否变化 | 依据 | 进入 OpenAPI / 看板 `apis[]` | 行为与兼容性说明 |
|--------------|------|----------------|------|-------------------------------|------------------|
| [接口] | 新增 / 契约变更 / 行为变更 / 仅调用 | 是 / 否 | [Controller/DTO/接口文档/用户明确约束] | 是 / 否 | [校验、路由、过滤、状态判断、副作用及调用方影响] |

> “原参数不动”不能单独证明契约不变，还要核对响应结构、状态码/错误码和鉴权输入。行为变更接口不进入 OpenAPI 和看板 `apis[]`；混合任务只登记新增/契约变更接口。

---

## 三、API 设计

> 仅当存在新增接口或契约变更时保留本节。纯行为变更（契约不变的校验/路由/状态收紧）或仅调用已有接口不进入本节；混合任务只列新增/契约变更接口

| Method | URL | 说明 |
|--------|-----|------|
| GET / POST / PUT / DELETE | /api/v1/xxx | |

**Request：**
```json
{}
```

**Response：**
```json
{}
```

---

## 四、数据库变更（DBA 申请草案）

> 如不涉及 DB 变更，删除本节。涉及新增库/表/字段/索引/约束时，本节只供用户确认和 DBA 审核；dev-doc 与后续 AI 不得执行 DDL 或数据修复。

- **用户确认**：<已明确同意生成变更申请 / 待确认；待确认时作为 blocker>
- **DBA 审批状态**：<待申请 / 审批中 / 已批准；执行人必须是授权人员>
- **建议结构变更**：[新增表 / 加字段 / 加索引；仅为方案]
- **影响评估**：[锁表、容量、兼容性、预计影响行数]
- **数据迁移建议**：[是否需要；不得由本 skill 执行]
- **建议回滚方案**：[如何回滚；由 DBA 审核]
- **只读验证 SQL**：[执行前后用于核对结构/数据的 SELECT / information_schema 查询]

```sql
-- 建议 DDL，仅供 DBA 审核；不得由 dev-doc 或执行 AI 直接运行
```

---

## 五、缓存策略

> 如不涉及缓存，删除本节

- **缓存 Key**：[格式与命名规范]
- **TTL**：[过期时间]
- **失效策略**：[主动失效 / 被动过期]
- **击穿/雪崩防护**：[如何防护]

---

## 六、代码变更清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| | 新增 / 修改 / 删除 | |

> 每一行都要能指导执行：说明列必须写清"这个文件承担什么职责、改到什么程度"。修改类条目还必须写明为何无法用扩展替代。

---

## 七、流程图

```mermaid
flowchart TD
    A([开始]) --> B[步骤一]
    B --> C{判断条件}
    C -->|是| D[处理 A]
    C -->|否| E[处理 B]
    D --> F([结束])
    E --> F
```

> 根据实际业务流程替换占位节点。复杂任务可用 sequenceDiagram（时序图）

---

## 八、测试要点

### 验收标准
- [ ] [可通过命令/接口/日志/数据核对验证的完成标准]

### 单元测试
- [ ] [关键方法的单元测试覆盖]

### 集成测试
- [ ] [接口级别的集成测试]

### 边界与异常
- [ ] 入参为 null / 空字符串 / 超长
- [ ] 并发场景（如涉及）
- [ ] 异常分支（DB 失败、网络超时、第三方服务异常）

---

## 九、风险与注意事项

| 风险点 | 影响等级 | 应对措施 |
|--------|----------|----------|
| | 高 / 中 / 低 | |

---

## 十、上线计划

> 简单/中等任务只保留前两项；复杂任务才需要灰度策略和监控指标

- **依赖项**：[DB 变更 / 配置变更 / 第三方服务]
- **回滚方案**：[出问题如何快速回退]
- **灰度策略**：[复杂任务填写：如何分批 / 用户白名单 / 按比例]
- **监控指标**：[复杂任务填写：上线后看哪些指标]

---

## 十一、实现 Todo

> 把方案拆成可执行任务，编码时直接对照打勾。每条 Todo 使用"动词 + 对象 + 结果"格式，必要时带文件路径；不要写"完善逻辑"这种无法验收的句子。

- [ ] [在 <文件路径> 新增/修改 <类/方法>，完成 <可观察结果>]
- [ ] [补充 <测试文件/用例>，覆盖 <正常/异常/边界场景>]
- [ ] [运行 <验证命令>，确认 <预期输出/结果>]

---

## 十二、代码评审关注点

> 为 Code Review 阶段准备，基于本次变更填写

- **重点检查**：[最容易出错的代码路径、边界条件]
- **回归风险**：[改动可能波及的已有功能]
- **不要改的**：[明确不应该被修改的文件/方法/接口]

---

## 十三、Apifox 接口规范

> 仅当新增接口、或修改既有接口的参数/返回结构时保留本节，否则删除（调用已有接口且签名无变化不算接口变更）。
> 完整 OpenAPI YAML 单独保存，本文档只记录导入入口、接口索引和维护规则。

- **OpenAPI 文件**：`docs/apifox/<YYYY-MM-DD>/<任务名>.openapi.yaml`
- **Apifox 导入**：Apifox → 导入 → OpenAPI / Swagger → 选择该 YAML 文件，或粘贴文件内容
- **接口索引**：`docs/apifox/INDEX.md`
- **维护规则**：后续新增接口、调整请求参数、调整响应结构或变更路径/方法时，优先更新上述 YAML 文件；不要只改本文档的接口表
- **总索引说明**：`docs/INDEX.md` 由 `node project-html/build.js` 自动生成，不手工编辑；它会从看板 `apiSpecPath` 生成 OpenAPI 链接列

| Method | URL | operationId | 说明 | OpenAPI 文件 |
|--------|-----|-------------|------|--------------|
| GET / POST / PUT / DELETE | /api/v1/xxx | camelCaseUniqueId | | `docs/apifox/<YYYY-MM-DD>/<任务名>.openapi.yaml` |

````

---

## Apifox OpenAPI 文件模板

> 文件路径：`docs/apifox/<YYYY-MM-DD>/<任务名>.openapi.yaml`
> 仅当新增接口、或修改既有接口的参数/返回结构时生成。后续接口变更优先更新同一个文件。

```yaml
openapi: "3.0.3"
info:
  title: "[任务名称] API"
  description: "[需求背景一句话]"
  version: "1.0.0"
servers:
  - url: "http://localhost:8080"
    description: "本地开发"
tags:
  - name: "[模块名]"
    description: "[功能描述]"
paths:
  /api/v1/[resource]:
    post:                          # 按实际方法替换（get/post/put/delete/patch）
      tags: ["[模块名]"]
      summary: "[接口一句话描述]"
      operationId: "[camelCase唯一ID]"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - field1            # 必填字段列表
              properties:
                field1:
                  type: string
                  description: "[字段说明]"
                  example: "示例值"
                field2:
                  type: integer
                  description: "[字段说明]"
                  example: 1
                # 待补充：未确认字段只保留注释或写入文档待确认清单；确认前不要加入 properties 形成伪契约
      responses:
        "200":
          description: "成功"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CommonResponse"
        "400":
          description: "参数错误"
        "401":
          description: "未登录"
        "500":
          description: "服务器错误"
components:
  schemas:
    CommonResponse:
      type: object
      properties:
        code:
          type: integer
          description: "状态码，0 表示成功"
          example: 0
        data:
          description: "业务数据"
        message:
          type: string
          description: "提示信息"
          example: "success"
```

> 填写指引：
> - `paths` 下每个路径对应一个接口，多接口直接并列
> - `operationId` 建议与 Controller 方法名一致，方便 Apifox 生成代码
> - 字段类型：`string` / `integer` / `number` / `boolean` / `array` / `object`
> - 数组示例：`type: array` + `items: { type: string }`
> - 引用公共响应体：`$ref: "#/components/schemas/CommonResponse"`
> - 未确认字段只保留 `# 待补充` 注释或写入文档待确认清单；确认前不加入 `paths` / `components` 的实际契约节点
> - 只运行 grep 等关键字检查时，完成输出必须写“轻量结构校验通过，Apifox 实际导入未验证”；只有 validator 或实际导入成功才能升级结论

---

## Apifox 索引模板

> 文件路径：`docs/apifox/INDEX.md`
> 每次生成或更新 OpenAPI YAML 时同步更新本索引，方便导入 Apifox 和后续维护。按“源文档 + OpenAPI 文件”去重，命中既有行就更新，不重复追加。

```markdown
# Apifox / OpenAPI 索引

| 日期 | 服务/模块 | 任务 | OpenAPI 文件 | 源文档 | 接口 | 维护备注 |
|------|-----------|------|--------------|--------|------|----------|
| <YYYY-MM-DD> | <服务>/<模块> | <任务名> | `docs/apifox/<YYYY-MM-DD>/<任务名>.openapi.yaml` | `docs/<YYYY-MM-DD>/<任务名>.md` | `POST /api/v1/xxx` | 后续接口变更更新同一 YAML 文件 |
```

---

## 完成后输出格式

先按真实结果选择状态，禁止固定宣称成功：

- **Passed**：Plan Gate 无 blocker/conflict，且列出的文件确实已生成并通过对应检查；才输出实现提示。
- **Blocked**：高风险未知、路径冲突、文件不可读或 DB 未确认；输出 `Plan Gate 未通过`、blocker 和下一步确认问题，不输出实现提示。非交互 blocker 不写任何产物。
- **EnvironmentBlocked**：方案文档已安全生成，但 Node/validator 等环境缺失导致单页、索引或深度校验未完成；只列真实产物，明确 `environment-blocked + 命令/版本/失败摘要`，不得把未生成文件写进 artifacts。

```
✅ 文档：<已生成 docs/<日期>/<任务名>.md / 未生成 + 原因>
📤 Apifox/OpenAPI：<真实路径 + 校验状态 / 本次无接口变更 / 未生成 + 原因>
📚 Apifox 索引：<真实路径 / 未生成 + 原因>
📚 文档总索引：<真实路径 / environment-blocked + 原因>
📤 独立单页：<真实路径 / environment-blocked + 原因>
🧭 工作流阶段：<Plan Gate 已完成，下一步进入 Implementation Gate / Plan Gate 未通过 / Plan Gate 已完成但派生产物 environment-blocked>

【Workflow Brief】
stage: PlanGate
task: <任务名>
source: <用户原始需求 / 参考文档 / 代码线索>
artifacts: <只列真实生成并检查过的路径；没有写 无>
changed: 无（方案阶段未改业务代码）
vcs: 未检查业务代码；文档和看板需纳入 VCS
tests: 未运行（方案阶段；环境不满足时写 environment-blocked + 工具链版本）
api: <无 / docs/apifox/<日期>/<任务名>.openapi.yaml；docs/apifox/INDEX.md>
openFindings: <阻塞项/需求冲突/待确认；没有写 无>
next: <Passed：交给 AI/开发者实现并进入 VCS/Verification Gate；Blocked：回答 blocker 后重新运行；EnvironmentBlocked：补齐环境后生成缺失派生产物>
tokenHint: 下一位 AI 先读本 Brief -> docs/<日期>/<任务名>.md 的技术方案、变更清单、Todo、验收标准 -> 只读取相关源码

📌 关键决策：
1. <一句话>
2. <一句话>
3. <一句话>

🤖 交给 Codex / Cursor / Claude Code 执行（仅 Passed 时输出；直接粘贴给当前宿主）：
"参考 docs/<日期>/<任务名>.md 实现技术方案。
先阅读「二、技术方案 / AI 执行口径」，确认前置条件、执行顺序、验收标准和禁止改动。
按「六、代码变更清单」逐项执行。
修改类条目先确认「最小影响分析」中的原因再动手。
按「十一、实现 Todo」逐项完成，每完成一项运行对应验证；若文档存在阻塞问题或阻塞型需求冲突，先输出确认问题，不得开始编码；低风险假设按文档记录执行。
完成后必须回填执行结果对照表：已完成 Todo、未完成/偏离项、变更文件、验证命令、风险/疑问。"

📁 纳入版本控制并确认变更范围：
- [ ] Git: `git add docs/<日期>/<任务名>.md project-html/data/changes.js docs/INDEX.md`；如生成接口规范，再加 `docs/apifox/<日期>/<任务名>.openapi.yaml docs/apifox/INDEX.md`
- [ ] SVN: `svn add <新文件>`；如生成接口规范，确认 `.openapi.yaml` 与 `docs/apifox/INDEX.md` 已纳入版本控制
- [ ] 查看完整变更：`git diff` / `svn diff`

🧪 先验证（没有绿灯不进 Code Review）：
- [ ] <验证命令>：**优先填 Step 1 探测到的构建文件对应的模块级命令**——多模块 Maven 用 `mvn -pl <改动模块> -am test` 或 `mvn -f <module-pom> test`，单模块用 `mvn test`；Gradle 用 `./gradlew :<module>:test`，Node 用 `npm test`。泛化的 `mvn test` / `./gradlew test` 只在无法定位改动模块时兜底。
- [ ] 测试全绿 → 继续；有失败 → 先修复再验证

🤖 AI 代码审查（Review Gate；调用映射以 `skills/_shared/workflow-chain.md` 为准）：
- [ ] Claude Code：`/review-fix docs/<日期>/<任务名>.md`；Codex：`使用 review-fix skill 基于 docs/<日期>/<任务名>.md 生成 Review 任务包`；Cursor：按当前 skill 入口或自然语言点名
- [ ] Claude Code：`/review-check docs/review-fix/<日期>/<任务名>-review-task.md`；Codex：`使用 review-check skill 审查 docs/review-fix/<日期>/<任务名>-review-task.md`；Cursor：按当前 skill 入口或自然语言点名
- [ ] 把 findings 交回 `review-fix` 汇总，或交给 `review-repair` 直接修复；Critical / Important 处理后重跑验证

👁 生成代码地图，自己 Review（Understanding Gate）：
- [ ] Claude Code：`/code-reading docs/<日期>/<任务名>.md`；Codex：`使用 code-reading skill 基于 docs/<日期>/<任务名>.md 生成代码地图`；Cursor：按当前 skill 入口或自然语言点名
- [ ] 对照地图检查业务逻辑、事务边界、关键注意点
- [ ] /chinese-code-review 整理评论话术（如有问题）

🏁 收尾（提交/合并后，让状态全员可见）：
- [ ] 看板里点状态标签只存浏览器本地；要让团队都看到，直接对当前 AI 宿主说：
      "把 project-html/data/changes.js 中标题为「<任务名>」的记录 status 改为 \"已完成\"，改完跑 node --check"

【Skill 维护反馈】
- skill：dev-doc
- 本次场景：<一句话描述本次需求输入形态>
- 运行评价：<顺畅 / 有小问题 / 有阻塞>
- 建议：
  1. <无，或一条可落地的 skill 改进建议>
- 证据：
  - <本次多问/漏问/误判/模板不足的具体表现；没有则写 无>
```

---
## HTML 看板模板

看板模板已抽取为独立资产目录：[assets/board/](assets/board/)

```
assets/board/
  index.html               外壳（优先加载本地 mermaid，CDN 兜底）
  css/board.css            样式（纸面编辑部风格）
  js/board.js              渲染逻辑（含 BOARD_VERSION 版本号；两级树 / 浏览索引 / 接口索引 / Bug 视图 / 阅读视图 / 业务流视图 / 变更日志）
  js/vendor/mermaid.min.js 本地 vendor（~3MB，内网可用；复制必须走 bash cp，禁止 Read+Write）
  build.js                 构建脚本（Node，无依赖）：生成自包含单页 pages/<slug>.html + docs/INDEX.md + 首次历史归档；清空 pages/ 前会比对 data/changes.js 记录数，疑似被误覆盖时中止（哨兵，BOARD_FORCE_BUILD=1 可强制跳过）
  data/changes.js          空数据模板（首次创建看板后也交给 board-add.js 写入第一条记录）
```

**外壳复制时记得带上 `build.js`**（它也是字节一致的外壳文件）：`cp "$src/build.js" project-html/build.js`。

使用方式见 SKILL.md Step 5.5：用 `test -f` 确定性判断看板是否存在（不靠模型读 Read 结果猜）；不存在时 bash cp 复制外壳和空数据模板；新增或更新记录统一写入 `project-html/data/_entry.json` 后交给 `node project-html/board-add.js`，由脚本按 `docPath` 查重、备份、转义和做记录数回归校验。

**维护提示**：
- `assets/board/` 的外壳文件（index.html / css / js / vendor / build.js / board-add.js）与仓库根 `project-html/` 对应文件保持完全一致，仅 `data/changes.js` 不同（模板为空数据，实际看板为真实数据）。修改看板行为时两处同步更新，**外壳有行为变化时 `BOARD_VERSION` +1**，并运行 `node scripts/check-board-sync.js` 校验。
- `/bug-fix` 与 `/code-reading` skill 复用同一资产目录（安装后路径 `../dev-doc/assets/board/`）。
- 数据追加主路径依赖 `board-add.js`；`data/changes.js` 中的两个标记行（`// ─── 在此行上方追加新记录 ───` 与 `// ─── 在此行上方追加变更日志 ───`）只作为脚本定位和 `node` 不可用时的手工降级入口，不可删除。
