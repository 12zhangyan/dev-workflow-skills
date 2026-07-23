// ─── AI 变更记录数据 ─────────────────────────────────────────────────────────
// 本文件由 /yan-dev-doc、/bug-fix、/code-reading、/biz-flow 自动追加；/review-fix 仅在修复交接阶段追加。
// 渲染逻辑在 js/board.js（不要在本文件写逻辑）。
// 手工修改时保持 JS 语法合法：每条记录末尾带逗号，追加标记行不可删除。

// ─── HTML 变更日志 ──────────────────────────────────────────────────────────
const htmlChangelog = [
  {
    "date": "2026-06-08",
    "desc": "初始化 HTML 展示页（卡片布局）"
  },
  {
    "date": "2026-06-08",
    "desc": "重设计为飞书知识库风格，左侧模块树 + 右侧文档详情"
  },
  {
    "date": "2026-06-08",
    "desc": "新增接口文档、流程图（Mermaid）、关键实现、代码变更章节，增加 HTML 变更日志"
  },
  {
    "date": "2026-06-08",
    "desc": "新增 Bug 看板（🐛 记录、严重度、根因分析），与开发文档共用展示页"
  },
  {
    "date": "2026-06-08",
    "desc": "新增搜索 / 类型筛选 / 仅未完成过滤；状态标签可点击切换并本地保存；侧边栏状态色点 + 日期倒序"
  },
  {
    "date": "2026-06-10",
    "desc": "看板重构为多文件架构（index.html / css / js / data 分离）；新增微服务→模块两级分组、浏览索引首页、接口索引、md 源文档链接；修复 Mermaid CDN 不可达时整页白屏"
  },
  {
    "date": "2026-06-11",
    "desc": "视觉升级为纸面编辑部风格（参考 WMS 迁移方案文档）：衬线大标题 + 朱砂强调色 + 纸张底色，墨色表头斑马纹表格、偏移阴影统计卡、双细线分隔、mono 小标签"
  },
  {
    "date": "2026-06-11",
    "desc": "外壳 v3：新增 BOARD_VERSION 版本号（skill 自动升级外壳）、代码阅读记录类型（kind:reading，/code-reading 登记）、mermaid 本地 vendor（内网可用，CDN 兜底）"
  },
  {
    "date": "2026-06-11",
    "desc": "外壳 v4：看板定位调整为面向人类的独立技术说明（md 面向 AI 执行）——叙述字段支持 \\n 多段落渲染，skill 撰写完整叙述而非摘录 md 片段"
  },
  {
    "date": "2026-06-16",
    "desc": "外壳 v5：新增 build.js（每条记录生成自包含单页 pages/<slug>.html，可单独发人）、docs/INDEX.md 文档总索引与首次历史归档；新增业务流记录类型（kind:biz，/biz-flow 登记，含业务流转/数据流/时序图，面向测试）"
  },
  {
    "date": "2026-07-01",
    "desc": "外壳 v14：新增首页阅读路线、详情页读者速览与执行口径，帮助同事先看结论、再看改动范围和下一步动作"
  },
  {
    "date": "2026-07-01",
    "desc": "外壳 v15：新增代码审查标签样式，配合 /review-fix 登记 Review 修复交接文档"
  },
  {
    "date": "2026-07-02",
    "desc": "外壳 v16：视觉升级为业务研发共读工作台，新增首页业务/研发双入口与详情页双视角摘要"
  },
  {
    "date": "2026-07-03",
    "desc": "外壳 v19：看板视觉打磨为飞书式浅色工作台，浅色侧栏、蓝色主强调、轻阴影卡片与更清爽的信息层级"
  },
  {
    "date": "2026-07-03",
    "desc": "外壳 v20：新增 Apifox/OpenAPI YAML 链接字段，详情页与接口索引可直接打开独立接口规范和索引文件"
  },
  {
    "date": "2026-07-04",
    "desc": "外壳 v21：接口索引显示 operationId，支持接口级 specPath，并在文档总索引输出 OpenAPI 链接列"
  },
  {
    "date": "2026-07-18",
    "desc": "新增文档：看板分层与归档治理"
  },
  {
    "date": "2026-07-18",
    "desc": "新增增量方案：看板人类方案与 Agent 文档职责分离"
  },
  {
    "date": "2026-07-18",
    "desc": "外壳数据迁移：3 条记录拆分为轻量目录 + 人类方案详情"
  },
  // ─── 在此行上方追加变更日志 ───
];


