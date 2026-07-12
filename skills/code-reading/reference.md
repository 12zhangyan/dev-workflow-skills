# code-reading Reference

> SKILL.md 的文档模板和输出格式。
> 在 Step 3 按需加载，不在 SKILL.md 启动时注入。

---

## 文档模板

````markdown
# <功能名> 代码地图

> 生成日期：<YYYY-MM-DD>
> 入口：<入口类.方法() 或 dev-doc路径>
> 入口模式：<功能描述 / dev-doc / 入口代码>

---

## 一、概览

**功能描述：** [一句话说明这段代码做什么]

**涉及模块：**
- Controller：[类名]
- Service：[类名]
- Repository/Mapper：[类名]
- 外部依赖：[Redis / 第三方 SDK / MQ / 无]

**入口方法：** `完整包名.类名.方法名()`

**入口选择依据：** [功能描述模式下写明为何选择该入口；如多候选由用户确认，也写明确认结果]

---

## 二、入口与调用链

```mermaid
flowchart TD
    A["Controller.method()"] --> B["Service.method()"]
    B --> C["Repository.query()"]
    B --> D["RedisTemplate.set()"]
    C --> E(["返回结果"])
    D --> E
    B -->|"抛出异常"| F(["异常处理"])
```

> 节点格式：`类名.方法名()`，不含包名
> 异常路径用 `|"描述"|` 边标签标注

---

## 三、状态变化

### 业务状态机

> 仅在代码中发现明确状态跳转（setStatus / 枚举赋值）时生成，否则删除本节

```mermaid
stateDiagram-v2
    [*] --> 状态A
    状态A --> 状态B : 触发条件（如：支付成功回调）
    状态B --> 状态C : 触发条件（如：发货）
    状态C --> [*]
```

### 关键变量追踪

> 仅在变量被 3 处以上读写时记录，否则删除本节

| 变量名 | 初始值/来源 | 修改点（文件:行号） | 最终用途 |
|--------|------------|-------------------|---------|
| | | | |

---

## 四、主要代码位置

| 类/方法 | 文件路径:行号 | 说明（一句话） |
|---------|-------------|--------------|
| | | |

---

## 五、关键注意点

- **隐含约束**：[如：该方法必须在 @Transactional 内调用，否则 Redis 操作与 DB 不一致]
- **并发风险**：[如：Redis SETNX 防重复发送，注意 TTL 与业务超时的关系]
- **边界条件**：[如：入参 phone 为 null 时直接返回，不会走验证逻辑]
- **魔法数字**：[如：验证码 TTL 硬编码 300，单位为秒，等于 5 分钟]

> 无相关内容则删除对应子项，不留空占位

---

## 六、方案 vs 实现对照（仅 dev-doc 模式生成）

> 对照 dev-doc「二、技术方案」和「六、代码变更清单」，逐条确认代码与设计的一致性
> 本节只记录结构性偏差和观察，不定性为 Bug；是否构成问题交给 `/review-check` 判断。

| dev-doc 方案描述 | 代码实际实现 | 一致性 |
|----------------|------------|--------|
| 新增 `LoginStrategy` 接口 | `LoginStrategy.java` 已创建，接口定义与文档一致 | ✅ |
| `AuthServiceImpl` 改为策略分发 | 用 `Map<LoginType, LoginStrategy>` 查找分发 | ✅ |
| Redis TTL 5 分钟 | `expire(key, 300, TimeUnit.SECONDS)` | ✅ |
| 新增 `/api/v1/auth/sms-login` 接口 | 已在 `AuthController` 中找到对应方法 | ✅ |

> ✅ = 与文档一致；⚠️ = 存在偏差或未找到对应代码，Review 时重点关注

## 七、假设与待确认

| 类型 | 内容 | 依据 | 后续处理 |
|------|------|------|----------|
| 自动选择依据 |  |  | 作为阅读入口，不代表业务完整性结论 |
| 非阻塞待确认 |  |  | Review 前可补充，不阻塞代码地图 |
````

---

## 完成输出格式

```
✅ 代码地图已生成：docs/code-reading/<日期>/<功能名>.md

工作流阶段：Understanding Gate 已完成。
可以进入人工 Review / 提交前检查。
如仍需要 AI 审查，先回到 /review-fix 生成任务包，并让 /review-check 输出 findings；不要用代码地图替代审查结论。

【Workflow Brief】
stage: UnderstandingGate
task: <功能名>
source: <dev-doc / bug 文档 / review-repair Brief / 用户指定入口>
artifacts: docs/code-reading/<日期>/<功能名>.md
changed: <阅读中确认的关键源码/测试/配置/OpenAPI 文件>
vcs: owner=<Git/SVN 根或 none>; tracked=<已纳管范围>; untracked=<未纳管文件或 无；未检查写原因>
tests: <已知验证命令 + 结果；未提供写 未提供；环境不满足写 environment-blocked + 工具链版本>
api: spec=<OpenAPI YAML 路径或 无>; index=<API 索引路径或 无>; operationIds=<新增/变更接口 ID 或 无>
openFindings: <代码地图发现的非阻塞待确认；没有写 无>
next: 人工 Review / Submit Gate；如发现新风险则回到 review-check
nextCommand: 人工：按代码地图完成 Review 和 Submit Gate 检查；发现新风险时使用 review-check skill 重新审查
tokenHint: 人工或下一位 AI 先读本 Brief -> 代码地图 -> changed 文件关键方法；不要把代码地图当作审查结论；首轮最多 5 个文件

【Skill 维护反馈】
- skill：code-reading
- 本次场景：<一句话描述入口形态，如 dev-doc/类方法/自然语言描述>
- 运行评价：<顺畅 / 有小问题 / 有阻塞>
- 建议：
  1. <无，或一条可落地的 skill 改进建议>
- 证据：
  - <本次多问/漏问/误判/模板不足的具体表现；没有则写 无>
```
