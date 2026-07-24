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
- 校验器因工作区外访问策略无法启动：执行 [工作区内静态校验降级](reference.md#工作区内-openapi-静态校验降级)，记录 `OPENAPI_VALIDATION_MODE=light:workspace-inline`。
- 校验器已启动并报告 `FAIL:`、解析错误、缺失/重复 `operationId` 或未解析 `$ref`：修正产物后重跑，不得降级规避失败。

任何模式都必须检查 OpenAPI 3.x、HTTP operation、`operationId` 非空/唯一和本地 `$ref`，也都不能证明 Apifox 实际导入成功。

## 完成条件

- YAML、索引和源 md 互相可追溯；
- 只包含真正新增/契约变更接口；
- 校验器成功，失败没有被伪装成环境限制；
- 后续接口变更明确要求更新同一个 YAML。
