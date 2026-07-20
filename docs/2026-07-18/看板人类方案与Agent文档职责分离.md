# 看板人类方案与 Agent 文档职责分离开发文档

> 日期：2026-07-18
> 任务类型：重构 / 性能优化
> 复杂度：复杂
> 状态：已完成
> 关联分支/路径：Git: main
> 关联版本：6f1ef0f
> 前置文档：[看板分层与归档治理](看板分层与归档治理.md) — 承接：工作台/待办库/档案库、轻量详情页、增量构建和按需导出
> 文档模式：IncrementalRevision

---

## 一、增量需求与边界

### 背景

上一轮已经限制了首页渲染数量和详情页静态资源体积，但 `changes.js` 仍同时承载目录元数据、人类方案说明和大量偏 Agent 执行的字段。当前第二条记录的看板 JSON 为 4,304 bytes，对应 md 为 11,246 bytes；其中 `changeList`、`todos` 和精确代码位置与 md 职责重叠。

### 最终职责口径

- **看板**：让未参与开发的人理解为什么改、方案如何运转、关键取舍、影响范围和验收结果。
- **md**：让 Agent 知道具体文件、方法、执行顺序、Todo、验证命令、禁止项和回滚边界。
- 两份内容独立撰写、服务不同读者；只共享标题、服务、模块、日期、状态、文档路径等结构元数据。

### 判断依据、冲突与禁令

| 类型 | 内容 | 依据 | 处理口径 |
|------|------|------|----------|
| 事实 | 当前看板详情依赖 `background/solution/coreDesign/keyImpl/changeList/todos` 等完整字段 | `project-html/js/board.js` 详情渲染与双视角摘要 |
| 事实 | dev-doc、bug-fix、biz-flow、code-reading 都构造一份完整 entry JSON | 各 skill 的看板登记步骤 |
| 需求冲突（已裁决） | 旧候选：让 md 成为唯一内容来源并自动生成看板；最终口径：看板方案与 Agent 文档必须独立 | 用户明确说明“看板是让人理解方案，而 md 是让 agent 执行” | `conflicts(status=resolved)`；禁止从 md 摘录或自动生成看板叙述 |
| 假设 | `changes.js` 只加载目录和搜索摘要，详情在点击时加载，能兼顾本地 file:// 使用 | 当前看板为静态 script 架构 | 详情使用 JS sidecar，不使用可能受 file:// CORS 限制的 fetch JSON |

### 增量范围

- ✅ 包含：轻量目录、独立人类详情 sidecar、懒加载、旧数据迁移、构建/导出适配、skill 字段收敛、行为测试。
- ❌ 不包含：从 md 解析看板内容、数据库、服务端 API、远程搜索、改变三层生命周期规则。

---

## 二、增量技术方案

### 数据模型

`project-html/data/changes.js` 只保留目录字段：`detailId/kind/service/module/title/date/updatedAt/type/complexity/status/severity/branch/docPath/apiSpecPath/apiIndexPath/apis/lifecycle/pinned/summary/searchText/detailPath`。

`project-html/data/details/<detailId>.js` 保存人类方案详情。不同记录类型继续拥有不同的人类字段：

- 开发方案：背景、目标/影响、整体方案、核心取舍、方案图、设计亮点、验收口径、影响外边界。
- Bug：现象、触发条件、影响、根因、修复方案、复现与验证；不保存堆栈全文、精确代码位置、代码改动清单和 Agent Todo。
- 业务流：角色、业务流、数据流、时序、状态机、业务规则、阶段数据变化和测试关注点继续保留。
- 代码阅读：人类可读的入口、调用链、功能概述和关键位置索引继续保留。

### 写入与迁移

- `board-add.js <entry.json>` 继续接收各 skill 独立撰写的人类 entry，但自动拆成 catalog + detail 两份文件。
- 新增 `board-add.js --migrate`，确定性拆分现有富记录；迁移前备份 `changes.js`，记录数不得下降。
- `docPath` 继续作为去重键；`detailId` 由 `docPath` 的稳定 SHA-1 前缀生成，标题变化不会换详情文件。
- 更新时保留 `status/lifecycle/pinned/createdAt`，同步刷新 `updatedAt`。

### 渲染与构建

- 首页、侧边栏、生命周期、搜索和接口索引只读取 catalog。
- 点击详情时通过 `<script src="data/details/<detailId>.js">` 懒加载，不使用 `fetch`。
- `build.js` 合并 catalog 和 human detail 后生成轻量详情页或自包含导出，现有 `pages/<slug>.html` 链接不变。
- 旧项目没有 `detailPath` 时，`board.js` 继续把富 entry 当作详情渲染，保持向后兼容。

### AI 执行口径

