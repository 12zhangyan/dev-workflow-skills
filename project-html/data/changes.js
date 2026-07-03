// ─── AI 变更记录数据 ─────────────────────────────────────────────────────────
// 本文件由 /dev-doc、/bug-fix、/code-reading、/biz-flow 自动追加；/review-fix 仅在修复交接阶段追加。
// 渲染逻辑在 js/board.js（不要在本文件写逻辑）。
// 手工修改时保持 JS 语法合法：每条记录末尾带逗号，追加标记行不可删除。

// ─── HTML 变更日志 ──────────────────────────────────────────────────────────
const htmlChangelog = [
  { date: "2026-06-08", desc: "初始化 HTML 展示页（卡片布局）" },
  { date: "2026-06-08", desc: "重设计为飞书知识库风格，左侧模块树 + 右侧文档详情" },
  { date: "2026-06-08", desc: "新增接口文档、流程图（Mermaid）、关键实现、代码变更章节，增加 HTML 变更日志" },
  { date: "2026-06-08", desc: "新增 Bug 看板（🐛 记录、严重度、根因分析），与开发文档共用展示页" },
  { date: "2026-06-08", desc: "新增搜索 / 类型筛选 / 仅未完成过滤；状态标签可点击切换并本地保存；侧边栏状态色点 + 日期倒序" },
  { date: "2026-06-10", desc: "看板重构为多文件架构（index.html / css / js / data 分离）；新增微服务→模块两级分组、浏览索引首页、接口索引、md 源文档链接；修复 Mermaid CDN 不可达时整页白屏" },
  { date: "2026-06-11", desc: "视觉升级为纸面编辑部风格（参考 WMS 迁移方案文档）：衬线大标题 + 朱砂强调色 + 纸张底色，墨色表头斑马纹表格、偏移阴影统计卡、双细线分隔、mono 小标签" },
  { date: "2026-06-11", desc: "外壳 v3：新增 BOARD_VERSION 版本号（skill 自动升级外壳）、代码阅读记录类型（kind:reading，/code-reading 登记）、mermaid 本地 vendor（内网可用，CDN 兜底）" },
  { date: "2026-06-11", desc: "外壳 v4：看板定位调整为面向人类的独立技术说明（md 面向 AI 执行）——叙述字段支持 \\n 多段落渲染，skill 撰写完整叙述而非摘录 md 片段" },
  { date: "2026-06-16", desc: "外壳 v5：新增 build.js（每条记录生成自包含单页 pages/<slug>.html，可单独发人）、docs/INDEX.md 文档总索引与首次历史归档；新增业务流记录类型（kind:biz，/biz-flow 登记，含业务流转/数据流/时序图，面向测试）" },
  { date: "2026-07-01", desc: "外壳 v14：新增首页阅读路线、详情页读者速览与执行口径，帮助同事先看结论、再看改动范围和下一步动作" },
  { date: "2026-07-01", desc: "外壳 v15：新增代码审查标签样式，配合 /review-fix 登记 Review 修复交接文档" },
  { date: "2026-07-02", desc: "外壳 v16：视觉升级为业务研发共读工作台，新增首页业务/研发双入口与详情页双视角摘要" },
  // ─── 在此行上方追加变更日志 ───
];

