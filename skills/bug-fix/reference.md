# bug-fix reference

## Step 2 问题集

> Q1：错误信息是什么？（可直接粘贴异常堆栈）

> Q2：严重度？
> - **P0 致命**：系统不可用 / 数据丢失 / 主流程完全中断
> - **P1 严重**：核心功能不可用，无绕行方案
> - **P2 一般**：功能受损但有绕行方案，部分用户受影响
> - **P3 轻微**：体验问题 / 非核心功能 / 极少触发

> Q3：如何复现？（描述操作步骤，例如：1. 登录 → 2. 点击 X 按钮 → 3. 看到报错）

> Q4：触发条件是什么？（什么情况下必现？什么情况下不出现？）

> Q5：预期行为 vs 实际行为分别是什么？

> Q6：这个 Bug 属于哪个微服务/模块？格式 `服务/模块`（如 `订单服务/支付`；单体项目填 `项目名/模块名`；不确定填 `通用/通用`）

---

## 文档模板

````markdown
# Bug 修复：{title}

- **日期**：{date}
- **严重度**：{severity}（P0-致命 / P1-严重 / P2-一般 / P3-轻微）
- **状态**：未修复
- **分支**：{branch}

## 一、Bug 现象

### 错误信息 / 异常堆栈

```
{stackTrace}
```

### 复现步骤

1. 
2. 

### 触发条件

{trigger}

### 预期行为 vs 实际行为

| | 预期 | 实际 |
|---|---|---|
| 行为 | {expected} | {actual} |

## 二、影响范围

{impact}

## 三、根因分析

### 代码定位

{codeLocation}

### 根因

{rootCause}

## 四、修复方案

### 方案概述

{fixPlan}

### 修复执行口径

- **先确认**：{修复前必须确认的日志、数据、配置、复现条件}
- **最小修复**：{只改哪些路径，避免扩大影响}
- **禁止改动**：{不能改的接口签名、公共逻辑、历史数据或配置}
- **完成判定**：{什么现象消失、什么数据/日志/接口结果符合预期}

### 最小影响分析

- 改动文件：
- 是否影响其他功能：

## 五、代码变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
|  |  |  |

## 六、验证步骤

- [ ] [复现原问题，确认修复前能稳定触发]
- [ ] [执行修复后操作，确认实际结果等于预期结果]
- [ ] [覆盖一个边界/异常场景，确认没有引入回归]

## 七、实现 Todo

- [ ] [在 <文件路径> 修改 <方法/逻辑>，完成 <可观察结果>]
- [ ] [补充/调整 <测试用例>，覆盖 <复现场景>]
- [ ] [运行 <验证命令>，确认 <预期输出/结果>]
````

---

## html-追加格式

追加到 `project-html/data/changes.js` 的 `changes` 数组时的 JS 对象格式（空值字段可省略）：

```js
  {
    kind: "bug",
    service: "<service>",
    module: "<module>",
    title: "<title>",
    date: "<date>",
    severity: "<severity>",
    status: "未修复",
    branch: "<branch>",
    docPath: "<docPath>",
    symptom: "<symptom>",
    stackTrace: `<stackTrace>`,
    reproSteps: [<reproSteps>],
    trigger: "<trigger>",
    expected: "<expected>",
    actual: "<actual>",
    impact: "<impact>",
    codeLocation: "<codeLocation>",
    rootCause: "<rootCause>",
    fixPlan: "<fixPlan>",
    changeList: [<changeList>],
    verifySteps: [<verifySteps>],
    todos: [<todos>]
  },
  // ─── 在此行上方追加新记录 ───
```

**注意**：`stackTrace` 含换行时用模板字面量（反引号）；含反引号时改用双引号并将换行转为 `\n`。其余字符串字段含双引号 → `\"`，含换行 → `\n`。

---

## 完成后输出格式

```
✅ Bug 文档已生成：docs/bugs/{date}/{task}.md
🐛 HTML 看板已更新：project-html/data/changes.js（浏览器打开 project-html/index.html 查看）

📋 关键信息
- 严重度：{severity}
- 初步定位：{codeLocation 摘要，或"待分析"}
- 修复方向：{fixPlan 摘要}

🚀 下一步
1. 打开文档，根据代码定位结果补全「三、根因分析」
2. 按「五、代码变更清单」逐项修复
3. 执行「六、验证步骤」确认修复效果
   - 若任一步没有可观察结果，先补充验证口径再执行
4. 修复验证后更新看板状态（浏览器点状态标签只存本地；要全员可见，对 Claude 说：
   "把 project-html/data/changes.js 中标题为「{task}」的记录 status 改为 \"已修复\"，改完跑 node --check"）
5. {Git → /requesting-code-review | SVN → svn diff > /tmp/bug.patch 后让 Claude 审查}
```
