window.BOARD_DETAILS = window.BOARD_DETAILS || {};
window.BOARD_DETAILS["d-e3e4d6ea051b3f0e"] = {
  "background": "看板与 md 面向不同读者：看板要让没有参与开发的人理解为什么改、方案如何运转和关键取舍，md 则要让 Agent 精确执行文件修改、Todo 和验证。当前 changes.js 把两类内容混在一条富记录中，既重复保存执行字段，也使首页必须加载所有详情。",
  "goals": [
    "保持看板人类方案与 md Agent 指令独立撰写",
    "将轻量目录与人类方案详情拆开，详情按点击加载",
    "删除看板中的精确代码清单、Agent Todo、堆栈和代码定位等执行型重复字段"
  ],
  "scopeIn": [
    "目录/详情数据模型",
    "详情懒加载",
    "旧数据迁移",
    "四类 skill 字段收敛"
  ],
  "scopeOut": [
    "从 md 自动生成看板内容",
    "服务端接口与数据库"
  ],
  "solution": "changes.js 只保留标题、归属、状态、生命周期、摘要、搜索文本和 detailPath；每条人类方案写入独立 details/<detailId>.js。浏览索引只加载目录，点击详情时再通过本地 script 标签加载对应方案。\nboard-add.js 仍接收 skill 单独撰写的人类 entry，并负责确定性拆分与迁移；build.js 在生成详情页和自包含导出时重新合并两层数据。",
  "coreDesign": "关键边界是不从 md 摘录看板方案。两份内容只共享结构元数据，叙述内容仍按不同读者分别写作。目录/详情拆分解决加载与 diff 问题，但不牺牲 biz-flow 图、Bug 根因和代码阅读调用链等人类理解材料。",
  "flowchart": "flowchart LR\n  A[skill 独立撰写人类方案 entry] --> B[board-add 拆分]\n  B --> C[changes.js 轻量目录]\n  B --> D[details/id.js 人类详情]\n  C --> E[首页/搜索/筛选]\n  E -->|点击| D\n  D --> F[方案详情]\n  G[md Agent 执行文档] -. 仅共享 docPath/元数据 .-> C",
  "keyImpl": [
    {
      "title": "职责隔离",
      "desc": "看板叙述不从 md 自动生成，防止 Agent 指令语言污染人类方案；两者只共享可确定的结构元数据。"
    },
    {
      "title": "目录与详情分离",
      "desc": "首页只加载轻量目录，完整人类方案按条目写入 sidecar 并在点击时加载，降低启动数据量和单文件冲突。"
    },
    {
      "title": "兼容迁移",
      "desc": "新外壳支持旧富 entry 回退；迁移命令按 docPath 生成稳定 detailId，记录数和状态不得下降。"
    }
  ],
  "assumptions": [
    "本地 file:// 环境允许同目录动态 script 加载；行为测试以脚本契约和生成页面验证兜底"
  ]
};
