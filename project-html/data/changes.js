// ─── AI 变更记录数据 ─────────────────────────────────────────────────────────
// 本文件由 /dev-doc 与 /bug-fix 自动追加；渲染逻辑在 js/board.js（不要在本文件写逻辑）。
// 手工修改时保持 JS 语法合法：每条记录末尾带逗号，追加标记行不可删除。

// ─── HTML 变更日志 ──────────────────────────────────────────────────────────
const htmlChangelog = [
  { date: "2026-06-08", desc: "初始化 HTML 展示页（卡片布局）" },
  { date: "2026-06-08", desc: "重设计为飞书知识库风格，左侧模块树 + 右侧文档详情" },
  { date: "2026-06-08", desc: "新增接口文档、流程图（Mermaid）、关键实现、代码变更章节，增加 HTML 变更日志" },
  { date: "2026-06-08", desc: "新增 Bug 看板（🐛 记录、严重度、根因分析），与开发文档共用展示页" },
  { date: "2026-06-08", desc: "新增搜索 / 类型筛选 / 仅未完成过滤；状态标签可点击切换并本地保存；侧边栏状态色点 + 日期倒序" },
  { date: "2026-06-10", desc: "看板重构为多文件架构（index.html / css / js / data 分离）；新增微服务→模块两级分组、浏览索引首页、接口索引、md 源文档链接；修复 Mermaid CDN 不可达时整页白屏" },
  // ─── 在此行上方追加变更日志 ───
];

// ─── 文档数据 ────────────────────────────────────────────────────────────────
// 字段说明：
//   service     微服务名（一级分组，单体项目填项目名）
//   module      模块名（二级分组）
//   title       文档标题
//   date        日期 YYYY-MM-DD
//   type        新功能 / Bug修复 / 重构 / 性能优化 / 设计 / API联调 / 配置变更
//   complexity  简单 / 中等 / 复杂
//   status      草稿 / 进行中 / 已完成（详情页点击状态标签可切换，保存在浏览器本地）
//   branch      Git 分支名
//   docPath     md 源文档相对仓库根的路径（看板渲染为 ../<docPath> 链接）
//   background  需求背景（一段话）
//   goals       目标列表 string[]
//   scopeIn     包含范围 string[]
//   scopeOut    不包含范围 string[]
//   apis        接口变更 {method,url,desc,request?,response?}[]（仅登记新增或参数有变动的接口）
//   solution    技术方案概述（一段话）
//   coreDesign  核心设计描述（一段话）
//   flowchart   Mermaid DSL 代码（不含 ```mermaid 标记）
//   keyImpl     关键实现要点 {title,desc}[]
//   changeList  代码变更清单 {file,action,desc}[]
//   todos       实现 Todo string[]
//
// Bug 记录（kind:"bug"）额外字段：
//   kind        "bug"（文档条目可省略此字段）
//   severity    P0-致命 / P1-严重 / P2-一般 / P3-轻微
//   status      未修复 / 修复中 / 已修复 / 已验证
//   symptom     现象描述（一段话）
//   stackTrace  异常堆栈（原始文本，多行）
//   reproSteps  复现步骤 string[]
//   trigger     触发条件
//   expected    预期行为
//   actual      实际行为
//   impact      影响范围
//   codeLocation AI 代码定位摘要
//   rootCause   根因
//   fixPlan     修复方案描述
//   verifySteps 验证步骤 string[]
const changes = [
  {
    service: "dev-workflow-skills",
    module: "HTML 看板",
    title: "AI变更记录-HTML展示页",
    date: "2026-06-08",
    type: "新功能",
    complexity: "中等",
    status: "草稿",
    branch: "main",
    docPath: "docs/2026-06-08/AI变更记录-HTML展示页.md",
    background: "解决 md 文档查看困难的问题，生成可视化 HTML 展示页，集中显示项目中所有 AI 变更记录，方便人类阅读和追溯。",
    goals: [
      "在 project-html/ 目录下创建 HTML/CSS/JS 展示页",
      "支持按服务/模块分组，左侧树导航，右侧文档详情",
      "数据独立存放，每次执行 dev-doc 后自动追加"
    ],
    scopeIn: ["project-html/ 看板", "接口文档/流程图/代码变更等章节展示"],
    scopeOut: ["后端服务", "自动读取 md 文件"],
    apis: [],
    solution: "静态 HTML + 独立 CSS/JS/数据文件，Mermaid.js CDN 渲染流程图，浏览器直接打开，零服务器依赖。",
    coreDesign: "左侧固定侧边栏展示微服务→模块两级文档树，顶部搜索与筛选；右侧渲染各章节（需求/接口/方案/流程图/关键实现/代码变更）。数据追加通过 Edit 工具定位 data/changes.js 中的标记行实现。",
    flowchart: "flowchart TD\n  A([dev-doc 生成文档]) --> B[Step 5.5 提取字段]\n  B --> C{看板已存在?}\n  C -->|否| D[从模板创建看板文件]\n  C -->|是| E[Edit 追加新记录]\n  E --> F[追加 htmlChangelog]\n  D --> G([完成])\n  F --> G",
    keyImpl: [
      { title: "追加标记行", desc: "通过 `// ─── 在此行上方追加新记录 ───` 定位插入点，Edit 工具替换该行，保持 JS 数组语法合法（每条末尾带逗号）。" },
      { title: "Mermaid 流程图", desc: "通过 CDN 加载 mermaid@10，flowchart 字段存储纯 DSL 代码。渲染失败或 CDN 不可达时降级显示 <pre> 代码块。" },
      { title: "状态本地切换", desc: "详情页状态标签可点击切换，覆盖值存 localStorage，effStatus() 读取覆盖优先，避免每次改状态都要重跑 skill。" }
    ],
    changeList: [
      { file: "project-html/index.html", action: "新增", desc: "看板外壳，加载 css/board.css、data/changes.js、js/board.js" },
      { file: "project-html/css/board.css", action: "新增", desc: "看板样式" },
      { file: "project-html/js/board.js", action: "新增", desc: "渲染与交互逻辑（两级树 / 浏览索引 / 接口索引 / Bug 视图）" },
      { file: "project-html/data/changes.js", action: "新增", desc: "数据文件，skill 只追加此文件" }
    ],
    todos: [
      "创建 project-html/ 目录",
      "浏览器验证 Mermaid 流程图正常渲染",
      "验证 Edit 追加逻辑正确"
    ]
  },
  // ─── 在此行上方追加新记录 ───
];