// ─── 轻量目录数据 ────────────────────────────────────────────────────────────
// 首页、搜索和筛选只读取这里；人类方案正文位于 data/details/<detailId>.js，点击后加载。
// md 是 Agent 执行文档；看板详情是独立撰写的人类方案，不是 md 摘录。
// Agent 专属字段 changeList / todos / stackTrace / codeLocation 禁止进入目录和详情。
// 目录字段由 board-add.js 白名单控制；禁止手工整体重写本文件。
const changes = [
  {
    "service": "dev-workflow-skills",
    "module": "HTML 看板",
    "title": "AI变更记录-HTML展示页",
    "date": "2026-06-08",
    "type": "新功能",
    "complexity": "中等",
    "status": "草稿",
    "branch": "main",
    "docPath": "docs/2026-06-08/AI变更记录-HTML展示页.md",
    "apis": [],
    "detailId": "d-64e88fe567050fce",
    "detailPath": "data/details/d-64e88fe567050fce.js",
    "summary": "项目里的 AI 开发文档以 md 形式散落在 docs/ 各日期目录下，要回溯一次改动得先知道日期、再逐个打开文件，对不写代码的同事几乎不可用。",
    "searchText": "AI变更记录-HTML展示页 dev-workflow-skills HTML 看板 新功能 项目里的 AI 开发文档以 md 形式散落在 docs/ 各日期目录下，要回溯一次改动得先知道日期、再逐个打开文件，对不写代码的同事几乎不可用。 在 project-html/ 目录下创建 HTML/CSS/JS 展示页 支持按服务/模块分组，左侧树导航，右侧文档详情 数据独立存放，每次执行 yan-dev-doc 后自动追加 纯静态多文件页面：外壳、样式、渲染逻辑、数据四个文件分离，浏览器直接打开即可，不依赖任何服务器。 每次运行 /yan-dev-doc 或 /bug-fix 时，skill 只向 data/changes.js 追加一条记录，外壳文件保持不动；流程图"
  },
  {
    "service": "dev-workflow-skills",
    "module": "HTML 看板",
    "title": "看板分层与归档治理",
    "date": "2026-07-18",
    "updatedAt": "2026-07-18",
    "type": "重构",
    "complexity": "中等",
    "status": "草稿",
    "branch": "main",
    "docPath": "docs/2026-07-18/看板分层与归档治理.md",
    "apis": [],
    "detailId": "d-324c20b2e5f3e5de",
    "detailPath": "data/details/d-324c20b2e5f3e5de.js",
    "summary": "看板已经能够集中展示开发文档、Bug、代码阅读和业务流，但记录会永久累积在同一个列表中。",
    "searchText": "看板分层与归档治理 dev-workflow-skills HTML 看板 重构 看板已经能够集中展示开发文档、Bug、代码阅读和业务流，但记录会永久累积在同一个列表中。 将看板划分为工作台、待办库和档案库，默认聚焦近期或置顶工作 限制首页默认渲染数量，同时保留历史筛选与搜索能力 让常规详情页共享静态资源，并保留按需导出自包含页面的能力 浏览器端根据显式 lifecycle、pinned、updatedAt/date 和完成状态把记录分成工作台、待办库和档案库，默认只显示工作台。首页保留汇总和最近更新，但详细记录改成固定批量列表，需要时再加载更多。 常规 pages 页面继"
  },
  {
    "service": "dev-workflow-skills",
    "module": "HTML 看板",
    "title": "看板人类方案与 Agent 文档职责分离",
    "date": "2026-07-18",
    "updatedAt": "2026-07-18",
    "type": "重构",
    "complexity": "复杂",
    "status": "草稿",
    "branch": "main",
    "docPath": "docs/2026-07-18/看板人类方案与Agent文档职责分离.md",
    "apis": [],
    "detailId": "d-e3e4d6ea051b3f0e",
    "detailPath": "data/details/d-e3e4d6ea051b3f0e.js",
    "summary": "看板与 md 面向不同读者：看板要让没有参与开发的人理解为什么改、方案如何运转和关键取舍，md 则要让 Agent 精确执行文件修改、Todo 和验证。",
    "searchText": "看板人类方案与 Agent 文档职责分离 dev-workflow-skills HTML 看板 重构 看板与 md 面向不同读者：看板要让没有参与开发的人理解为什么改、方案如何运转和关键取舍，md 则要让 Agent 精确执行文件修改、Todo 和验证。 保持看板人类方案与 md Agent 指令独立撰写 将轻量目录与人类方案详情拆开，详情按点击加载 删除看板中的精确代码清单、Agent Todo、堆栈和代码定位等执行型重复字段 changes.js 只保留标题、归属、状态、生命周期、摘要、搜索文本和 detailPath；每条人类方案写入独立 details/<detailId>.js。浏览索引只加载目录，点击详情时再通过本地 script 标签加载对应方案。 b"
  },
  // ─── 在此行上方追加新记录 ───
];
