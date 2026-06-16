# dev-doc Examples

> 两个完整示例：新功能（用户登录优化）和 Bug 修复（支付回调签名）。
> 用于参考生成文档的风格和详略程度。

---

## 示例 1：新功能 - 用户登录优化

**用户调用：** `/dev-doc 用户登录优化`

**收集到的信息：**
- 任务类型：新功能
- 复杂度：中等
- 背景：现有账号密码登录留存率低，运营要求加入手机号验证码登录
- 目标：新增手机号登录，保留原账号密码登录，本次不做第三方登录
- 方案：新增 LoginStrategy 接口，密码登录和验证码登录各实现一个
- 数据/接口变化：新增 `/api/v1/auth/sms-login`，DB 加 `sms_verification` 表
- 风险：短信网关额度、验证码并发

**生成的文档：**

````markdown
# 用户登录优化 开发文档

> 日期：2026-05-31
> 任务类型：新功能
> 复杂度：中等
> 状态：草稿
> 关联分支：feature/sms-login
> 关联 Commit：暂无

---

## 一、需求说明

### 背景
现有仅支持账号密码登录，新用户留存率仅 18%。运营调研显示 60% 流失发生在注册环节，主要原因是密码设置麻烦。

### 目标
- [ ] 新增手机号 + 短信验证码登录方式
- [ ] 注册流程同步支持验证码注册
- [ ] 保持原账号密码登录方式可用

### 范围
- ✅ 包含：手机号登录、短信网关接入、验证码生成与校验
- ❌ 不包含：第三方登录（微信/支付宝）、生物识别登录

---

## 二、技术方案

### 方案概述
引入策略模式，定义统一的 LoginStrategy 接口，密码登录和验证码登录各为独立实现。

### 核心设计
- 新增 `LoginStrategy` 接口：`Result<UserToken> login(LoginRequest req)`
- 现有 `AuthServiceImpl` 改为持有 `Map<LoginType, LoginStrategy>`，按类型分发
- 验证码采用 Redis 存储，Key 格式 `sms:code:{phone}`，TTL 5 分钟

### 最小影响分析（开闭原则）
- **新增内容**：
  - `LoginStrategy` 接口
  - `PasswordLoginStrategy`、`SmsLoginStrategy` 实现类
  - `SmsService`、`SmsGatewayClient`
  - DB 表 `sms_verification`
- **不变内容**：
  - `User` 实体类
  - 现有 `/api/v1/auth/login` 接口的请求/响应结构
  - 所有依赖 `AuthService` 的上游 Controller
- **必须修改**：
  - `AuthServiceImpl.login()` 方法体——原因：从单一密码登录改为按类型分发，无法用扩展替代

---

## 三、API 设计

| Method | URL | 说明 |
|--------|-----|------|
| POST | /api/v1/auth/sms-code | 发送短信验证码 |
| POST | /api/v1/auth/sms-login | 验证码登录 |

**发送验证码 Request：**
```json
{ "phone": "13800138000" }
```

**登录 Request：**
```json
{ "phone": "13800138000", "code": "123456" }
```

**Response：**
```json
{ "code": 0, "data": { "token": "xxx", "expireIn": 7200 } }
```

---

## 四、数据库变更

- **DDL 变更**：新增 `sms_verification` 表（phone, code, created_at, used_at）
- **数据迁移**：无
- **回滚 SQL**：`DROP TABLE sms_verification;`

```sql
CREATE TABLE sms_verification (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  created_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  INDEX idx_phone (phone)
);
```

---

## 五、缓存策略

- **缓存 Key**：`sms:code:{phone}`
- **TTL**：5 分钟
- **失效策略**：用户登录成功后主动删除
- **击穿/雪崩防护**：单个手机号 60 秒内最多发送 1 次（Redis SETNX）

---

## 六、代码变更清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `auth/strategy/LoginStrategy.java` | 新增 | 登录策略接口 |
| `auth/strategy/PasswordLoginStrategy.java` | 新增 | 密码登录实现 |
| `auth/strategy/SmsLoginStrategy.java` | 新增 | 验证码登录实现 |
| `auth/service/AuthServiceImpl.java` | 修改 | 改为策略分发，无法用扩展替代 |
| `auth/controller/AuthController.java` | 新增 | sms-code 和 sms-login 接口 |
| `sms/SmsService.java` | 新增 | 短信发送服务 |

---

## 七、流程图

```mermaid
flowchart TD
    A([用户输入手机号]) --> B[/api/v1/auth/sms-code]
    B --> C{60秒内已发送?}
    C -->|是| D([返回限流提示])
    C -->|否| E[生成验证码]
    E --> F[Redis 存储 TTL=5min]
    F --> G[调用短信网关]
    G --> H([返回成功])
    H --> I[用户输入验证码]
    I --> J[/api/v1/auth/sms-login]
    J --> K{Redis 校验}
    K -->|不匹配| L([返回错误])
    K -->|匹配| M[查/建 User]
    M --> N[生成 Token]
    N --> O([返回 Token])
```

