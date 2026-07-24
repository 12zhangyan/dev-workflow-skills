# OpenAPI / Apifox 发布流程

仅在 `yan-dev-doc` 已确认存在新增接口或契约变更时读取。纯行为变更、仅调用既有接口和 `Compact` 不读取、不执行。

## 产物

- `docs/apifox/<日期>/<任务名>.openapi.yaml`
- `docs/apifox/INDEX.md`
- yan-dev-doc 的「Apifox 接口规范」索引段

## 执行

1. 运行 `node <helper> prepare-date-dir docs/apifox`。
2. 让 `apiSpecPath` 与最终 `mdPath` 使用相同文件名后缀。
3. 创建或更新 OpenAPI 3.0 YAML。只包含新增或契约变更接口；行为变更接口不得混入。
4. 更新 `docs/apifox/INDEX.md`，以 `源 md + OpenAPI 文件` 去重，不重复追加。
5. md 只写文件位置、导入方式、接口索引和维护规则，不内嵌完整 YAML。
6. 若同时发布看板，entry 写 `apiSpecPath`、`apiIndexPath:"docs/apifox/INDEX.md"`；`apis[]` 至少一条。

未确认字段只用 `# 待补充` 注释或文档待确认清单，不创建伪契约字段。

## 确定性校验

先定位并运行校验器：

```text
node <helper> resolve-skill-file yan-dev-doc scripts/validate-openapi.js
node <校验器绝对路径> <apiSpecPath>
node <helper> file-state docs/apifox/INDEX.md
node <helper> contains docs/apifox/INDEX.md <apiSpecPath>
node <helper> contains docs/apifox/INDEX.md <mdPath>
```

索引检查必须得到 `EXISTS_READABLE`、`YES`、`YES`。

按校验结果分流：

