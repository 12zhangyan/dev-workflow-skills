# yan-project-analysis Router Reference

## Mode contract

| Mode | Reader and purpose | Workspace writes | Detailed instruction |
|------|--------------------|------------------|----------------------|
| `understanding` | 开发者：代码地图、调用链、契约兼容影响 | CodeMap 可写文档；ImpactAnalysis 严格零写入 | `modes/understanding/mode.md` |
| `incident` | 开发/支持：Bug 现象、复现、根因证据和修复边界 | 写 `docs/bugs/...`；不直接修代码 | `modes/incident/mode.md` |
| `business` | 测试/产品：角色入口、业务流、数据流、状态与校验 | 写 `docs/biz-flow/...`；不直接修代码 | `modes/business/mode.md` |

## Accuracy boundary

- 只根据已读取的代码、日志、接口和文档下结论；推断与待确认项必须显式标记。
- 简单解释一个类或方法不触发文档型分析；直接在聊天中回答。
- 不把结构偏差定性为 Bug，不把未证实根因写成已确认修复方案。
- 只加载选中 mode 的 `mode.md`，不预读其他 mode 的模板和示例。

## Legacy aliases

`code-reading / bug-fix / biz-flow` 仅作为 `understanding / incident / business` 的迁移别名，不再是独立公开 skill。
