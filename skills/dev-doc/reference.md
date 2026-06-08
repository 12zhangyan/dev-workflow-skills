# dev-doc Reference

> SKILL.md 的详细规范——文档模板、问题集、输出格式。
> 此文件在 Step 3-6 按需加载，不在 SKILL.md 启动时注入。

---

## Step 3 问题集

### 简单任务（≤50 行）→ 只问 2 个

1. 这次要解决什么问题？
2. 大概怎么实现？

### 新功能（5 个）

1. 需求背景：为什么做？谁提的？解决什么痛点？
2. 目标与范围：本次明确要做什么？明确不做什么？
3. 技术方案：怎么实现？涉及哪些模块/包/类？
4. 数据/接口变化：新增 API？DB 表/字段变更？缓存策略？
5. 涉及哪些现有类/接口需要了解？（接口定义、已有实现、方法签名）

### Bug 修复（5 个）

1. 现象：用户怎么发现的？怎么复现？
2. 根因：定位到的根本原因是什么？
3. 影响范围：这个 bug 影响哪些功能/用户/数据？
4. 修复方案：怎么改？是否需要修复历史脏数据？
5. 回归风险：修复会不会影响其他功能？

### 重构 / 性能优化（5 个）

1. 动机：为什么必须重构？现状的问题是什么？
2. 方案：重构到什么样？性能目标是什么（带数字）？
3. 兼容性：对现有调用方有什么影响？
4. 验证方式：怎么证明改对了？压测指标？
5. 灰度策略：怎么逐步上线？

### API 联调（5 个）

1. 对接的是哪个第三方服务？有什么对接文档（Swagger / PDF / 口头说明）？
2. 联调环境：对方有测试环境吗？本地怎么 Mock？
3. 接口契约：请求/响应结构确认了吗？有没有非标准的地方（非 JSON、特殊签名、特殊编码）？
4. 异常与降级：对方超时/报错时我们怎么处理？是否有熔断、重试策略？
5. 上线节奏：对方需要配合上线吗？联调通过的验收标准是什么？

### 配置变更（5 个）

1. 变更哪个配置项？所在平台是 Nacos / Apollo / application.yml / 环境变量？
2. 影响范围：这个配置影响哪些功能、哪些服务实例？
3. 变更方式：需要重启服务吗？还是支持热更新？
4. 回滚方案：配置推错了怎么快速回退？多久能生效？
5. 验证方式：怎么确认配置生效？（看日志 / 调接口 / 看监控指标）

---

## 文档模板

````markdown
# $task 开发文档

> 日期：<YYYY-MM-DD>
> 任务类型：<新功能 / Bug 修复 / 重构 / 性能优化>
> 复杂度：<简单 / 中等 / 复杂>
> 状态：草稿
> 关联分支/路径：<Git: branch 名 | SVN: 路径如 trunk / branches/feature-xxx>
> 关联版本：<Git: commit hash | SVN: revision 号如 r1234 | 暂无>

---

## 一、需求说明

### 背景
[需求来源、触发原因、解决的问题]

### 目标
- [ ] [明确的目标 1]
- [ ] [明确的目标 2]

### 范围
- ✅ 包含：[本次涉及的功能/模块]
- ❌ 不包含：[明确排除的内容，防止范围蔓延]

---

## 二、技术方案

### 方案概述
[一句话描述整体技术思路]

### 核心设计
[关键设计决策：数据结构、算法、架构选择及原因]

### 最小影响分析（开闭原则）
- **新增内容**：[新增的类 / 方法 / 接口]
- **不变内容**：[明确列出不会被修改的现有代码]
- **必须修改**：[如有，说明原因及为何无法用扩展替代]

---

## 三、API 设计

> 如不涉及 API 变更，删除本节

| Method | URL | 说明 |
|--------|-----|------|
| GET / POST / PUT / DELETE | /api/v1/xxx | |

**Request：**
```json
{}
```

**Response：**
```json
{}
```

---

## 四、数据库变更

> 如不涉及 DB 变更，删除本节

- **DDL 变更**：[新增表 / 加字段 / 加索引]
- **数据迁移**：[是否需要迁移脚本，估计影响行数]
- **回滚 SQL**：[如何回滚]

```sql
-- DDL
```

---

## 五、缓存策略

> 如不涉及缓存，删除本节

- **缓存 Key**：[格式与命名规范]
- **TTL**：[过期时间]
- **失效策略**：[主动失效 / 被动过期]
- **击穿/雪崩防护**：[如何防护]

