# Yan Dev Doc 看板发布

只在 `yan-dev-doc` 入口的看板条件成立时加载。主方案面向执行 Agent；看板 entry 面向未参与任务的同事，必须独立说明为什么做、怎么做、边界和如何验收，不能截取 md 拼装。

## Entry 语义

目录至少包含能定位同一交付的 `docPath`、标题、日期和当前 plan 状态；已有 `deliveryId` 时沿用。接口契约确有新增或变化时才附 `apiSpecPath`、`apiIndexPath` 和对应 `apis`。

`detail.delivery.plan` 保留当前任务真正需要的人类信息：

- 背景、目标、范围与非目标；
- 整体方案、关键数据/状态流和重要取舍；
- 可观察验收及当前未决边界。

组件关系、流程图、关键实现决策和下一动作只有能提高理解时才写。精确文件清单、类/方法级步骤、执行命令、Todo、堆栈和 `codeLocation` 留在 md，不进入看板。省略空字段，不制造重复摘要。

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
        "summary": "<human summary>",
        "scope": ["<in/out boundary>"],
        "solution": "<flow and key decisions>",
        "acceptance": ["<observable result>"]
      }
    }
  }
}
```

写好 entry 后读取并执行 [共享看板发布流程](../_shared/board-publish-flow.md)。所有写入必须经过 `node project-html/board-add.js`，随后运行 `node project-html/build.js`；脚本失败时保留证据，不手改数据绕过。视觉复核只有真实打开页面后才能声称通过，否则明确未运行。
