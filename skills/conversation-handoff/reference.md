# 对话移交文档模板

```markdown
# <任务名> 对话移交

- 移交状态：<Ready / PartiallyComplete / Blocked / NeedsConfirmation>
- 交接对象：<下一段 AI 对话 / 指定对象>
- 生成时间：<本地时区时间；未知写 未记录>
- 范围：<本次对话覆盖的模块、文件或问题；不在范围内的内容明确排除>

## 1. 当前目标与结论

<用 2–5 句说明目标与当前停留位置。>

| 级别 | 内容 | 依据 |
|---|---|---|
| 已证实 | <事实> | <文件:行号 / 命令与结果 / 用户确认> |
| 推断 | <推断> | <依据；为什么尚未直接验证> |
| 待确认 | <问题> | <缺少什么；确认后会影响什么> |

## 2. 已完成动作与产物

| 动作 | 结果 | 证据 |
|---|---|---|
| <读取/修改/生成/检查> | <完成/部分完成/未完成> | <路径或命令结果；没有写 未验证> |

## 3. 工作区与验证

- 变更文件：<路径列表；未检查写 未检查 + 原因>
- VCS 状态：<Git/SVN 命令与摘要；未检查写 未检查 + 原因>
- 验证：<命令 + Passed/Failed/NotRun/environment-blocked + 简短结果>
- 敏感信息：<已脱敏 / 未发现需记录的敏感输出；不得写秘密值>

## 4. 未完成项、风险与阻塞

1. <优先级> <下一项或 blocker>：<影响、所需证据/确认、禁止擅自假设的边界>

## 5. 接手步骤

1. 先读本移交文档。
2. 按“最小读取顺序”读取原始证据；摘要与原始材料冲突时以原始材料为准。
3. <下一项可执行动作；涉及业务/权限/API/DB 语义时先确认。>
4. <验证与回填要求。>

## 6. 最小读取顺序

1. <本移交文档>
2. <产物或源文档路径>
3. <关键 changed 文件或命令输出路径>

首轮最多 5 个文件；只有证据不足或发现冲突时再扩展，并记录原因。

## 7. 可复制给新对话的提示

```text
请先阅读 <移交文档路径>，按其中“最小读取顺序”核对原始证据后继续。不要把“推断”或“待确认”当成已证实事实；不要输出或写入任何敏感值；涉及业务、权限、接口、数据库或不可逆操作时证据不足就先停下说明。
```

【Workflow Brief】
stage: <PlanGate / ImplementationGate / VCSGate / VerificationGate / ReviewGate / ReviewRepair / UnderstandingGate / SubmitGate>
task: <任务名或一句话目标>
source: <当前对话中实际使用的原始输入、文件或命令结果；没有写 无>
artifacts: <移交文档路径；其他本轮产物；没有写 无>
changed: <本轮涉及的源码/测试/配置/文档；没有写 无或未检查 + 原因>
vcs: owner=<VCS 根或 none>; tracked=<已纳管范围或未检查 + 原因>; untracked=<未纳管文件或 无；未检查写原因>
tests: class=<Hermetic/ServiceBacked/LiveExternal/Mixed/Unknown/NotApplicable>; command/result=<命令 + 结果；未运行写原因；environment-blocked 写工具链版本>
api: spec=<OpenAPI YAML 路径或 无>; index=<API 索引路径或 无>; operationIds=<本次新增/变更接口 ID 或 无>
openFindings: <未关闭 finding/blocker/deferred-next-batch；没有写 无>
next: <下一步应运行的 skill 或人工动作>
nextCommand: <可直接复制给下一位 AI 的完整命令；纯人工动作写 人工：<动作>>
tokenHint: <先读本 Brief -> 移交文档 -> 原始证据；首轮最多 5 个文件>
```

## 填写规则

- 只列当前对话真实发生或已读到的内容；路径、命令和状态不确定时写“未检查”。
- 不复制完整聊天记录、长 diff、源码或秘密；用路径、行号、finding ID 和简短结论代替。
- `Ready` 仅表示接手材料齐备，不表示代码、测试或业务结论已通过。
- `Blocked`/`NeedsConfirmation` 必须写出最小补充项；不要把推荐方案包装为用户授权。