---

## 六、代码变更清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| | 新增 / 修改 / 删除 | |

> 修改类条目必须在"说明"列写明为何无法用扩展替代

---

## 七、流程图

```mermaid
flowchart TD
    A([开始]) --> B[步骤一]
    B --> C{判断条件}
    C -->|是| D[处理 A]
    C -->|否| E[处理 B]
    D --> F([结束])
    E --> F
```

> 根据实际业务流程替换占位节点。复杂任务可用 sequenceDiagram（时序图）

---

## 八、测试要点

### 单元测试
- [ ] [关键方法的单元测试覆盖]

### 集成测试
- [ ] [接口级别的集成测试]

### 边界与异常
- [ ] 入参为 null / 空字符串 / 超长
- [ ] 并发场景（如涉及）
- [ ] 异常分支（DB 失败、网络超时、第三方服务异常）

---

## 九、风险与注意事项

| 风险点 | 影响等级 | 应对措施 |
|--------|----------|----------|
| | 高 / 中 / 低 | |

---

## 十、上线计划

> 简单/中等任务只保留前两项；复杂任务才需要灰度策略和监控指标

- **依赖项**：[DB 变更 / 配置变更 / 第三方服务]
- **回滚方案**：[出问题如何快速回退]
- **灰度策略**：[复杂任务填写：如何分批 / 用户白名单 / 按比例]
- **监控指标**：[复杂任务填写：上线后看哪些指标]

---

## 十一、实现 Todo

> 把方案拆成可执行任务，编码时直接对照打勾

- [ ] [步骤 1]
- [ ] [步骤 2]
- [ ] [步骤 3]

---

## 十二、代码评审关注点

> 为 Code Review 阶段准备，基于本次变更填写

- **重点检查**：[最容易出错的代码路径、边界条件]
- **回归风险**：[改动可能波及的已有功能]
- **不要改的**：[明确不应该被修改的文件/方法/接口]

---

## 十三、Apifox 接口规范

> 仅涉及 API 新增或修改时保留本节，否则删除。
> 以下 YAML 可直接复制，在 Apifox 中通过「导入 → OpenAPI / Swagger」粘贴导入。

```yaml
openapi: "3.0.3"
info:
  title: "[任务名称] API"
  description: "[需求背景一句话]"
  version: "1.0.0"
servers:
  - url: "http://localhost:8080"
    description: "本地开发"
tags:
  - name: "[模块名]"
    description: "[功能描述]"
paths:
  /api/v1/[resource]:
    post:                          # 按实际方法替换（get/post/put/delete/patch）
      tags: ["[模块名]"]
      summary: "[接口一句话描述]"
      operationId: "[camelCase唯一ID]"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - field1            # 必填字段列表
              properties:
                field1:
                  type: string
                  description: "[字段说明]"
                  example: "示例值"
                field2:
                  type: integer
                  description: "[字段说明]"
                  example: 1
      responses:
        "200":
          description: "成功"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CommonResponse"
        "400":
          description: "参数错误"
        "401":
          description: "未登录"
        "500":
          description: "服务器错误"
components:
  schemas:
    CommonResponse:
      type: object
      properties:
        code:
          type: integer
          description: "状态码，0 表示成功"
          example: 0
        data:
          description: "业务数据"
        message:
          type: string
          description: "提示信息"
          example: "success"
```

> 填写指引：
> - `paths` 下每个路径对应一个接口，多接口直接并列
> - `operationId` 建议与 Controller 方法名一致，方便 Apifox 生成代码
> - 字段类型：`string` / `integer` / `number` / `boolean` / `array` / `object`
> - 数组示例：`type: array` + `items: { type: string }`
> - 引用公共响应体：`$ref: "#/components/schemas/CommonResponse"`
````

---

## 完成后输出格式

