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

### 最小影响分析

- 改动文件：
- 是否影响其他功能：

## 五、代码变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
|  |  |  |

## 六、验证步骤

- [ ] 
- [ ] 

## 七、实现 Todo

- [ ] 
- [ ] 
````

---

## html-追加格式

追加到 `changes` 数组时的 JS 对象格式（空值字段可省略）：

```js
    {
      kind: "bug",
      module: "<module>",
      title: "<title>",
      date: "<date>",
      severity: "<severity>",
      status: "未修复",
      branch: "<branch>",
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

**注意**：`stackTrace` 含换行时用模板字面量（反引号）；含反引号时改用双引号并将换行转为 `\n`。

---

## 完成后输出格式

```
✅ Bug 文档已生成：docs/bugs/{date}/{task}.md
🐛 HTML 看板已更新：project-html/index.html

📋 关键信息
- 严重度：{severity}
- 初步定位：{codeLocation 摘要，或"待分析"}
- 修复方向：{fixPlan 摘要}

🚀 下一步
1. 打开文档，根据代码定位结果补全「三、根因分析」
2. 按「五、代码变更清单」逐项修复
3. 执行「六、验证步骤」确认修复效果
4. 浏览器打开看板，点击该 Bug 的状态标签切换为「修复中 / 已修复 / 已验证」（保存在本地）
5. {Git → /requesting-code-review | SVN → svn diff > /tmp/bug.patch 后让 Claude 审查}
```