---

## 八、测试要点

### 单元测试
- [ ] `SmsLoginStrategy.login()` 各分支覆盖
- [ ] `SmsService.sendCode()` 限流逻辑

### 集成测试
- [ ] 完整流程：发码 → 登录 → Token 有效
- [ ] 验证码过期场景
- [ ] 同手机号 60 秒内重复发送被拒

### 边界与异常
- [ ] 手机号格式非法
- [ ] 验证码错误次数限制
- [ ] 短信网关超时降级

---

## 九、风险与注意事项

| 风险点 | 影响等级 | 应对措施 |
|--------|----------|----------|
| 短信网关额度耗尽 | 高 | 加用量监控，阈值告警 |
| 验证码并发请求 | 中 | Redis SETNX 防重复发送 |
| 老用户密码登录受影响 | 高 | 灰度发布，原流程保持不变 |

---

## 十、上线计划

- **依赖项**：短信网关账号申请、DB DDL 执行、Redis 容量评估
- **灰度策略**：先内部员工 → 1% 流量 → 10% → 全量
- **回滚方案**：关闭 sms-login 接口的 nacos 开关，前端切回密码登录
- **监控指标**：发码 QPS、登录成功率、短信到达率、网关耗时 P99

---

## 十一、实现 Todo

- [ ] DDL 上 test 环境
- [ ] LoginStrategy 接口及两个实现
- [ ] SmsService + 网关 client
- [ ] Controller 新增 2 个接口
- [ ] 单元测试覆盖
- [ ] 联调短信网关
- [ ] 配置灰度开关

---

## 十二、代码评审关注点

- **重点检查**：`SmsLoginStrategy.login()` 验证码校验分支、Redis 并发与过期场景
- **回归风险**：`AuthServiceImpl` 改为策略分发后，原密码登录路径是否仍正确执行
- **不要改的**：`User` 实体类、`/api/v1/auth/login` 原接口的请求/响应结构
````

**追加到看板的对象（Step 5.5，叙述字段面向人类重写、非 md 摘录；注意字符串转义）：**

```js
  {
    service: "用户中心",
    module: "认证",
    title: "用户登录优化",
    date: "2026-05-31",
    type: "新功能",
    complexity: "中等",
    status: "草稿",
    branch: "feature/sms-login",
    docPath: "docs/2026-05-31/用户登录优化.md",
    background: "现有登录只支持账号密码，新用户留存仅 18%，运营调研发现 60% 流失在注册环节、卡在设密码。\n这次加手机号验证码登录，让新用户少一步密码设置，同时保留老的密码登录不动。",
    goals: ["新增手机号+短信验证码登录", "注册流程支持验证码注册", "原账号密码登录保持可用"],
    scopeIn: ["手机号登录", "短信网关接入", "验证码生成与校验"],
    scopeOut: ["第三方登录（微信/支付宝）", "生物识别登录"],
    apis: [
      { method: "POST", url: "/api/v1/auth/sms-code", desc: "发送短信验证码（同手机号 60 秒限一次）" },
      { method: "POST", url: "/api/v1/auth/sms-login", desc: "验证码登录，校验通过签发 Token" }
    ],
    solution: "引入策略模式：抽出 LoginStrategy 接口，密码登录和验证码登录各做一个实现，AuthServiceImpl 改成按登录类型分发。\n验证码走 Redis 存（key sms:code:{phone}，TTL 5 分钟），登录成功后主动删；发码用 SETNX 做 60 秒防重。",
    coreDesign: "选策略模式而不是在原方法里加 if-else，是为了后续再加登录方式（扫码、第三方）时只加实现类、不动分发逻辑。\n放弃了「复制一套登录流程」的做法，因为会和密码登录产生大量重复校验代码。",
    flowchart: `flowchart TD
    A([用户输入手机号]) --> B[发送验证码]
    B --> C{60秒内已发送?}
    C -->|是| D([限流提示])
    C -->|否| E[生成验证码/Redis TTL 5min]
    E --> F[调短信网关]
    F --> G[用户输入验证码]
    G --> H{Redis 校验}
    H -->|不匹配| I([返回错误])
    H -->|匹配| J[查/建 User → 签发 Token]`,
    keyImpl: [
      { title: "登录方式分发", desc: "AuthServiceImpl 持有 Map<LoginType, LoginStrategy>，按入参类型路由，避免在单方法里堆登录分支。" },
      { title: "验证码防重发", desc: "发码用 Redis SETNX 占位 60 秒，命中则直接返回限流，挡住并发重复发送。" },
      { title: "验证码时效", desc: "code 存 Redis TTL 5 分钟，登录成功即删，过期或用过都不能复用。" }
    ],
    changeList: [
      { file: "auth/strategy/LoginStrategy.java", action: "新增", desc: "登录策略接口，统一 login 入口" },
      { file: "auth/strategy/SmsLoginStrategy.java", action: "新增", desc: "验证码登录实现" },
      { file: "auth/service/AuthServiceImpl.java", action: "修改", desc: "改为按类型分发，原单一密码登录无法用扩展替代" }
    ],
    todos: ["DDL 上 test", "LoginStrategy 及两实现", "SmsService+网关 client", "Controller 加 2 接口", "单测覆盖", "联调短信网关", "配置灰度开关"]
  },
```