- `OPENAPI_VALIDATION_MODE=full:<parser>`：完整解析通过，仍写明“Apifox 实际导入未验证”。
- `OPENAPI_VALIDATION_MODE=light:no-yaml-parser`：静态结构通过，仍写明实际导入未验证。
- 校验器因工作区外访问策略无法启动：执行本文的 [工作区内静态校验降级](#工作区内-openapi-静态校验降级)，记录 `OPENAPI_VALIDATION_MODE=light:workspace-inline`。
- 校验器已启动并报告 `FAIL:`、解析错误、缺失/重复 `operationId` 或未解析 `$ref`：修正产物后重跑，不得降级规避失败。

任何模式都必须检查 OpenAPI 3.x、HTTP operation、`operationId` 非空/唯一和本地 `$ref`，也都不能证明 Apifox 实际导入成功。

## 完成条件

- YAML、索引和源 md 互相可追溯；
- 只包含真正新增/契约变更接口；
- 校验器成功，失败没有被伪装成环境限制；
- 后续接口变更明确要求更新同一个 YAML。

---

## Apifox OpenAPI 文件模板

> 文件路径：`docs/apifox/<YYYY-MM-DD>/<任务名>.openapi.yaml`
> 仅当新增接口、或修改既有接口的参数/返回结构时生成。后续接口变更优先更新同一个文件。

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
                # 待补充：未确认字段只保留注释或写入文档待确认清单；确认前不要加入 properties 形成伪契约
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
> - 未确认字段只保留 `# 待补充` 注释或写入文档待确认清单；确认前不加入 `paths` / `components` 的实际契约节点
> - 完整解析、无 YAML parser 静态校验和工作区内静态降级必须分别记录 `OPENAPI_VALIDATION_MODE`；只有 `full:<parser>` 或 Apifox 实际导入成功才能升级结论

---

## 工作区内 OpenAPI 静态校验降级

仅在宿主明确禁止启动工作区外 `validate-openapi.js`，或该脚本确实不可访问时使用。把下面脚本通过当前宿主的 Node `-e` / stdin 方式执行，并把工作区内的 `apiSpecPath` 作为唯一参数；脚本不依赖 `yaml` / `js-yaml`，不读取用户目录，也不落临时文件。若完整校验器已经输出 `FAIL:` 或具体 YAML 内容错误，禁止使用本降级脚本覆盖失败结论。

<!-- OPENAPI_WORKSPACE_FALLBACK_START -->
```javascript
const fs = require("fs");
try {
const file = process.argv[1];
const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const fail = (message) => { throw new Error(message); };
const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
if (!/^openapi:\s*["']?3\./m.test(raw)) fail("missing OpenAPI 3.x declaration");
const lines = raw.split(/\r?\n/);
const indentOf = (line) => (line.match(/^\s*/) || [""])[0].length;
const pathsAt = lines.findIndex((line) => /^\s*paths:\s*$/.test(line));
if (pathsAt < 0) fail("missing paths mapping");
const pathsIndent = indentOf(lines[pathsAt]);
let currentPath = null;
let currentPathIndent = -1;
const operationIds = [];
for (let i = pathsAt + 1; i < lines.length; i += 1) {
  const line = lines[i];
  if (!line.trim() || line.trimStart().startsWith("#")) continue;
  const indent = indentOf(line);
  if (indent <= pathsIndent) break;
  const pathMatch = line.match(/^\s*(\/[^:]*):\s*$/);
  if (pathMatch) {
    currentPath = pathMatch[1];
    currentPathIndent = indent;
    continue;
  }
  const keyMatch = line.match(/^\s*([A-Za-z]+):\s*$/);
  if (!currentPath || !keyMatch || indent <= currentPathIndent || !methods.has(keyMatch[1].toLowerCase())) continue;
  let operationId = "";
  for (let j = i + 1; j < lines.length; j += 1) {
    const child = lines[j];
    if (!child.trim() || child.trimStart().startsWith("#")) continue;
    if (indentOf(child) <= indent) break;
    const idMatch = child.match(/^\s*operationId:\s*["']?([^\s"'#]+)["']?\s*$/);
    if (idMatch) operationId = idMatch[1];
  }
  if (!operationId) fail(`${keyMatch[1].toUpperCase()} ${currentPath} missing operationId`);
  operationIds.push(operationId);
}
if (operationIds.length === 0) fail("paths contains no HTTP operations");
const duplicates = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);
if (duplicates.length) fail(`duplicate operationId: ${[...new Set(duplicates)].join(",")}`);
const schemasAt = lines.findIndex((line) => /^\s*schemas:\s*$/.test(line));
const schemaNames = new Set();
if (schemasAt >= 0) {
  const baseIndent = indentOf(lines[schemasAt]);
  let itemIndent = null;
  for (let i = schemasAt + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = indentOf(line);
    if (indent <= baseIndent) break;
    if (itemIndent === null) itemIndent = indent;
    const match = indent === itemIndent && line.match(/^\s*([^:#]+):\s*$/);
    if (match) schemaNames.add(match[1].trim());
  }
}
for (const match of raw.matchAll(/\$ref:\s*["']?(#\/components\/schemas\/([^\s"']+))["']?/g)) {
  if (!schemaNames.has(match[2])) fail(`unresolved local $ref: ${match[1]}`);
}
console.log("OPENAPI_VALIDATION_MODE=light:workspace-inline");
console.log(`ok OpenAPI static validation passed; operationIds=${operationIds.join(",")}`);
console.log("note: YAML parser and actual Apifox import were not verified");
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
```
<!-- OPENAPI_WORKSPACE_FALLBACK_END -->

执行失败时输出 `FAIL: <原因>` 并修正 YAML；成功时保留脚本输出的 `OPENAPI_VALIDATION_MODE=light:workspace-inline` 作为验证证据，并明确写“Apifox 实际导入未验证”。该模式只证明 OpenAPI 3.x 声明、HTTP operation、`operationId` 非空/唯一和常见本地 schema `$ref` 的静态结构，不证明 YAML 完整语法或 Apifox 实际导入。

---

## Apifox 索引模板

> 文件路径：`docs/apifox/INDEX.md`
> 每次生成或更新 OpenAPI YAML 时同步更新本索引，方便导入 Apifox 和后续维护。按“源文档 + OpenAPI 文件”去重，命中既有行就更新，不重复追加。

```markdown
# Apifox / OpenAPI 索引

| 日期 | 服务/模块 | 任务 | OpenAPI 文件 | 源文档 | 接口 | 维护备注 |
|------|-----------|------|--------------|--------|------|----------|
| <YYYY-MM-DD> | <服务>/<模块> | <任务名> | `docs/apifox/<YYYY-MM-DD>/<任务名>.openapi.yaml` | `docs/<YYYY-MM-DD>/<任务名>.md` | `POST /api/v1/xxx` | 后续接口变更更新同一 YAML 文件 |
```

---