```
✅ 文档已生成：docs/<日期>/<任务名>.md

📌 关键决策：
1. <一句话>
2. <一句话>
3. <一句话>

🤖 交给 Claude/Cursor 执行（直接粘贴）：
"参考 docs/<日期>/<任务名>.md 实现技术方案。
按「六、代码变更清单」逐项执行。
修改类条目先确认「最小影响分析」中的原因再动手。"

📁 纳入版本控制并确认变更范围：
- [ ] Git: `git add <新文件>` | SVN: `svn add <新文件>`
- [ ] 查看完整变更：`git diff` / `svn diff`

🧪 先验证（没有绿灯不进 Code Review）：
- [ ] <验证命令>（Maven: `mvn test` / Gradle: `./gradlew test` / Node: `npm test`）
- [ ] 测试全绿 → 继续；有失败 → 先修复再验证

🤖 AI 代码审查（修复后再继续）：
- [ ] Git: `/requesting-code-review` | SVN: `svn diff > /tmp/changes.patch` 后让 Claude 读取审查
- [ ] 按 Critical / Important / Minor 分级处理，修复后重跑测试确认全绿

👁 生成代码地图，自己 Review：
- [ ] `/code-reading docs/<日期>/<任务名>.md`（利用 dev-doc 生成调用链 + 状态机 + 关键位置）
- [ ] 对照地图检查业务逻辑、事务边界、关键注意点
- [ ] /chinese-code-review 整理评论话术（如有问题）
```

---

## HTML 展示页模板

