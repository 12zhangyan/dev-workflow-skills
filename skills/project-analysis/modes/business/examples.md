# biz-flow 已填示例

> 一份完整示例：从用户提供的接口出发，产出面向测试的业务流方案 + 看板条目。
> 生成时按真实信息替换，画不出的图删掉。

---

## 示例：订单超时自动取消

**用户提供的接口：**
- `POST /api/v1/order/create` 创建订单（同步）
- `POST /api/v1/pay/callback` 支付回调（第三方异步通知）
- 定时任务 `OrderTimeoutJob`（每分钟扫描超时未支付订单）

### 生成的 md（节选）

```markdown
# 订单超时自动取消 业务逻辑梳理（面向测试）

> 日期：2026-06-16
> 归属：订单服务/履约
> 读者：测试 / 产品

## 一、业务概述

用户下单后订单进入「待支付」，系统给 30 分钟支付窗口。期间用户可正常支付，支付成功后订单转「待发货」并真正扣减库存。
若 30 分钟内未支付，定时任务会把订单置为「已关闭」，并释放下单时锁定的库存。已关闭的订单即使收到迟到的支付回调也不再生效（资金原路退回）。
测试主线是这两条路径：按时支付走履约、超时未支付走自动关闭，重点验证库存的「锁定→扣减/释放」是否守恒。

## 二、角色与入口

| 角色/触发方 | 入口/操作 | 业务职责 | 测试关注 |
|-------------|-----------|----------|----------|
| 用户 | POST /api/v1/order/create | 创建待支付订单 | 登录态、商品库存、重复提交 |
| 第三方支付平台 | POST /api/v1/pay/callback | 推送支付结果 | 幂等、迟到回调、签名校验 |
| 定时任务 | OrderTimeoutJob | 扫描并关闭超时订单 | 扫描窗口、并发竞争 |

## 九、阶段数据变动

### 9.1 创建订单

| 数据对象/表 | 操作 | 关键字段/变化 | 测试核对点 |
|-------------|------|---------------|------------|
| t_order | INSERT | status=待支付，payDeadline=createTime+30min | 订单初始状态和截止时间正确 |
| t_stock | UPDATE | lockedQty 增加，下单数量被锁定 | 可用库存减少、锁定库存增加 |

## 三、业务流转图

（业务状态怎么流转、什么条件走什么分支，测试用例主线）

## 八、测试关注点

### 正常流程
- [ ] 30 分钟内支付成功 → 订单「待发货」、库存扣减、不再被定时任务关闭
### 异常与边界
- [ ] 第 29 分 59 秒支付 / 第 30 分 01 秒支付（窗口临界）
- [ ] 订单已被定时任务关闭后，支付回调才到达 → 订单保持「已关闭」，资金退回
### 并发与幂等
- [ ] 支付回调重复推送多次 → 只扣一次库存（幂等）
- [ ] 定时任务与支付回调同时处理同一订单 → 不出现「已关闭又已发货」
### 数据核对
- [ ] 关闭订单后核对 t_stock 锁定数归零、可用库存还原
```

### 对应看板条目（追加到 data/changes.js）

