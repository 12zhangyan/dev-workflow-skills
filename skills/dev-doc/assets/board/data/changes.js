// ─── AI 变更记录数据 ─────────────────────────────────────────────────────────
// 本文件由 /dev-doc 与 /bug-fix 自动追加；渲染逻辑在 js/board.js（不要在本文件写逻辑）。
// 手工修改时保持 JS 语法合法：每条记录末尾带逗号，追加标记行不可删除。
// （模板说明：首次创建看板时，将所有 <占位符> 替换为实际值后写入用户项目）

// ─── HTML 变更日志 ──────────────────────────────────────────────────────────
const htmlChangelog = [
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
const changes = [
  // ─── 在此行上方追加新记录 ───
];