- **前置条件**：逐项读取本增量文档和前置文档；保持 `slugOf/buildSlugMap`、`docPath` 去重和生命周期逻辑不变。
- **执行顺序**：先实现 board-add 拆分/迁移，再实现 board.js 懒加载和 build.js 合并，随后迁移真实数据，最后收敛四类 skill 字段并同步模板。
- **验收标准**：`changes.js` 中不存在 `changeList/todos/stackTrace/codeLocation`；每条 catalog 都有可解析的 detail；首页无需加载 detail；详情/轻量页/自包含导出内容正常；旧富 entry 仍兼容；完整检查通过。
- **禁止改动**：不得从 md 自动生成或摘录人类方案；不得删除源 md；不得降低 biz-flow 面向测试人员的图和数据变化信息；不得手工整体重写 `changes.js`。

### 最小影响分析

- **新增**：`data/details/`、catalog/detail 拆分函数、懒加载函数、迁移与一致性检查。
- **不变**：用户看到的工作台分层、详情内容定位、源文档链接、slug、构建入口和按需导出命令。
- **必须修改**：`board-add.js` 是唯一数据写入口；`board.js` 需要在详情打开前装载 sidecar；`build.js` 需要合并两层数据；各 skill 必须停止写入职责重叠字段。

---

## 三、代码变更清单

| 文件 | 动作 | Agent 执行要求 |
|------|------|----------------|
| `project-html/board-add.js` | 修改 | 增加稳定 detailId、字段分层、sidecar 写入、备份与 `--migrate` |
| `project-html/js/board.js` | 修改 | catalog 搜索与详情懒加载；旧富 entry 回退兼容 |
| `project-html/build.js` | 修改 | 加载/校验 sidecar，合并后生成 pages/exports |
| `project-html/data/changes.js` | 脚本迁移 | 只能运行 `node project-html/board-add.js --migrate`，不得手工覆盖 |
| `project-html/data/details/*.js` | 脚本生成 | 每条记录一份人类方案详情，文件名由稳定 detailId 决定 |
| `skills/dev-doc/assets/board/` | 同步 | 外壳字节一致，模板 detail 目录用 `.gitkeep` 表达 |
| 四类登记看板的 skill | 修改 | 明确看板字段只服务人类理解，删除 Agent 执行型重复字段 |
| `scripts/check-board-behavior.js` | 修改 | 覆盖迁移、sidecar、懒加载契约、构建合并和字段禁令 |
| `AGENTS.md`、`CLAUDE.md`、`README.md` | 修改 | 更新双产物职责和目录/详情架构 |

---

## 四、实现 Todo

- [x] 在 `board-add.js` 实现 catalog/detail 拆分、稳定 ID、写入校验和 `--migrate`。
- [x] 在 `board.js` 实现 detail sidecar 懒加载、错误提示、缓存和旧数据回退。
- [x] 在 `build.js` 合并 catalog/detail，验证缺失详情时显式失败。
- [x] 用迁移命令转换现有全部记录，并验证记录数、docPath 和状态不变。
- [x] 收敛 dev-doc、bug-fix、biz-flow、code-reading/review-fix 的看板字段职责。
- [x] 同步模板，提升 `BOARD_VERSION`，补充行为检查并运行 `node scripts/check-all.js`。

---

## 五、测试与评审点

- `node scripts/check-board-behavior.js`：Hermetic；验证目录字段白名单、详情字段黑名单、迁移、更新和懒加载上限。
- `node scripts/check-board-sync.js`：Hermetic；验证根目录与模板外壳一致。
- `node scripts/check-all.js`：Hermetic；覆盖文档、metadata、evals、构建和 diff。
- 重点评审：迁移中断是否保留恢复证据、detailId 是否稳定、详情加载失败是否显式、接口索引是否仍只依赖 catalog、旧项目升级是否兼容。

---

## 六、实施结果回填

- 3 条旧富记录已迁移为 3 条轻量目录 + 3 份独立人类方案详情，`docPath` 和 `status` 均保持不变。
- `changes.js` 从迁移前 20,702 bytes 降到 9,045 bytes；每条搜索语料限制为 600 字符以内，正文不再随首页加载。
- 目录和详情均不包含 `changeList`、`todos`、`stackTrace`、`codeLocation`；这些执行/诊断内容只保留在 md。
- 行为测试证明首页加载详情数为 0，点击一条后加载数为 1；常规构建连续运行时未重写未变化页面。
- `BOARD_VERSION` 已提升到 23，根看板与安装模板保持字节同步；旧项目升级说明包含 `--migrate`。
- 验证：`node scripts/check-all.js` 已通过，覆盖 12 个脚本检查、看板同步/行为、文档与 skill metadata、130 个 eval 场景、构建和 `git diff --check`。
