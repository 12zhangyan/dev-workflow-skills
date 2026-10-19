# Yan Dev Doc 看板发布

只在 `yan-dev-doc` 入口的看板条件成立时加载。主方案面向执行 Agent；看板 entry 面向未参与任务的同事，必须独立说明为什么做、怎么做、边界和如何验收，不能截取 md 拼装。

## Entry 语义

新方案的 entry `status` 用 `草稿`、`plan.status` 用 `Draft`，摘要说明“方案已生成，未实施”；已有档案按真实阶段保留，不把已实施的记录降回草稿。规范校验结果只作为具体证据，不据此标记方案获批或交付完成。

目录至少包含能定位同一交付的 `docPath`、标题、日期和当前 plan 状态；已有 `deliveryId` 时沿用。`NeedsConfirmation` 方案也发布：entry `status` 写 `待确认`、`plan.status` 写 `NeedsConfirmation`，待裁决问题逐条写入 `plan.openQuestions`（看板会置顶提示并在首页汇总），只写已证实内容，不写未裁决的接口、权限或数据口径；裁决后续写同一档案，显式将 entry `status` 改回 `草稿` 或 `进行中`，同步更新 `plan.status`；问题全部关闭时写入 `plan.openQuestions: []`，仍有未决项则只保留剩余问题。接口契约确有新增或变化时才附 `apiSpecPath`、`apiIndexPath` 和对应 `apis`。

`detail.delivery.plan` 保留当前任务真正需要的人类信息：

- 背景、目标、范围与非目标；
- 整体方案、关键数据/状态流和重要取舍；
- 可观察验收及当前未决边界。

看板详情顶部的“一页读懂”直接取 `summary`、`solution`、`scopeOut`、`acceptance` 前几项，因此这几项各用一两句读者能独立看懂的话写。组件关系、流程图（`flowchart`，可放大查看）、关键实现决策和下一动作只有能提高理解时才写。精确文件清单、类/方法级步骤、执行命令、Todo、堆栈和 `codeLocation` 留在 md，不进入看板。省略空字段，不制造重复摘要。

看板只识别这些 `plan` 字段，其他字段名不会显示，不要自造：`status`、`summary`、`background`、`goals`、`scopeIn`、`scopeOut`、`solution`、`dataFlowSummary`、`coreDesign`、`decisions`（取舍列表）、`flowchart`、`keyImpl`（`[{title, desc}]`）、`acceptance`、`assumptions`、`openQuestions`、`next`（给读者的下一步）。

示意结构仅表示归属，不是完整字段模板：

```json
{
  "changelog": "新增或更新方案：<title>",
  "entry": {
    "title": "<title>",
    "date": "<date>",
    "docPath": "<repo-relative md path>",
    "currentGate": "plan"
  },
  "detail": {
    "delivery": {
      "plan": {
        "summary": "<要解决什么>",
        "scopeIn": ["<包含>"],
        "scopeOut": ["<不做>"],
        "solution": "<flow and key decisions>",
        "acceptance": ["<observable result>"],
        "decisions": ["<关键取舍及理由>"],
        "openQuestions": ["<仅待确认时：待裁决问题>"],
        "next": "<读者现在该做什么>"
      }
    }
  }
}
```

写好 entry 后读取并执行 [共享看板发布流程](../_shared/board-publish-flow.md)。所有写入必须经过 `node project-html/board-add.js`，随后运行 `node project-html/build.js`；脚本失败时保留证据，不手改数据绕过。视觉复核只有真实打开页面后才能声称通过，否则明确未运行。
