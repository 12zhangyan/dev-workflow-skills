// ─── AI 变更记录数据 ─────────────────────────────────────────────────────────
// 本文件由 /dev-doc 与 /bug-fix 自动追加；渲染逻辑在 js/board.js（不要在本文件写逻辑）。
// 手工修改时保持 JS 语法合法：每条记录末尾带逗号，追加标记行不可删除。
// （模板说明：首次创建看板时，将所有 <占位符> 替换为实际值后写入用户项目）

// ─── HTML 变更日志 ──────────────────────────────────────────────────────────
const htmlChangelog = [
  { date: "<date>", desc: "初始化 AI 变更记录看板" },
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
    service: "<service>",
    module: "<module>",
    title: "<title>",
    date: "<date>",
    type: "<type>",
    complexity: "<complexity>",
    status: "草稿",
    branch: "<branch>",
    docPath: "<docPath>",
    background: "<background>",
    goals: [<goals>],
    scopeIn: [<scopeIn>],
    scopeOut: [<scopeOut>],
    apis: [],
    solution: "<solution>",
    coreDesign: "<coreDesign>",
    flowchart: `<flowchart>`,
    keyImpl: [<keyImpl>],
    changeList: [<changeList>],
    todos: [<todos>]
  },
  // ─── 在此行上方追加新记录 ───
];
