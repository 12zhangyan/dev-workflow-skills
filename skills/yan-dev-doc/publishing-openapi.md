# OpenAPI / Apifox 条件发布

只在新增接口，或请求、响应、鉴权、状态码、错误语义发生契约变化时执行。纯内部行为变化和仅调用既有接口不生成规范。

## 产物与边界

- 写入 `docs/apifox/<日期>/<任务名>.openapi.yaml`，并以源 md 与 YAML 路径幂等更新 `docs/apifox/INDEX.md`。
- 规范只包含本次新增或契约变化的接口；未知字段标为待确认，不伪造契约。
- 若同时发布看板，才写 `apiSpecPath`、`apiIndexPath` 和非空 `apis[]`；否则不触碰看板。

## 验证

用 [workflow-fs.js](../_shared/scripts/workflow-fs.js) 创建目录、检查冲突并定位本 Skill 的 `scripts/validate-openapi.js`：

```text
node <helper> resolve-skill-file yan-dev-doc scripts/validate-openapi.js
node <validator> <apiSpecPath>
node <helper> contains docs/apifox/INDEX.md <apiSpecPath>
node <helper> contains docs/apifox/INDEX.md <mdPath>
```

校验至少覆盖 OpenAPI 3.x、HTTP operation、`operationId` 非空/唯一和本地 `$ref`。含 `$ref` 的 YAML 在没有可用解析器时返回 `OPENAPI_VALIDATION_UNAVAILABLE`，不得当作通过；可使用已有 `yaml/js-yaml`，或以 JSON 语法写同一 `.openapi.yaml` 并用内置解析器校验，不自动新增依赖。校验器能启动但报告内容错误时必须修复，不能降级绕过。若仅因沙箱禁止执行工作区外脚本，可在工作区内做等价静态检查并记录 `OPENAPI_VALIDATION_MODE=light:workspace-inline`。任何静态校验都不能证明 Apifox 实际导入成功。

完成时报告实际 YAML、索引、源 md、校验模式和未确认字段；不自动 add、commit、push，也不声称已经完成真实导入。