```js
  {
    kind: "biz",
    service: "订单服务",
    module: "履约",
    title: "订单超时自动取消",
    type: "业务流",
    status: "已完成",
    date: "2026-06-16",
    branch: "feature/order-timeout",
    docPath: "docs/biz-flow/2026-06-16/订单超时自动取消.md",
    background: "用户下单后订单进入「待支付」，系统给 30 分钟支付窗口。支付成功转「待发货」并扣减库存；超时未支付则由定时任务置为「已关闭」并释放锁定库存。\n已关闭订单即使收到迟到回调也不生效，资金原路退回。测试主线是按时支付与超时关闭两条路径，重点验证库存「锁定→扣减/释放」守恒。",
    roles: [
      { name: "用户", channel: "前台", entry: "POST /api/v1/order/create", desc: "提交订单并进入支付窗口，测试关注登录态、库存和重复提交。" },
      { name: "第三方支付平台", channel: "回调", entry: "POST /api/v1/pay/callback", desc: "推送支付结果，测试关注签名、幂等和迟到回调。" },
      { name: "OrderTimeoutJob", channel: "定时任务", entry: "每分钟扫描", desc: "关闭超时未支付订单，测试关注扫描窗口和并发竞争。" }
    ],
    context: [
      { field: "userId", source: "登录 token", usage: "订单归属与权限校验", note: "未登录不可下单" },
      { field: "payDeadline", source: "createTime + 30min", usage: "定时任务判断是否超时", note: "测试 29:59 / 30:01 临界点" }
    ],
    apis: [
      { method: "POST", url: "/api/v1/order/create", desc: "创建订单，锁定库存，状态置待支付" },
      { method: "POST", url: "/api/v1/pay/callback", desc: "支付回调，幂等扣减库存，状态转待发货" }
    ],
    bizFlow: `flowchart TD
  A([用户下单]) --> B{库存充足?}
  B -->|否| Z([下单失败])
  B -->|是| C[锁定库存/订单=待支付]
  C --> D{30分钟内支付?}
  D -->|是| E[扣减库存/订单=待发货]
  D -->|否| F[释放库存/订单=已关闭]
  F --> G{迟到回调?}
  G -->|是| H[原路退款/订单仍=已关闭]`,
    dataFlow: `flowchart LR
  IN[下单入参] --> O[订单服务]
  O -->|写| T1[(t_order)]
  O -->|锁定| T2[(t_stock)]
  JOB[OrderTimeoutJob] -->|扫描超时| T1
  JOB -->|释放| T2
  PAY[支付回调] --> O`,
    sequence: `sequenceDiagram
  participant U as 用户
  participant O as 订单服务
  participant S as 库存服务
  participant J as 定时任务
  U->>O: 创建订单
  O->>S: 锁定库存
  S-->>O: 锁定成功
  O-->>U: 待支付(30min)
  alt 按时支付
    U->>O: 支付回调
    O->>S: 扣减库存
  else 超时
    J->>O: 扫描到超时
    O->>S: 释放库存
  end`,
    stateMachine: `stateDiagram-v2
  [*] --> 待支付
  待支付 --> 待发货: 支付成功
  待支付 --> 已关闭: 超时未支付
  已关闭 --> 已关闭: 迟到回调(退款)`,
    dataChanges: [
      { stage: "创建订单", trigger: "POST /api/v1/order/create", summary: "创建待支付订单并锁定库存；任一步失败需要回滚。",
        operations: [
          { target: "t_order", action: "INSERT", fields: "status=待支付，payDeadline=createTime+30min", check: "订单初始状态和截止时间正确" },
          { target: "t_stock", action: "UPDATE", fields: "lockedQty 增加，可用库存减少", check: "库存锁定数与订单数量一致" }
        ] },
      { stage: "支付回调", trigger: "POST /api/v1/pay/callback", summary: "支付成功后订单进入待发货并扣减锁定库存；重复回调只生效一次。",
        operations: [
          { target: "t_order", action: "UPDATE", fields: "待支付 -> 待发货", check: "重复回调不重复变更" },
          { target: "t_stock", action: "UPDATE", fields: "lockedQty 减少，soldQty 增加", check: "库存扣减守恒" }
        ] },
      { stage: "超时关闭", trigger: "OrderTimeoutJob", summary: "扫描超时未支付订单并释放锁定库存；与支付回调并发时只能有一个终态。",
        operations: [
          { target: "t_order", action: "UPDATE", fields: "待支付 -> 已关闭", check: "已支付订单不被关闭" },
          { target: "t_stock", action: "UPDATE", fields: "lockedQty 减少，可用库存还原", check: "关闭后锁定库存归零" }
        ] }
    ],
    bizRules: [
      { title: "支付窗口", desc: "订单创建后 30 分钟内未支付即超时；以订单 createTime + 30min 为界，定时任务每分钟扫描一次，存在最多 1 分钟的扫描延迟。" },
      { title: "库存守恒", desc: "下单锁定、支付扣减、超时释放；任一时刻锁定数 = 待支付订单占用数，关闭或扣减后必须同步调整，避免超卖或少卖。" },
      { title: "回调幂等", desc: "支付回调以支付流水号去重，重复回调只扣一次库存；订单已关闭时回调触发原路退款而非扣库存。" }
    ],
    validations: [
      { stage: "创建订单", rule: "库存必须充足", failure: "返回下单失败，不写订单", check: "库存为 0 时 t_order 无新增" },
      { stage: "支付回调", rule: "支付流水号幂等", failure: "重复回调直接返回成功但不重复扣库存", check: "同一流水多次回调库存只变一次" },
      { stage: "超时关闭", rule: "仅待支付可关闭", failure: "非待支付订单跳过", check: "待发货订单不被定时任务关闭" }
    ],
    testPoints: [
      "30 分钟内支付成功 → 订单待发货、库存扣减、不再被定时任务关闭",
      "支付窗口临界：第 29:59 与 30:01 支付的不同结果",
      "订单已关闭后支付回调到达 → 订单保持已关闭、资金原路退回",
      "支付回调重复推送多次 → 库存只扣一次（幂等）",
      "定时任务与支付回调并发处理同一订单 → 不出现状态错乱",
      "关闭订单后核对 t_stock 锁定数归零、可用库存还原"
    ],
    dataObjects: [
      { name: "t_order", phase: "创建/支付/关闭", action: "INSERT/UPDATE", note: "status、payDeadline、payFlowNo" },
      { name: "t_stock", phase: "创建/支付/关闭", action: "UPDATE", note: "availableQty、lockedQty、soldQty" },
      { name: "支付服务", phase: "支付回调", action: "CALLBACK", note: "签名、流水号、回调时间" }
    ]
  },
```

---

## 写作要点回顾

- **business 视角**：`background` 讲业务怎么走，不讲类和方法
- **三图分工**：业务流转（分支主线）/ 数据流（数据落点）/ 时序（跨服务时机），画不出的删掉
- **阶段拆解**：像扫码、申请、审核、驳回、回调这类业务，必须写阶段数据变动，测试才能按阶段查表验状态
- **测试点要可验证**：带具体数字、具体表名、具体并发场景，而不是"测一下幂等"
- **业务规则三段式**：触发条件 → 系统行为 → 边界
