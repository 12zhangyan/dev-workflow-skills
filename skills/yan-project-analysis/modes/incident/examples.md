# bug-fix Examples

> 一个完整示例：订单导出接口 NPE。用于参考生成文档的风格和详略程度。
> 重点看：现象描述如何控制在一段以内、根因如何区分"已确认"和"推断"、验证步骤如何写到可直接执行。

---

## 示例：订单导出接口 NPE

**用户调用：** `使用 yan-project-analysis skill，mode=incident，记录订单导出500错误`

**由日志、堆栈、用户描述预填的信息：**
- 错误信息：`java.lang.NullPointerException at com.shop.order.service.OrderExportServiceImpl.buildRow(OrderExportServiceImpl.java:87)`
- 严重度：P1（运营每天要用导出，无绕行方案）
- 复现：1. 登录运营后台 → 2. 订单管理选 5 月整月 → 3. 点击「导出 Excel」→ 4. 提示系统繁忙，后端日志 NPE
- 触发条件：导出范围包含「已取消且未支付」的订单时必现；只导出已完成订单不出现
- 预期 vs 实际：预期生成 Excel 文件；实际接口 500，无文件生成
- 归属：`订单服务/导出`

**Step 3 代码定位结果：** `src/main/java/com/shop/order/service/OrderExportServiceImpl.java` 第 87 行 `order.getPayment().getPayTime()`，未判空。

**生成的文档：**

````markdown
# Bug 修复：订单导出500错误

- **日期**：2026-06-10
- **严重度**：P1（P0-致命 / P1-严重 / P2-一般 / P3-轻微）
- **状态**：未修复
- **分支**：feature/order-export

## 一、Bug 现象

### 错误信息 / 异常堆栈

```
java.lang.NullPointerException: Cannot invoke "com.shop.order.entity.Payment.getPayTime()" because the return value of "com.shop.order.entity.Order.getPayment()" is null
    at com.shop.order.service.OrderExportServiceImpl.buildRow(OrderExportServiceImpl.java:87)
    at com.shop.order.service.OrderExportServiceImpl.export(OrderExportServiceImpl.java:52)
    at com.shop.order.controller.OrderExportController.exportExcel(OrderExportController.java:34)
```

### 复现步骤

1. 登录运营后台，进入「订单管理」
2. 时间范围选择 2026-05-01 ~ 2026-05-31（包含已取消订单）
3. 点击「导出 Excel」，前端提示"系统繁忙"，后端日志出现上述 NPE

### 触发条件

导出范围内存在「已取消且未支付」的订单时必现；该类订单没有支付记录，`payment` 为 null。只导出已完成订单不会触发。

### 预期行为 vs 实际行为

| | 预期 | 实际 |
|---|---|---|
| 行为 | 生成并下载 Excel，未支付订单的支付时间列留空 | 接口 500，无文件生成 |

## 二、影响范围

运营后台订单导出功能完全不可用（只要范围内有取消订单就失败）；不影响下单、支付等主流程；无数据损坏。

## 三、根因分析

### 代码定位

`OrderExportServiceImpl.buildRow()`（OrderExportServiceImpl.java:87）：`order.getPayment().getPayTime()` 链式调用未判空。

### 根因

已确认：导出逐行构建 Excel 时直接取 `payment.payTime`，而「已取消且未支付」订单的 `payment` 关联为 null。5 月前导出范围默认只含已完成订单，所以一直没暴露；本月新增"全部状态"选项后触发。

## 四、修复方案

### 方案概述

`buildRow()` 中对 `payment` 判空，为 null 时支付时间列写空字符串；同时排查同方法内 `refund`、`invoice` 两个同模式的链式调用，一并防御。

### 最小影响分析

- 改动文件：仅 `OrderExportServiceImpl.java` 一个方法
- 是否影响其他功能：否，导出为只读操作，不触碰订单状态

