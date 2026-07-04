# Java 后端 AI 开发工作流（Dev Workflow Skills）

> 目标：先定方案，再实现，再验证，再审查，再读代码，最后由人提交。
> README 只做能力总览；第一次跑流程从本文开始。

## 调用约定

| 场景 | Claude Code | Codex |
|------|-------------|-------|
| 生成开发文档 | `/dev-doc 任务名` | `使用 dev-doc skill 给 任务名 生成开发文档` |
| 记录 Bug | `/bug-fix Bug名` | `使用 bug-fix skill 记录 Bug名` |
| 梳理测试业务流 | `/biz-flow 业务名` | `使用 biz-flow skill 生成 业务名 的业务流方案` |
| 生成 Review 任务包 | `/review-fix docs/.../任务.md` | `使用 review-fix skill 基于 docs/.../任务.md 生成 Review 任务包` |
| 执行只读审查 | `/review-check docs/review-fix/...-review-task.md` | `使用 review-check skill 审查 docs/review-fix/...-review-task.md` |
| 生成代码地图 | `/code-reading docs/.../任务.md` | `使用 code-reading skill 基于 docs/.../任务.md 生成代码地图` |

Codex 不要输入 `/dev-doc` 或 `$dev-doc`。Codex 安装 skill 不等于注册同名斜杠命令，也不保证进入 `$` 技能选择器。

## 一句话主链路

```text
dev-doc / bug-fix / biz-flow
→ AI 执行并回填结果
→ VCS 纳管新增文件
→ 测试/构建/接口验证
→ review-fix 生成任务包
→ review-check 多 AI 只读审查
→ review-fix 汇总修复
→ code-reading 生成代码地图
→ 人工 review
→ 提交
```

## 阶段门禁

| 门禁 | 必须看到的证据 | 通过后进入 |
|------|----------------|------------|
| Plan Gate | dev-doc / bug-fix / biz-flow 文档；阻塞项、冲突、假设已写清；看板与 `docs/INDEX.md` 已刷新 | 实现 |
| Implementation Gate | Todo 对照表：已完成项、变更文件、未完成项、执行偏差 | VCS 检查 |
| VCS Gate | `git status --short` 或 `svn status`；新增源码、测试、配置、OpenAPI YAML、文档已 `add` | 验证 |
| Verification Gate | 有针对性的测试/构建/接口/数据核对命令和结果；失败已修复并重跑 | Review |
| Review Gate | `review-fix` 任务包、`review-check` findings、accepted findings 处理状态 | 代码地图 |
| Understanding Gate | `code-reading` 代码地图；人工 review 关注点 | 提交前检查 |
| Submit Gate | 最终 status/diff/test/review/doc/sensitive 检查通过 | `git commit` / `svn commit` |

任何门禁失败都先停在当前阶段，不带病进入下一步。

## 产物地图

| 产物 | 位置 | 谁生成 | 是否建议提交 |
|------|------|--------|--------------|
| 开发文档 | `docs/YYYY-MM-DD/<task>.md` | `dev-doc` | 是 |
| Bug 文档 | `docs/bugs/YYYY-MM-DD/<bug>.md` | `bug-fix` | 是 |
| 业务流文档 | `docs/biz-flow/YYYY-MM-DD/<feature>.md` | `biz-flow` | 是 |
| OpenAPI YAML | `docs/apifox/YYYY-MM-DD/<task>.openapi.yaml` | `dev-doc`，仅接口变更时 | 是 |
| OpenAPI 索引 | `docs/apifox/INDEX.md` | `dev-doc` | 是 |
| Review 任务包 | `docs/review-fix/YYYY-MM-DD/<task>-review-task.md` | `review-fix` 第一阶段 | 是 |
| Review 修复交接 | `docs/review-fix/YYYY-MM-DD/<task>-fix-handoff.md` | `review-fix` 第二阶段 | 是 |
| 代码地图 | `docs/code-reading/YYYY-MM-DD/<task>.md` | `code-reading` | 是 |
| 看板数据 | `project-html/data/changes.js` | 文档类 skill | 是 |
| 单页与总索引 | `project-html/pages/`、`docs/INDEX.md` | `node project-html/build.js` | `docs/INDEX.md` 是；`pages/` 按项目策略 |

## 详细步骤

### 1. 选入口

- 新功能、接口变更、重构、配置变更：用 `dev-doc`。
- 需要记录现象、根因、修复边界：用 `bug-fix`。
- 要给测试/产品讲清业务状态、数据流、接口顺序：用 `biz-flow`。

如果需求和现有代码、字典、状态机、权限或数据模型冲突，先把冲突写进文档并阻塞，不要按猜测继续。

### 2. 生成方案文档

运行入口 skill 后，确认输出里至少有：

- 文档路径。
- 看板更新结果。
- 阻塞项、冲突、假设。
- 实现 Todo。
- 验证命令建议。
- 下一步执行提示。

涉及接口新增或签名变更时，还必须有：

- `docs/apifox/<日期>/<任务名>.openapi.yaml`
- `docs/apifox/INDEX.md`
- md 中的 Apifox 导入说明和接口索引。

### 3. 实现并回填执行结果

把文档末尾的执行提示交给 AI 或开发者。完成后要求回填：

