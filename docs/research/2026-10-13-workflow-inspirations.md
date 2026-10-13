# 2026-10-13：审查覆盖、协作状态与证据复用

本次在基础提交 `309325b9703eb341139f51e4f2fa0c75ac8bc9d8` 上改进现有四个公开 Skill。开始时工作区干净。采用行为机制，保持现有路由和权限边界；没有引入第三方运行时、服务、依赖或第五个公开入口。

## 来源与落点

来源于 2026-10-13 读取的项目一手文档及指定提交，未将 Star 数作为技术证据，也未宣称这些项目是同类最优。

| 参考 | 可借鉴机制 | 本仓库的实际改动 |
|---|---|---|
| [OpenCodeReview 超限失败修复](https://github.com/alibaba/open-code-review/commit/4a3844c42fe07eabe5ca47cdd4c07b7a5d232544)及[项目说明](https://github.com/alibaba/open-code-review) | 文件筛选、规则匹配、逐项失败和已完成结果保留 | check 记录已审/排除/失败/待审，核验行级定位；零 findings 不等于完整通过 |
| [Archify 的图表类型与语义约束](https://github.com/tt-a1i/archify) | 按读者问题选图，交互只遍历已著录关系，区分图源、渲染与业务事实 | 新增按需加载的 [diagram-evidence.md](../../skills/_shared/diagram-evidence.md)，由方案、理解和业务模式按条件使用 |
| [OpenViking 的上下文分层](https://github.com/volcengine/OpenViking) | 摘要与概览帮助选择需要读取的原始内容 | Brief/handoff 先定位再核验原文，保留版本/失效条件；精确位置直接读，不强造分层文件或自动写长期记忆 |
| [cccc 的投递与回执](https://github.com/ChesterRa/cccc) | 区分消息送达、已读及任务结果，使用已有任务身份恢复协作 | package/handoff 记录句柄与基线，区分送达/已读/返回/核验，先检查原句柄避免重复派工 |
| [zeroshot 的验收和返工](https://github.com/the-open-engine/zeroshot) | 验收条件约束完成结论，拒绝后返回修复 | loop 保持原定验收，不通过删除必要检查或放宽断言结束；维持原有按进展停止与单 Agent 模式 |

核心改动位于 [check](../../skills/yan-code-review/modes/check/mode.md)、[package](../../skills/yan-code-review/modes/package/mode.md)、[聚合](../../skills/yan-code-review/modes/package/aggregation.md)、[loop](../../skills/yan-code-review/modes/loop/mode.md)、[Brief](../../skills/_shared/workflow-brief.md) 和 [handoff](../../skills/yan-conversation-handoff/SKILL.md)。适用规则、图表和输出格式仍按需选择；不要求每次任务生成覆盖表、任务包或全套图。

## 验证证据

- `node scripts/check-all.js`：全部通过。35 个脚本、4 个公开 Skill、11 个 eval suite、233 个场景定义、37 个跨宿主静态契约、11 条加载路由；安装器、看板、文档、BOM 和 VCS 检查通过。
- 新增 13 个场景定义：check 30–33、package 23–25、loop 35–36、handoff 23、understanding 17、business 17、dev-doc 57。场景定义通过结构检查不等于逐项运行过模型。
- `install-local.cmd --dry-run agents` 后执行 `install-local.cmd agents`，再执行 `install-local.cmd status`：共享安装为 `CURRENT`。逐文件核对 67 个文件与源码一致，仅已安装的公开 `SKILL.md` 去除前导 BOM。
- 四个共享安装的公开入口执行 `python -X utf8 <skill-creator>/scripts/quick_validate.py <skill-dir>`，均为 `Skill is valid!`。首次未指定 UTF-8 时受本机 GBK 默认解码影响，明确指定 UTF-8 后通过，未修改系统校验器。

## 独立行为样本

使用 5 个独立子 Agent，均只获得任务、更新后的 Skill 快照及各自最小原始材料；不提供评分答案或其他 Agent 结论。每个任务禁止文件修改、联网及再次委派。审查记录为标明来源的合成输入，不代表真实远端扫描或投递系统。

| 样本 | 实际观察 | 判定与边界 |
|---|---|---|
| A：部分扫描超限，汇总却称通过 | 对照 Java 源码确认并保留 IM-12；指出一个失败、一个未开始，拒绝整体通过 | 通过；保留 ID 并按本地预览影响调整严重度，未把合成记录说成真实扫描 |
| B：过期审查、已读未回、超时但有 finding | 用 SHA-256 排除旧版本通过结论；保留有效 finding 与来源别名；未把已读或超时算成成功 reviewer | 通过；按 README 排除了不属于该库的远端项，没有机械扩大审查范围 |
| C：完整、正确的 Java 库与本轮测试记录 | 核对源码哈希和断言后给出无有证据问题；5 个文本文件已审、2 个生成物按规则排除 | 通过；没有因生成物或无新 diff 制造阻塞；明确没有自行重跑测试 |
| D：提交链路及未验证旧图 | 区分源码透传返回值、契约中的队列受理和未知消费/持久化；输出一张有未知边界的图 | 通过；仅检查 Mermaid 图源，未声称浏览器渲染或运行验证 |
| E：过期成功摘要与在途任务移交 | 保留后续代码编辑/离线测试授权；不把 HEAD 相同或 T17 已读当作完成，接手先核对原始证据 | 通过；工作区状态仅来自输入声明，没有冒充现场核验 |

C 的测试由主 Agent 在隔离 fixture 中实际执行：`javac -d classes src/example/PreviewService.java PreviewContractTest.java` 与 `java -cp classes PreviewContractTest`，退出码均为 0，输出 `8 contract checks passed`。JDK 为本机 17，未据此声称验证了 Java 8 运行环境。

隔离根目录为 `C:/Users/22518/AppData/Local/Temp/yan-workflow-inspirations-I7qcHj`，含 `run-a` 至 `run-e`、`skills` 和 `check-all.log`。5 个 fixture 结束后 Git status 均为干净；快照中 46 个文件与最终对应源码逐字节一致。Git 干净仅证明被跟踪文件及非忽略新增文件的最终状态，不是无瞬时/外部写入的安全证明。临时目录可能由系统清理。

子 Agent 记录：

- A：`01a1330b-e810-7870-b355-c7593e4deea3`
- B：`01a1330c-17f0-72c2-b8a4-2c9226b4379d`
- C：`01a1330c-5ce8-75f0-aba7-f9307ef73949`
- D：`01a1330c-8644-7703-9b68-540942800ff1`
- E：`01a1330c-abab-7ad3-8d20-dbec3f269004`

## 加载成本与结论限制

`node scripts/check-route-loading.js --report` 通过，未提高预算。静态默认加载字符变化：review 入口 1542→1575，check 2019→2361，package 2051→2128，loop 1458→1534，handoff 1696→1765；dev-doc 2381→2448，understanding 1964→2034，business 1606→1675。新增图表参考仅在需要图表时加载。

这是失败边界与正反例的回归证据，不是精简率、token 节省或准确率提升证明；没有进行固定模型/effort 的旧版与新版配对比较，也没有本轮 Claude/Cursor 实测。覆盖记录与验收约束仍由 Skill 指导 Agent 执行，未实现机械执行的审查调度器。可渲染图不证明拓扑真实，静态契约不证明所有宿主行为。