## 五、代码变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| src/main/java/com/shop/order/service/OrderExportServiceImpl.java | 修改 | buildRow() 对 payment/refund/invoice 判空，null 时对应列留空 |
| src/test/java/com/shop/order/service/OrderExportServiceImplTest.java | 新增 | 覆盖"已取消未支付订单"导出用例 |

## 六、验证步骤

- [ ] 单测：构造 payment 为 null 的订单，断言 buildRow 不抛异常且支付时间列为空
- [ ] 集成：测试环境选 5 月整月导出，确认生成 Excel 且取消订单行支付时间为空
- [ ] 回归：只导出已完成订单，确认输出与修复前一致

## 七、实现 Todo

- [ ] buildRow() 增加判空逻辑
- [ ] 补充单元测试
- [ ] mvn test 全绿后走 Code Review
````

**追加到看板的对象（Step 5.5）：**

```js
  {
    kind: "bug",
    service: "订单服务",
    module: "导出",
    title: "订单导出500错误",
    date: "2026-06-10",
    severity: "P1",
    status: "未修复",
    branch: "feature/order-export",
    docPath: "docs/bugs/2026-06-10/订单导出500错误.md",
    symptom: "运营后台导出 5 月订单时接口 500，后端 NPE；范围含已取消未支付订单时必现。",
    stackTrace: `java.lang.NullPointerException: Cannot invoke "Payment.getPayTime()" because "Order.getPayment()" is null
    at com.shop.order.service.OrderExportServiceImpl.buildRow(OrderExportServiceImpl.java:87)`,
    reproSteps: ["登录运营后台进入订单管理", "时间范围选 5 月整月（含取消订单）", "点击导出 Excel → 500"],
    trigger: "导出范围内存在已取消且未支付的订单（payment 为 null）",
    expected: "生成 Excel，未支付订单支付时间列留空",
    actual: "接口 500，无文件生成",
    impact: "订单导出功能不可用；不影响主流程，无数据损坏",
    codeLocation: "OrderExportServiceImpl.buildRow()（OrderExportServiceImpl.java:87）链式调用未判空",
    rootCause: "已取消未支付订单无支付记录，order.getPayment() 返回 null，直接 .getPayTime() 抛 NPE",
    fixPlan: "buildRow() 对 payment/refund/invoice 判空，null 时对应列留空",
    changeList: [
      { file: "OrderExportServiceImpl.java", action: "修改", desc: "buildRow() 判空防御" },
      { file: "OrderExportServiceImplTest.java", action: "新增", desc: "取消订单导出用例" }
    ],
    verifySteps: ["单测覆盖 payment 为 null 用例", "测试环境整月导出验证", "回归已完成订单导出"],
    todos: ["buildRow() 增加判空", "补充单测", "mvn test 全绿后 Code Review"]
  },
```

**完成输出末尾的 Workflow Brief（交给下一位 AI 只需复制这段 + 文档路径）：**

```text
【Workflow Brief】
stage: PlanGate
task: 订单导出500错误
source: 用户描述 + 堆栈 OrderExportServiceImpl.java:87
artifacts: docs/bugs/2026-06-10/订单导出500错误.md；project-html/data/changes.js；docs/INDEX.md
changed: 无（Bug 记录阶段未改业务代码）
vcs: owner=Git 仓库根; tracked=已有业务代码; untracked=Bug 文档、看板和索引待纳管
tests: class=NotApplicable; command/result=未运行（Bug 记录阶段）
api: spec=无; index=无; operationIds=无
openFindings: 无
next: 按文档修复 buildRow() 判空 → VCS Gate → mvn -pl order-service test → review-fix
nextCommand: 读取 docs/bugs/2026-06-10/订单导出500错误.md，修复 buildRow() 判空并运行 mvn -pl order-service test
tokenHint: 下一位 AI 先读本 Brief -> 文档的根因/变更清单/验证步骤 -> 只读 OrderExportServiceImpl.buildRow()；首轮最多 5 个文件
```