// ─── 文档数据 ────────────────────────────────────────────────────────────────
// 定位：看板条目是面向人类阅读的独立技术说明（md 文件才是给 AI 执行的文档）。
// 叙述字段（background/solution/coreDesign/symptom/rootCause/fixPlan 等）由 skill
// 面向"没参与开发的同事"撰写，完整句子、可用 \n 分段（看板按段落渲染），不是 md 摘录。
// 看板会自动生成"业务人员看这里 / 开发人员看这里"双视角摘要；字段越像完整说明，摘要越清晰。
// 字段说明：
//   service     微服务名（一级分组，单体项目填项目名）
//   module      模块名（二级分组）
//   title       文档标题
//   date        日期 YYYY-MM-DD
//   type        新功能 / Bug修复 / 重构 / 性能优化 / 设计 / API联调 / 配置变更 / 代码审查
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
//   assumptions 低风险假设 string[] 或对象数组（看板渲染到"判断依据与待确认"）
//   conflicts   需求/实现/状态/权限/数据归属冲突 {point,user,evidence,risk,suggestion,blocking}[]
//   blockers    阻塞项 string[]（未确认前不应输出确定修复/测试口径）
//   openQuestions 非阻塞待确认 string[]
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
//
// 代码阅读记录（kind:"reading"，由 /code-reading 追加）字段：
//   kind        "reading"
//   type        固定 "代码阅读"，status 固定 "已完成"
//   entry       追踪入口（如 AuthController#login）
//   background  文档概览（一段话）
//   flowchart   调用链 Mermaid DSL
//   keyImpl     代码位置索引 {title:类.方法, desc:文件路径+职责}[]
//
// 业务流记录（kind:"biz"，由 /biz-flow 追加，面向测试人员）字段：
//   kind        "biz"
//   type        固定 "业务流"，status 默认 "已完成"
//   background  业务概述（一段话，从测试视角讲这条业务整体在做什么）
//   apis        涉及的接口 {method,url,desc}[]
//   bizFlow     业务流转图 Mermaid（flowchart，业务状态/分支怎么走）
//   dataFlow    数据流图 Mermaid（数据从哪进、经过谁、落到哪）
//   sequence    时序图 Mermaid（sequenceDiagram，服务/接口间调用时序）
//   stateMachine 状态流转 Mermaid（stateDiagram-v2，可选）
//   bizRules    关键业务规则 {title,desc}[]（校验/计算/约束规则）
//   testPoints  测试关注点 string[]（边界、异常、并发等测试要点）
//   roles       角色与入口 {name,channel,entry,desc}[]
//   context     上下文与前置条件 {field,source,usage,note}[]
//   dataChanges 阶段数据变动 {stage,trigger,summary,operations:[{target,action,fields,check}]}[]
//   validations 校验规则 {stage,rule,failure,check}[]
//   dataObjects 涉及数据对象 {name,phase,action,note}[]
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
    background: "项目里的 AI 开发文档以 md 形式散落在 docs/ 各日期目录下，要回溯一次改动得先知道日期、再逐个打开文件，对不写代码的同事几乎不可用。\n看板把所有 AI 变更记录集中到一个浏览器直接打开的页面里，按微服务和模块归类，支持搜索与筛选，让任何人都能快速回答「这个模块最近改了什么、为什么改」。",
    goals: [
      "在 project-html/ 目录下创建 HTML/CSS/JS 展示页",
      "支持按服务/模块分组，左侧树导航，右侧文档详情",
      "数据独立存放，每次执行 dev-doc 后自动追加"
    ],
    scopeIn: ["project-html/ 看板", "接口文档/流程图/代码变更等章节展示"],
    scopeOut: ["后端服务", "自动读取 md 文件"],
    apis: [],
    solution: "纯静态多文件页面：外壳、样式、渲染逻辑、数据四个文件分离，浏览器直接打开即可，不依赖任何服务器。\n每次运行 /dev-doc 或 /bug-fix 时，skill 只向 data/changes.js 追加一条记录，外壳文件保持不动；流程图用 Mermaid 渲染（本地 vendor 优先，CDN 兜底）。",
    coreDesign: "核心取舍是数据与逻辑分离：数据文件里只有数组，靠标记行定位追加点，AI 改起来简单且不会破坏页面逻辑。放弃了「AI 每次重新生成整页 HTML」的做法——重新生成容易丢历史记录，也无法保证样式稳定。\n状态切换存浏览器 localStorage 而非写回文件，避免改个状态也要重跑一次 skill；要全员可见时再让 Claude 改数据文件。",
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