```text
执行结果对照表
- 已完成 Todo：<逐项列出>
- 未完成/偏离项：<没有写 无>
- 变更文件：<源码/测试/配置/文档/OpenAPI>
- 验证命令：<已运行或待运行>
- 风险/疑问：<没有写 无>
```

没有这张对照表，后续 review 只能靠 diff 猜，容易漏掉“该做但没做”的项。

### 4. VCS Gate

Git：

```bash
git status --short
git diff --name-status
git add <新增源码/测试/配置/OpenAPI/文档>
```

SVN：

```bash
svn status
svn add <新增源码/测试/配置/OpenAPI/文档>
svn diff --summarize
```

重点检查：

- 新增测试文件是否已纳入 VCS。
- `docs/apifox/*.openapi.yaml` 和 `docs/apifox/INDEX.md` 是否已纳入 VCS。
- `project-html/data/changes.js`、`docs/INDEX.md` 是否刷新。
- 没有把临时 patch、日志、凭证文件误加入。

### 5. Verification Gate

优先用文档里给出的模块级验证命令。泛化命令只作为兜底：

```bash
mvn test
./gradlew test
npm test
```

多模块 Maven 项目应优先使用可复现的模块命令，例如：

```bash
mvn -f <module-pom> test
mvn -pl <module> -am test
```

验证失败时先修复并重跑。不要把失败测试带入 Review。

### 6. Review Gate

先生成任务包：

```text
Claude Code: /review-fix docs/YYYY-MM-DD/<task>.md
Codex: 使用 review-fix skill 基于 docs/YYYY-MM-DD/<task>.md 生成 Review 任务包
```

`review-fix` 第一阶段必须有实际实现证据：VCS status、diff/patch 或明确变更文件。只有方案文档时，只能审方案，不能声称审过代码。

再让一个或多个 AI 执行只读审查：

```text
Claude Code: /review-check docs/review-fix/YYYY-MM-DD/<task>-review-task.md
Codex: 使用 review-check skill 审查 docs/review-fix/YYYY-MM-DD/<task>-review-task.md
```

把 findings 原样贴回 `review-fix`。`review-fix` 第二阶段应输出：

- accepted / rejected / needs-confirmation 分类。
- 每条 Critical / Important 的修复建议和验证方式。
- 修复操作码。
- 修复后回填要求。

Critical / Important 没关闭前，不进入 Submit Gate。

### 7. 修复后复验

按修复交接执行后，回填：

```text
- 已修复 finding：<CR/IM ID + 证据>
- 未采纳 finding：<原因>
- 验证命令与结果：<命令 + 结果>
- 是否需要二次 review-check：<是/否，原因>
```

如果改动范围明显扩大，重新跑 `review-check`。小范围确定性修复可由人工 review 签收。

### 8. Understanding Gate

在最终人工 review 前生成代码地图：

```text
Claude Code: /code-reading docs/YYYY-MM-DD/<task>.md
Codex: 使用 code-reading skill 基于 docs/YYYY-MM-DD/<task>.md 生成代码地图
```

人工重点看：

- 调用链是否符合业务入口。
- 状态流转、权限、数据归属是否符合文档。
- 事务边界、幂等、重复提交、异常分支是否合理。
- Review 修复是否引入新风险。

### 9. Submit Gate

提交前必须逐项确认：

- `git status --short` 或 `svn status` 无漏 add。
- `git diff` 或 `svn diff` 已人工扫过。
- 目标测试/构建/接口验证已通过。
- Critical / Important findings 已关闭或有明确不采纳理由。
- `docs/INDEX.md`、看板、OpenAPI 索引已刷新。
- diff 中没有 API key、密码、token、cookie、私钥、生产连接串。
- 数据库 DDL/数据修复没有被 AI 直接执行；需要时只保留 DBA 申请材料。

提交命令：

```bash
git commit -m "<type>: <summary>"
svn commit -m "[任务类型] [任务名称]：简要说明"
```

## 失败分支

| 问题 | 处理 |
|------|------|
| skill 没触发 | Codex 改用自然语言：“使用 <skill-name> skill ...”；确认 skill 已安装到对应工具目录 |
| Node 不存在 | 文档仍可生成；看板单页和索引无法刷新时，在完成输出说明并让用户安装 Node 后运行 `node project-html/build.js` |
| `project-html/build.js` 失败 | 停止，先看报错；不要手工覆盖 `data/changes.js` |
| SVN/Git 新文件漏 add | 回到 VCS Gate，补 `svn add` / `git add` 后再 review |
| 测试失败 | 回到实现阶段修复并重跑，不进入 Review |
| `review-check` 输出 Critical | 贴回 `review-fix` 生成修复交接，修复并验证后再签收 |
| 只有 dev-doc 没有 diff | 只能审方案，不能输出“实现无问题” |
| OpenAPI YAML 生成失败 | 接口变更任务不得宣称 Apifox 可导入；先修 YAML 或标记为 blocker |
| 数据库结构变更 | 停止直接实现，只输出 DBA 申请说明或建议 DDL |

## 速记

```text
文档立项 → 执行回填 → add 新文件 → 跑验证 → review-fix → review-check → review-fix 修复交接 → code-reading → 人工签收 → 提交
```
