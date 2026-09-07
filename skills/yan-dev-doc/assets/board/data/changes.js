// ─── 研发变更档案目录 ────────────────────────────────────────────────────────
// 仅按明确发布意图创建或更新交付档案；package/repair/loop 可续写同一 deliveryId，check 默认不写入。
// bug-fix、code-reading、biz-flow 保留各自记录类型；渲染逻辑在 js/board.js。
// 数据只能通过 board-add.js 写入；模板保持空目录。

const htmlChangelog = [
  // ─── 在此行上方追加变更日志 ───
];

// ─── 轻量目录数据 ────────────────────────────────────────────────────────────
// 首页、搜索和筛选只读取这里；人类方案正文位于 data/details/<detailId>.js，点击后加载。
// md 是 Agent 执行文档；看板详情是独立撰写的人类方案，不是 md 摘录。
// Agent 专属字段 changeList / todos / stackTrace / codeLocation 禁止进入目录和详情。
// 目录字段由 board-add.js 白名单控制；禁止手工整体重写本文件。
const changes = [
  // ─── 在此行上方追加新记录 ───
];
