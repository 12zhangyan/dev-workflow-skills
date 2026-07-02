# review-check Reference

> `/review-check` 的审查清单和输出格式。该 skill 只读，不修复。

---

## 审查清单

| 类别 | 必查问题 | 常见证据 |
|------|----------|----------|
| 需求一致性 | 实现是否偏离 dev-doc / Review 任务包目标；是否漏掉范围内要求 | dev-doc 目标、代码变更清单、接口约定 |
| 业务正确性 | 状态、金额、数量、权限、库存、审批、幂等等核心规则是否正确 | Service 分支、枚举流转、Mapper 条件 |
| 边界与异常 | null、空集合、非法枚举、重复提交、超长、临界值、异常吞掉 | if/else、校验注解、catch 块、默认值 |
| 事务 | `@Transactional(rollbackFor = Exception.class)`、回滚边界、跨服务调用、分页清理 | 注解位置、异常类型、PageHelper 使用 |
| 并发 | 重复请求、竞态、锁粒度、批量更新一致性、幂等 key | Redis/DB 锁、唯一约束、状态更新条件 |
| 安全 | 越权、敏感日志、SQL/表达式注入、明文凭证、生产连接串 | Controller 权限、日志、XML SQL、配置文件 |
| 前端鉴权 | 路由守卫、token 刷新队列、登录跳转、管理员权限判断是否一致 | router、store、request.ts、用户角色字段 |
| SSE/流式 | EventSource token、error/done 事件、连接中断、重复消费、loading 收尾 | SSE Controller、JWT Filter、前端 addEventListener |
| 富文本/预览 | `v-html` 是否消毒、iframe 地址是否可信、生成内容是否越权访问 | sanitize、iframe src、静态资源 Controller |
| AI 文件沙箱 | 文件读写是否限制在应用目录；覆盖写是否需先读；生成/修改模式是否会误判半成品 | FileRead/Write/List Tool、PathResolver、部署逻辑 |
| 性能 | 循环内 DB/远程调用、N+1、全表扫描、大对象加载、缺少批量查询 | for 循环、Mapper 调用、分页、查询条件 |
| 兼容 | 接口签名、响应字段、枚举值、配置默认值、老数据兼容 | DTO、Controller、OpenAPI、配置读取 |
| 配置部署 | CORS、JWT、Redis、LLM profile、Docker、CI 是否和运行文档一致 | yml/env/Dockerfile/workflow/README |
| 测试 | 是否覆盖主流程、异常、边界、回归；验证命令是否能证明风险已解除 | 测试类、用例数据、mvn/gradle 命令 |

---

## 输出格式

```text
来源：Code Review
审查对象：<review-task/dev-doc/patch/功能描述>
审查范围：<已读取的关键文件/文档>

Critical:
1. Severity: Critical
   File/Line: <path:line 或 Class.method>
   Problem: <问题是什么>
   Evidence: <来自 diff/源码/文档的证据>
   Impact: <可能造成什么后果>
   Fix: <建议怎么修>
   Verify: <如何验证>

Important:
1. Severity: Important
   File/Line:
   Problem:
   Evidence:
   Impact:
   Fix:
   Verify:

Minor:
1. Severity: Minor
   File/Line:
   Problem:
   Evidence:
   Impact:
   Fix:
   Verify:

Notes:
- <证据不足、非阻塞建议或已检查但未发现问题的说明>

可将以上 findings 原样贴回 /review-fix，用于生成修复交接文档。
```

没有 findings 时：

```text
来源：Code Review
审查对象：<...>
审查范围：<...>

未发现有证据的阻塞问题。

已检查：
- 需求一致性：<说明>
- 业务正确性：<说明>
- 边界/事务/并发/安全/前端/SSE/AI 文件沙箱/性能/兼容/测试：<说明>

Notes:
- <仍建议人工关注的不确定点>
```