> 对照看：md 的「核心设计」是给 AI 执行的要点清单，看板的 `coreDesign` 是讲给人听的取舍（为什么选策略模式、放弃了什么）；两者不是复制关系。`flowchart` 用反引号包裹，字符串字段含换行用 `\n`、含双引号用 `\"`。

---

## 示例 2：Bug 修复 - 支付回调签名

**用户调用：** `/dev-doc 支付回调签名修复`

**生成的文档（简版示例，省略未变章节）：**

````markdown
# 支付回调签名修复 开发文档

> 日期：2026-05-31
> 任务类型：Bug 修复
> 复杂度：简单
> 状态：草稿
> 关联分支：fix/alipay-signature
> 关联 Commit：a1b2c3d (引入问题的 SDK 升级)

---

## 一、需求说明

### 背景
监控发现支付宝异步回调失败率从 0.1% 上涨到 4.5%，时间点对应上周 SDK 升级。

### 目标
- [ ] 恢复回调成功率到 0.5% 以下

### 范围
- ✅ 包含：回调签名校验逻辑修复
- ❌ 不包含：SDK 回退、其他支付渠道

---

## 二、技术方案

### 方案概述
SDK 升级后默认签名算法从 RSA 改为 RSA2，但回调处理代码仍只校验 RSA。改为同时兼容两种算法。

### 核心设计
在 `AlipayCallbackHandler.verify()` 中根据 `sign_type` 参数路由：
- `sign_type=RSA` → 旧算法
- `sign_type=RSA2` → 新算法
- 缺失 → 默认 RSA2

### 最小影响分析（开闭原则）
- **新增内容**：`SignatureVerifier` 接口 + `RsaVerifier` + `Rsa2Verifier`
- **不变内容**：回调入口 `AlipayController.callback()`、订单状态机
- **必须修改**：`AlipayCallbackHandler.verify()` 改为通过接口分发，无法用扩展替代

---

## 六、代码变更清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `payment/alipay/SignatureVerifier.java` | 新增 | 签名校验接口 |
| `payment/alipay/RsaVerifier.java` | 新增 | RSA 实现 |
| `payment/alipay/Rsa2Verifier.java` | 新增 | RSA2 实现 |
| `payment/alipay/AlipayCallbackHandler.java` | 修改 | verify() 改为接口分发 |

## 八、测试要点

### 边界与异常
- [ ] sign_type=RSA 的旧回调能通过
- [ ] sign_type=RSA2 的新回调能通过
- [ ] sign_type 缺失时按 RSA2 处理
- [ ] 错误签名一定被拒绝（不能放过）

## 九、风险与注意事项

| 风险点 | 影响等级 | 应对措施 |
|--------|----------|----------|
| 修复后新错误签名校验逻辑有漏洞 | 高 | 加 mock 单测覆盖错误签名场景 |
| 历史失败回调需要补单 | 中 | 修复上线后查日志重放 24h 内失败的回调 |

## 十、上线计划

- **依赖项**：无
- **灰度策略**：直接全量（修复 Bug 不灰度）
- **回滚方案**：git revert
- **监控指标**：回调成功率（预期回落到 0.5% 以下）

## 十一、实现 Todo

- [ ] 写两个 Verifier 实现
- [ ] 改 AlipayCallbackHandler 路由
- [ ] 加单测覆盖 4 种场景
- [ ] 准备失败回调重放脚本

---

## 十二、代码评审关注点

- **重点检查**：错误签名是否一定被拒绝（不能有漏判），`sign_type` 缺失时是否按 RSA2 处理
- **回归风险**：RSA 旧签名的回调是否仍然能通过
- **不要改的**：`AlipayController.callback()` 入口、订单状态机流转逻辑
````

---

## 风格要点

对比两个示例可以看出：

1. **简单 Bug 不必写完整流程图** — 上面 Bug 修复示例直接省略了"流程图"章节
2. **不相关章节直接删除** — Bug 修复没动 DB 和缓存，那两节就不要保留空模板
3. **最小影响分析永远要写** — 这是开闭原则的硬约束
4. **风险章节务必填具体值** — "高/中/低" 后面必须有具体应对措施，不能空着
5. **代码评审关注点永远要写** — 为后续 /code-review 提供具体检查目标，不能省略
