# 按需专项验证补强与对照记录

日期：2026-10-12（北京时间）。保留四个公开 Skill，仅在方案、check 和 repair 的相关验证缺口出现时加载三份短参考；loop 继续通过 check/repair 使用它们。

## 本轮改动

- [行为测试](../../skills/_shared/behavioral-testing.md)：独立契约期望、可区分错误的输入、既有间接覆盖、可选的隔离测试敏感性验证；不要求删除已有实现重走 TDD。
- [后端专项](../../skills/_shared/backend-verification.md)：按真实版本、术语和当前风险核对 SQL、事务、异步、幂等及权限；不把缺少运行证据自动认定为代码缺陷。
- [浏览器验收](../../skills/_shared/browser-verification.md)：关联同一操作的请求、页面和约定存储结果；保留离线草稿例外、只读审查边界和实际工具能力限制。
- 三个入口各增加条件链接；没有 always 资源或新公开入口。加载检查现在也对已声明的共享 Markdown 参考执行字符预算，并以超限样例及默认加载反例自测。
- 新增 9 个评估场景、2 个可执行宿主契约，以及 [受控样例](../../scripts/fixtures/verification-evidence/README.md)。样例中的价格实现故意错误，原有 4 个测试故意全部通过，不能在常规清理中“修好”。

## 来源与适配

- [mattpocock/skills](https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/tdd/SKILL.md)
- [addyosmani/agent-skills](https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/browser-testing-with-devtools/SKILL.md)
- [wshobson/agents](https://raw.githubusercontent.com/wshobson/agents/main/plugins/jvm-languages/agents/java-pro.md)

以上为本次读取的 main 分支资料，公开 API 固定提交查询返回 403，未声称锁定上游版本。参考思想按本项目边界重新编写；不复制第三方脚本，不增加运行依赖，不引入固定模型、强制 TDD、重复审批或自动升级技术栈。

## 静态加载代价

| 入口 | 修改前字符 | 修改后字符 | 默认加载资源数 |
|---|---:|---:|---:|
| skills/yan-dev-doc/SKILL.md | 2448 | 2669 | 1 → 1 |
| skills/yan-code-review/modes/check/mode.md | 1631 | 1858 | 1 → 1 |
| skills/yan-code-review/modes/repair/mode.md | 1704 | 1936 | 1 → 1 |

三份参考分别为 699、793、724 字符，合计 2216 字符，仅命中相关条件才加载。字符数为静态预算，不等同模型 token 数；入口的路由文字确有增加。

## 验证结果

- `node scripts/check-all.js` 最终全部通过：35 个脚本、4 个公开 Skill、11 套 eval、214 个场景定义、36 个静态契约。首轮发现新 fixture 的两个 JS 文件缺少仓库规定的 shebang，补齐后重跑全量通过。214 个定义不代表 214 次模型执行。
- `node scripts/check-route-loading.js --self-test` 通过；共享参考超限会被拒绝，conditional 不计入默认加载。
- 真实宿主固定为 `codex-cli 0.162.0-alpha.17.2`，显式指定 `gpt-6-astra`、`high`、`explicit`；两组使用相同 fixture revision、prompt、contract、grader。基线为本轮修改前的工作树 Skill 快照，包含用户此前未提交改动，不使用 Git HEAD 代替。

| 场景 | 自动检查 | 协调 Agent 语义复核 | 耗时 | 加载回执 |
|---|---|---|---:|---:|
| 综合审查 / 修改前 | 通过 | 通过 | 102.3 秒 | 2 份 |
| 综合审查 / 修改后 | 通过 | 通过 | 109.6 秒 | 5 份 |
| 文档路径 / 修改后负向对照 | 通过 | 通过 | 44.7 秒 | 2 份 |

前后两组均识别三项问题：折扣契约与实现不符、测试期望随错误实现漂移、异步受理后提前显示已保存。两组也都正确承认 Service 参数测试的局部价值、未把 SQL 未执行当作租户条件缺失、未要求离线草稿保存到服务端。新版综合任务按需读三份参考，负向对照仍只读根入口与 check mode。加载回执为模型自报，并非独立工具轨迹审计。

`node scripts/compare-host-evals.js <before-review.json> <after-review.json>` 返回 `comparable: true`。本次新版比基线多 7.327 秒、输出多 192 字符；单次样例受服务和随机性影响，不能证明准确率或速度提高。保留的是可复用的专项判断方法、加载边界和回归样例，不将其包装成已测得的性能增益。

三次宿主运行均退出 0，HEAD、索引、受保护元数据和文件哈希未漂移，源 fixture 保持 clean。这是最终状态核验，不证明不存在瞬态或外部副作用。浏览器数据是合成观察，Java 只有代码，无数据库连接；本轮未实际验证真实页面操作、Java 编译或数据库集成。文本断言只是信号，本轮另核对完整输出；此场景没有独立业务 outcome verifier。

## 本机安装与既有工作

`install-local.cmd --dry-run agents`、`install-local.cmd agents` 和 `install-local.cmd status agents` 均成功，状态 CURRENT。按入口 SKILL.md 去 BOM 约定逐字节核对 66/66 个安装文件一致。原有 host contracts 完整保留，本轮范围外的所有基线文件哈希未变；没有提交或推送用户仓库。

完整脱敏模型输出、条件指纹和检查结果见 [结果记录](2026-10-12-specialist-results.json)。仓库外原始证据与旧 Skill 快照位于 `C:/Users/22518/AppData/Local/Temp/workflow-specialist-NSnb2a`，不作为长期发布路径；持久记录排除了宿主诊断和用户配置。

## 复现

把 `scripts/fixtures/verification-evidence` 复制到仓库外临时目录并建立独立 Git 基线，再运行：

~~~text
node scripts/run-host-evals.js --live --host codex --case review-verification-evidence --workspace <fixture> --model gpt-6-astra --effort high --timeout-ms 240000 --output <after.json>
node scripts/run-host-evals.js --live --host codex --case review-verification-evidence --workspace <同一fixture> --skill-source <修改前完整skills快照> --model gpt-6-astra --effort high --timeout-ms 240000 --output <before.json>
node scripts/compare-host-evals.js <before.json> <after.json>
node scripts/run-host-evals.js --live --host codex --case review-no-specialist-loading --workspace <同一fixture> --model gpt-6-astra --effort high --timeout-ms 180000 --output <negative.json>
~~~
