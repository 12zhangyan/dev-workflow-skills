window.BOARD_DETAILS = window.BOARD_DETAILS || {};
window.BOARD_DETAILS["d-64e88fe567050fce"] = {
  "background": "项目里的 AI 开发文档以 md 形式散落在 docs/ 各日期目录下，要回溯一次改动得先知道日期、再逐个打开文件，对不写代码的同事几乎不可用。\n看板把所有 AI 变更记录集中到一个浏览器直接打开的页面里，按微服务和模块归类，支持搜索与筛选，让任何人都能快速回答「这个模块最近改了什么、为什么改」。",
  "goals": [
    "在 project-html/ 目录下创建 HTML/CSS/JS 展示页",
    "支持按服务/模块分组，左侧树导航，右侧文档详情",
    "数据独立存放，每次执行 dev-doc 后自动追加"
  ],
  "scopeIn": [
    "project-html/ 看板",
    "接口文档/流程图/代码变更等章节展示"
  ],
  "scopeOut": [
    "后端服务",
    "自动读取 md 文件"
  ],
  "solution": "纯静态多文件页面：外壳、样式、渲染逻辑、数据四个文件分离，浏览器直接打开即可，不依赖任何服务器。\n每次运行 /dev-doc 或 /bug-fix 时，skill 只向 data/changes.js 追加一条记录，外壳文件保持不动；流程图用 Mermaid 渲染（本地 vendor 优先，CDN 兜底）。",
  "coreDesign": "核心取舍是数据与逻辑分离：数据文件里只有数组，靠标记行定位追加点，AI 改起来简单且不会破坏页面逻辑。放弃了「AI 每次重新生成整页 HTML」的做法——重新生成容易丢历史记录，也无法保证样式稳定。\n状态切换存浏览器 localStorage 而非写回文件，避免改个状态也要重跑一次 skill；要全员可见时再让 Claude 改数据文件。",
  "flowchart": "flowchart TD\n  A([dev-doc 生成文档]) --> B[Step 5.5 提取字段]\n  B --> C{看板已存在?}\n  C -->|否| D[从模板创建看板文件]\n  C -->|是| E[Edit 追加新记录]\n  E --> F[追加 htmlChangelog]\n  D --> G([完成])\n  F --> G",
  "keyImpl": [
    {
      "title": "追加标记行",
      "desc": "通过 `// ─── 在此行上方追加新记录 ───` 定位插入点，Edit 工具替换该行，保持 JS 数组语法合法（每条末尾带逗号）。"
    },
    {
      "title": "Mermaid 流程图",
      "desc": "通过 CDN 加载 mermaid@10，flowchart 字段存储纯 DSL 代码。渲染失败或 CDN 不可达时降级显示 <pre> 代码块。"
    },
    {
      "title": "状态本地切换",
      "desc": "详情页状态标签可点击切换，覆盖值存 localStorage，effStatus() 读取覆盖优先，避免每次改状态都要重跑 skill。"
    }
  ]
};