> Step 5.5 在 `project-html/index.html` 不存在时，用 Write 工具将以下内容整体写入。
> 将所有 `<占位符>` 替换为实际值后再写入。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 变更记录</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; font-size: 14px; color: #1f2329; background: #fff; display: flex; height: 100vh; overflow: hidden; }
    .sidebar { width: 256px; flex-shrink: 0; height: 100vh; background: #f7f8fa; border-right: 1px solid #e5e6eb; display: flex; flex-direction: column; }
    .sidebar-header { padding: 16px 16px 12px; border-bottom: 1px solid #e5e6eb; flex-shrink: 0; }
    .sidebar-title { font-size: 15px; font-weight: 600; color: #1f2329; display: flex; align-items: center; gap: 8px; }
    .sidebar-sub { font-size: 12px; color: #8f959e; margin-top: 3px; padding-left: 24px; }
    .sidebar-body { flex: 1; overflow-y: auto; padding: 6px 0 8px; }
    .sidebar-body::-webkit-scrollbar { width: 4px; }
    .sidebar-body::-webkit-scrollbar-thumb { background: #d0d3d8; border-radius: 2px; }
    .sidebar-footer { flex-shrink: 0; border-top: 1px solid #e5e6eb; padding: 8px; }
    .mod-hd { display: flex; align-items: center; gap: 5px; padding: 6px 10px; margin: 1px 6px; border-radius: 6px; cursor: pointer; user-select: none; font-size: 13px; font-weight: 500; color: #1f2329; }
    .mod-hd:hover { background: #ebedf0; }
    .chev { width: 14px; text-align: center; font-size: 9px; color: #8f959e; transition: transform 0.15s; flex-shrink: 0; }
    .chev.open { transform: rotate(90deg); }
    .mod-ico { font-size: 14px; flex-shrink: 0; }
    .mod-nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mod-badge { font-size: 11px; color: #8f959e; background: #e5e6eb; padding: 1px 6px; border-radius: 10px; flex-shrink: 0; }
    .doc-item { display: flex; align-items: center; gap: 6px; padding: 5px 10px 5px 30px; margin: 1px 6px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #3d4757; white-space: nowrap; overflow: hidden; }
    .doc-item:hover { background: #ebedf0; }
    .doc-item.active { background: #e1eaff; color: #2b5ef6; font-weight: 500; }
    .doc-ico { font-size: 12px; flex-shrink: 0; color: #8f959e; }
    .doc-item.active .doc-ico { color: #2b5ef6; }
    .doc-lbl { overflow: hidden; text-overflow: ellipsis; }
    .log-btn { display: flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #646a73; user-select: none; }
    .log-btn:hover { background: #ebedf0; }
    .log-btn.active { color: #2b5ef6; background: #e1eaff; font-weight: 500; }
    .main { flex: 1; height: 100vh; overflow-y: auto; background: #fff; }
    .main::-webkit-scrollbar { width: 6px; }
    .main::-webkit-scrollbar-thumb { background: #d0d3d8; border-radius: 3px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; color: #8f959e; }
    .empty-ico { font-size: 40px; opacity: 0.3; }
    .doc-view { max-width: 800px; margin: 0 auto; padding: 40px 56px 80px; }
    .breadcrumb { font-size: 12px; color: #8f959e; margin-bottom: 16px; display: flex; align-items: center; gap: 5px; }
    .bc-sep { color: #c8c9cc; }
    .doc-h1 { font-size: 26px; font-weight: 700; color: #1f2329; line-height: 1.35; margin-bottom: 12px; letter-spacing: -0.4px; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    .t-新功能 { background: #e8f0ff; color: #2b5ef6; } .t-Bug修复 { background: #fff0f0; color: #d83931; }
    .t-重构 { background: #edfaef; color: #2da641; } .t-性能优化 { background: #fff7e6; color: #d97706; }
    .t-设计 { background: #f5eeff; color: #7c3aed; } .t-配置变更 { background: #f5f5f5; color: #646a73; }
    .t-status-草稿 { background: #f5f5f5; color: #8f959e; } .t-status-进行中 { background: #fffbe6; color: #d97706; } .t-status-已完成 { background: #edfaef; color: #2da641; }
    .t-cplx { background: #f5f5f5; color: #646a73; }
    .doc-meta { display: flex; align-items: center; gap: 16px; font-size: 13px; color: #8f959e; padding: 10px 0 20px; border-bottom: 1px solid #f0f0f0; margin-bottom: 28px; }
    .sec { margin-bottom: 30px; }
    .sec-title { font-size: 15px; font-weight: 600; color: #1f2329; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .sec-title::before { content: ""; display: inline-block; width: 3px; height: 15px; background: #2b5ef6; border-radius: 2px; }
    .sec-body { font-size: 14px; color: #3d4757; line-height: 1.75; }
    .scope-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .scope-in { background: #edfaef; color: #2da641; padding: 3px 10px; border-radius: 20px; font-size: 12px; }
    .scope-out { background: #fff0f0; color: #d83931; padding: 3px 10px; border-radius: 20px; font-size: 12px; }
    .scope-label { font-size: 12px; color: #8f959e; margin-right: 4px; }
    .checklist { list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .checklist li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: #3d4757; }
    .checklist li::before { content: "☐"; color: #8f959e; flex-shrink: 0; margin-top: 1px; }
    .api-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
    .api-table th { text-align: left; padding: 8px 12px; background: #f7f8fa; border: 1px solid #e5e6eb; color: #646a73; font-weight: 500; }
    .api-table td { padding: 8px 12px; border: 1px solid #e5e6eb; color: #3d4757; vertical-align: top; }
    .api-table tr:hover td { background: #fafafa; }
    .method { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; font-family: monospace; }
    .m-GET { background: #edfaef; color: #2da641; } .m-POST { background: #e8f0ff; color: #2b5ef6; }
    .m-PUT { background: #fff7e6; color: #d97706; } .m-DELETE { background: #fff0f0; color: #d83931; } .m-PATCH { background: #f5eeff; color: #7c3aed; }
    .api-url { font-family: monospace; font-size: 12px; }
    details { margin-top: 8px; } summary { cursor: pointer; font-size: 12px; color: #8f959e; user-select: none; padding: 4px 0; }
    .json-block { font-family: monospace; font-size: 12px; background: #f7f8fa; border: 1px solid #e5e6eb; border-radius: 6px; padding: 10px 12px; margin-top: 6px; white-space: pre-wrap; word-break: break-all; color: #3d4757; line-height: 1.6; }
    .mermaid-wrap { padding: 16px; background: #fafafa; border: 1px solid #e5e6eb; border-radius: 8px; overflow-x: auto; text-align: center; }
    .flowchart-fallback { font-family: monospace; font-size: 12px; background: #f7f8fa; padding: 12px; border-radius: 6px; white-space: pre; color: #646a73; text-align: left; }
    .keyimpl-list { display: flex; flex-direction: column; gap: 10px; }
    .keyimpl-item { padding: 12px 14px; background: #f7f8fa; border-left: 3px solid #2b5ef6; border-radius: 0 6px 6px 0; }
    .ki-title { font-size: 13px; font-weight: 600; color: #1f2329; margin-bottom: 4px; }
    .ki-desc { font-size: 13px; color: #646a73; line-height: 1.6; }
    .ctable { width: 100%; border-collapse: collapse; font-size: 13px; }
    .ctable th { text-align: left; padding: 8px 12px; background: #f7f8fa; border: 1px solid #e5e6eb; color: #646a73; font-weight: 500; }
    .ctable td { padding: 8px 12px; border: 1px solid #e5e6eb; color: #3d4757; vertical-align: top; }
    .ctable tr:hover td { background: #fafafa; }
    .ctable code { font-size: 12px; background: #f0f1f3; padding: 1px 5px; border-radius: 3px; font-family: monospace; }
    .abadge { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .a-新增 { background: #edfaef; color: #2da641; } .a-修改 { background: #fff7e6; color: #d97706; } .a-删除 { background: #fff0f0; color: #d83931; }
    .timeline { display: flex; flex-direction: column; }
    .tl-item { display: flex; }
    .tl-left { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; margin-top: 5px; }
    .tl-dot { width: 8px; height: 8px; border-radius: 50%; background: #2b5ef6; flex-shrink: 0; }
    .tl-line { flex: 1; width: 1px; background: #e5e6eb; margin: 4px 0; min-height: 24px; }
    .tl-item:last-child .tl-line { display: none; }
    .tl-right { padding: 0 0 24px 14px; flex: 1; }
    .tl-date { font-size: 12px; color: #8f959e; margin-bottom: 3px; }
    .tl-desc { font-size: 14px; color: #3d4757; line-height: 1.5; }
  </style>
</head>
<body>
<aside class="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-title">📚 AI 变更记录</div>
    <div class="sidebar-sub" id="sub"></div>
  </div>
  <div class="sidebar-body" id="sb"></div>
  <div class="sidebar-footer">
    <div class="log-btn" id="log-btn" onclick="showLog()">📋 HTML 变更日志</div>
  </div>
</aside>
<main class="main" id="main">
  <div class="empty-state"><div class="empty-ico">📄</div><div>选择左侧文档开始阅读</div></div>
</main>
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'inherit' });
  const htmlChangelog = [
    { date: "<date>", desc: "初始化 AI 变更记录展示页" },
    // ─── 在此行上方追加变更日志 ───
  ];
  const changes = [
    {
      module: "<module>", title: "<title>", date: "<date>", type: "<type>",
      complexity: "<complexity>", status: "草稿", branch: "<branch>",
      background: "<background>",
      goals: [<goals>],
      scopeIn: [<scopeIn>], scopeOut: [<scopeOut>],
      apis: [],
      solution: "<solution>", coreDesign: "<coreDesign>",
      flowchart: `<flowchart>`,
      changeList: [<changeList>],
      todos: [<todos>]
    },
    // ─── 在此行上方追加新记录 ───
  ];
  let sel = null;
  const exp = new Set();
  function grp() { const m = {}; changes.forEach((c,i)=>{ const k=c.module||"通用"; if(!m[k])m[k]=[]; m[k].push(i); }); return m; }
  function renderSidebar() {
    const g = grp();
    document.getElementById("sub").textContent = `共 ${changes.length} 篇文档`;
    document.getElementById("sb").innerHTML = Object.entries(g).map(([mod,ids]) => {
      const open = exp.has(mod);
      return `<div><div class="mod-hd" onclick="tog('${esc(mod)}')"><span class="chev ${open?'open':''}">▶</span><span class="mod-ico">📁</span><span class="mod-nm">${esc(mod)}</span><span class="mod-badge">${ids.length}</span></div>
      <div style="display:${open?'block':'none'}">${ids.map(i=>`<div class="doc-item ${sel===i?'active':''}" onclick="pick(${i})"><span class="doc-ico">📄</span><span class="doc-lbl">${esc(changes[i].title)}</span></div>`).join('')}</div></div>`;
    }).join('');
    document.getElementById("log-btn").className = "log-btn"+(sel===-1?" active":"");
  }
  function tog(m) { exp.has(m)?exp.delete(m):exp.add(m); renderSidebar(); }
  function pick(i) {
    sel = i; renderSidebar();
    const d = changes[i], mod = d.module||"通用";
    let h = `<div class="doc-view"><div class="breadcrumb"><span>${esc(mod)}</span><span class="bc-sep">/</span><span>${esc(d.title)}</span></div>
      <h1 class="doc-h1">${esc(d.title)}</h1>
      <div class="tags"><span class="tag t-${esc(d.type)}">${esc(d.type)}</span><span class="tag t-cplx">${esc(d.complexity)}</span><span class="tag t-status-${esc(d.status)}">${esc(d.status)}</span></div>
      <div class="doc-meta"><span>📅 ${esc(d.date)}</span>${d.branch?`<span>🌿 ${esc(d.branch)}</span>`:''}</div>`;
    const hasReq = d.background||d.goals?.length||d.scopeIn?.length||d.scopeOut?.length;
    if (hasReq) {
      let b='';
      if(d.background) b+=`<p class="sec-body" style="margin-bottom:12px">${esc(d.background)}</p>`;
      if(d.goals?.length) b+=`<ul class="checklist" style="margin-bottom:12px">${d.goals.map(g=>`<li>${esc(g)}</li>`).join('')}</ul>`;
      if(d.scopeIn?.length||d.scopeOut?.length){ b+=`<div>`;
        if(d.scopeIn?.length) b+=`<div class="scope-row"><span class="scope-label">✅ 包含</span>${d.scopeIn.map(s=>`<span class="scope-in">${esc(s)}</span>`).join('')}</div>`;
        if(d.scopeOut?.length) b+=`<div class="scope-row" style="margin-top:6px"><span class="scope-label">❌ 不含</span>${d.scopeOut.map(s=>`<span class="scope-out">${esc(s)}</span>`).join('')}</div>`;
        b+=`</div>`; }
      h += sec("需求", b);
    }
    if(d.apis?.length) {
      const rows = d.apis.map(a=>{
        const mc=`m-${(a.method||'GET').toUpperCase()}`;
        let det='';
        if(a.request) det+=`<details><summary>Request</summary><pre class="json-block">${esc(a.request)}</pre></details>`;
        if(a.response) det+=`<details><summary>Response</summary><pre class="json-block">${esc(a.response)}</pre></details>`;
        return `<tr><td><span class="method ${mc}">${esc(a.method)}</span></td><td><code class="api-url">${esc(a.url)}</code></td><td>${esc(a.desc||'')}${det}</td></tr>`;
      }).join('');
      h += sec("接口文档",`<table class="api-table"><thead><tr><th style="width:72px">方法</th><th>路径</th><th>说明 / 报文</th></tr></thead><tbody>${rows}</tbody></table>`);
    }
    if(d.solution||d.coreDesign){ let b='';
      if(d.solution) b+=`<p class="sec-body" style="margin-bottom:${d.coreDesign?'12px':'0'}">${esc(d.solution)}</p>`;
      if(d.coreDesign) b+=`<p class="sec-body">${esc(d.coreDesign)}</p>`;
      h += sec("技术方案", b); }
    if(d.flowchart) h += sec("流程图",`<div class="mermaid-wrap" id="mmd-wrap"></div>`);
    if(d.keyImpl?.length) h += sec("关键实现",`<div class="keyimpl-list">${d.keyImpl.map(k=>`<div class="keyimpl-item"><div class="ki-title">${esc(k.title)}</div><div class="ki-desc">${esc(k.desc)}</div></div>`).join('')}</div>`);
    if(d.changeList?.length) h += sec("代码变更",`<table class="ctable"><thead><tr><th>文件路径</th><th style="width:72px">操作</th><th>说明</th></tr></thead><tbody>${d.changeList.map(c=>`<tr><td><code>${esc(c.file)}</code></td><td><span class="abadge a-${esc(c.action)}">${esc(c.action)}</span></td><td>${esc(c.desc)}</td></tr>`).join('')}</tbody></table>`);
    if(d.todos?.length) h += sec("实现 Todo",`<ul class="checklist">${d.todos.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`);
    h += '</div>';
    document.getElementById("main").innerHTML = h;
    if(d.flowchart){ const wrap=document.getElementById("mmd-wrap"); if(wrap){ const div=document.createElement('div'); div.className='mermaid'; div.textContent=d.flowchart; wrap.appendChild(div); if(typeof mermaid!=='undefined') mermaid.run({nodes:[div]}).catch(()=>{ wrap.innerHTML=`<pre class="flowchart-fallback">${esc(d.flowchart)}</pre>`; }); } }
  }
  function showLog() {
    sel=-1; renderSidebar();
    const items=[...htmlChangelog].reverse().map(e=>`<div class="tl-item"><div class="tl-left"><div class="tl-dot"></div><div class="tl-line"></div></div><div class="tl-right"><div class="tl-date">${esc(e.date)}</div><div class="tl-desc">${esc(e.desc)}</div></div></div>`).join('');
    document.getElementById("main").innerHTML=`<div class="doc-view"><h1 class="doc-h1">📋 HTML 变更日志</h1><p style="color:#8f959e;font-size:13px;margin:8px 0 28px">每次修改 project-html/index.html 时自动追加</p><div class="timeline">${items}</div></div>`;
  }
  function sec(t,b){ return `<div class="sec"><div class="sec-title">${t}</div>${b}</div>`; }
  function esc(s){ return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  const g=grp(); Object.keys(g).forEach(m=>exp.add(m)); renderSidebar();
  if(changes.length>0) pick(0);
</script>
</body>
</html>
```
