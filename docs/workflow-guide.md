# 自适应开发协作指南

这套 Skill 的目标是帮助 Agent 在证据、授权和验收边界内完成复杂研发任务，不是把每个任务塞进同一条流水线。范围与验收清楚时可以直接实现和验证；只有当前任务确实需要时，才进入方案、分析、Review、代码地图、看板或交接。

四个公开 Skill 都采用自包含执行方式，不依赖外部方法论 Skill。需求澄清、拆分、测试策略、调试、角色分配和执行顺序由当前 Agent 根据目标与证据自主决定。

## 选择最小有用能力

| 目标 | 能力 | 默认副作用 |
|---|---|---|
| 先形成开发/改造方案，或关键决策尚未裁决 | `yan-dev-doc` | 生成一份 md；OpenAPI、看板、Brief 均按需 |
| 理解调用链/兼容影响、记录事故、梳理测试业务流 | `yan-project-analysis` | 只选择与目标匹配的 understanding、incident 或 business；ImpactAnalysis 零写入 |
| 只读审查、按 findings 修复、单 Agent 闭环或多角色独立 Review | `yan-code-review` | 按 check、repair、loop、package 的权限边界行动 |
| 把当前对话交给另一段任务继续 | `yan-conversation-handoff` | 写精简 handoff，或按用户要求只在聊天输出 |

旧名称只作为输入兼容：`code-reading / bug-fix / biz-flow` 对应 project-analysis modes；`review-check / review-repair / review-loop / review-fix` 对应 code-review modes。新提示使用统一入口和明确 mode。

## 证据状态，不是固定阶段

Gate 用于说明结论何时成立，不要求按顺序逐站执行：

- `Plan Gate`：只有任务需要方案时才相关；目标、边界、未决项和验收已足以指导实施。
- `Implementation Gate`：实际 diff、文件内容和偏离项证明实现发生过。
- `VCS Gate`：Review 或提交完整性需要时，按真实 Git/SVN owner 核对 status、diff 和未跟踪文件。
- `Verification Gate`：测试、构建、接口或只读数据核对有本轮实际命令与结果。
- `Review Gate`：用户要求或剩余风险值得时，形成有证据的 findings 与处理状态。
- `Understanding Gate`：用户或人工验收确实需要复杂实现地图时才相关。
- `Submit Gate`：仅在用户授权提交且最终证据完整时相关。

Agent 可以合并实现与验证，跳过不适用状态，或先处理能关闭最大证据缺口的动作。Gate 不能扩大写入、数据库、VCS、提交或外部发送权限。

## 自主拆分与多角色协作

复杂任务按用户或系统可观察的结果拆分。每个切片保留目标、硬边界、真实依赖、完成判据和验证证据；文件布局、实现顺序、切片数量、工具和角色由 Agent 决定。

互不覆盖且有并行收益时，可以在既有授权内主动委派多个 Agent。主 Agent 负责统一范围、整合真实改动和验证、解决冲突并披露未覆盖项。简单任务不为扮演角色而强拆；多个 reviewer 的意见数量也不代表结论正确。

多角色 Review 可以直接基于同一证据索引并行派发。同工作区实时协作不要求先落盘任务包；只有跨环境、延期回收、用户要求审计或需要稳定外部分发载体时，才生成持久 review task。

## 测试、Review 与验收

验证深度匹配实际风险，不匹配固定测试数量：

- 测试必须证明目标逻辑：输入、调用对象和断言结果应对应本次行为，不能只验证 mock 或前置条件。
- 命令实际运行才记录通过；未运行要说明原因和未证明范围。
- 工具链或必要网络导致命令无法启动时可记 `environment-blocked`；默认 CI 自身依赖未提供的真实秘密或不可控外部服务属于测试契约问题，不能靠假凭据绕过。
- 源码、编译、测试、部署包和运行日志分别证明不同事实，不互相冒充。

Review 围绕本次变化的风险取证，不机械遍历技术清单。finding 使用稳定 `CR/IM/MI` ID，说明位置、证据、影响、修复方向和验证方式；无证据的偏好不升级为 finding。accepted finding 修复后沿用原 ID 回填，未关闭高风险项不得宣称 Review Gate 通过。

人工验收依据可观察结果和剩余风险决定，不要求先生成代码地图、看板或完整流程产物。

## 按需产物

| 产物 | 位置 | 产生条件 |
|---|---|---|
| 开发方案 | `docs/YYYY-MM-DD/<task>.md` | 用户明确要方案或关键决策需先评审 |
| 事故记录 | `docs/bugs/YYYY-MM-DD/<bug>.md` | 需要沉淀单次故障证据 |
| 业务地图 | `docs/biz-flow/YYYY-MM-DD/<feature>.md` | 测试/产品需要业务、状态和数据闭环 |
| 代码地图 | `docs/code-reading/YYYY-MM-DD/<feature>.md` | 用户明确要求持久化复杂实现地图 |
| Review task / fix handoff | `docs/review-fix/YYYY-MM-DD/` | 跨环境、延期、外部分发或审计确实需要 |
| 对话 handoff | `docs/handoffs/YYYY-MM-DD/` | 用户要求另一段对话继续 |
| OpenAPI | `docs/apifox/YYYY-MM-DD/` | 新增接口或契约变化 |
| HTML 看板 | `project-html/` | 用户明确要求、既有交付档案续写或下游契约要求 |

看板是面向人的独立方案或生命周期说明，不摘抄 Agent 文档。没有发布意图时不初始化、不升级、不写看板，也不运行 `build.js`。

## Workflow Brief

只有真实跨 Agent、跨任务或延期恢复时才生成 `Workflow Brief`。它是最小证据索引，不是第二份方案：

```text
【Workflow Brief】
task: <目标>
state: <真实状态>
scope: <授权与禁止事项>
evidence: <最小证据路径、命令和 finding ID>
verification: <命令与结果或未运行原因>
open: <未关闭项>
next: <下一目标；可包含互不覆盖的并行动作>
```

接口或 VCS 状态确实影响接手时再附 `api` / `vcs`。接手 Agent 先核对最能裁决 `next` 的原始证据，出现缺口或漂移风险再扩展，不复制完整文档、diff 或长日志。

## 准确性硬规则

- 方案、分析或生成文件不等于实现完成；实现结论必须回到实际文件和 diff。
- 验证结论必须带本轮命令与结果；建议命令、旧报告或历史成功不能写成已通过。
- Review 材料不足时返回 `InsufficientMaterial`，不能用“未发现问题”代替。
- 高风险未知但任务范围可识别时，可以形成 `NeedsConfirmation` 草稿；未知部分不得生成确定性实现、API/数据契约或数据库执行授权。
- 数据库默认只读；DDL、数据修复、提交、推送、发布和外部发送仍需明确授权。
- 密码、token、cookie、私钥、连接串和敏感业务值只保留脱敏位置与风险，不进入文档、Brief 或 findings。
- 保护用户已有改动，只处理当前范围；不自动 add、commit、push 或回滚无关文件。

详细边界见 [workflow-gates.md](../skills/_shared/workflow-gates.md)，轻量交接格式见 [workflow-brief.md](../skills/_shared/workflow-brief.md)，Review 状态语义见 [workflow-chain.md](../skills/_shared/workflow-chain.md)。这些协议约束证据与安全，不规定固定研发流程。
