# 2026-10-13 技能表达与审查边界优化

已完成源码修改、全量检查、两组 Codex 配对评估及共享目录安装。当前证据支持精简发现描述、消除入口提示冲突，并保留样例行为；不支持宣称检出率或执行速度提升。

## 取舍与来源

参考 mattpocock/skills 的 writing-for-agents、tdd 和 code-review（2026-10-13 读取）：

- https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md
- https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md
- https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md

吸收按分支加载、行为完成标准、稳定观察边界和需求/实现分别取证的方法。保留本项目的自主决策、Git/SVN、只读数据库、显式提交授权与证据边界；没有导入上游 Skill、增加外部技能依赖或设立默认 TDD/双 reviewer 流程。

## 实际变化

- 四个公开 description 保留意图、排除条件和必要旧名称；详细模式由入口正文负责。开发方案合并重复完成标准，保留授权、未决项、真实依赖、可观察验收及条件产物规则。
- check 区分需求符合性与实现风险。缺少独立需求来源时继续有依据的实现审查，同时保留需求覆盖缺口；工作区审查明确包含暂存、未暂存和未跟踪文件。package 采用相同视角，但不固定角色数。
- 行为测试参考补充稳定调用边界、已有覆盖复用和最小完整路径反馈；普通测试选择由 Agent 决定，验收或权限变化仍需裁决。
- openai.yaml 回到调用入口的职责：消除审查必报模式及项目分析只能选一个模式的冲突。保留 allow_implicit_invocation。
- 清单检查停止要求 UI 提示重复模式与跨 Skill 规则；保留发现边界检查，并用正反例检查上述元数据冲突。AGENTS/CLAUDE 同步单一规则来源和完整加载路径的维护原则。
- 增加 4 个 eval 场景和一个隔离 Java fixture，覆盖通知副作用契约、工作区范围、缺少需求来源和自主选择已有测试边界。只有通知契约场景进行了本轮新增 live 运行，其余新增场景是可解析的评估定义。

## 静态尺寸

口径：UTF-8 解码后的字符数，去除开头 BOM、换行规范为 LF；不是 token 数。

| 指标 | 修改前 | 修改后 |
|---|---:|---:|
| 四个公开 description 合计 | 762 | 391 |
| 四个公开入口全文合计 | 8164 | 7579 |
| 开发方案入口全文 | 2669 | 2381 |
| 四个 openai.yaml 全文合计 | 2684 | 1616 |
| review 根入口 + check mode | 3530 | 3561 |
| 按需行为测试参考 | 830 | 1043 |

审查路径为补充需求及工作区边界增加了 31 字符，不能只用根入口变短宣称整条路径更轻。没有新增直接 Markdown 依赖，原 route-loading allowlist 和加载条件仍适用。

## 验证

- `node scripts/check-all.js`：退出码 0。涵盖脚本、看板、文档、元数据、路由、边界、评估器和隔离安装事务检查。37 个跨宿主契约属于离线检查；220 个 eval 场景通过存在性/结构检查，并非运行了 220 次模型评估。
- `node scripts/check-route-loading.js --report`：通过，11 条入口/模式路径、36 个预算资源。
- live 固定 Codex CLI 0.162.0-alpha.17.2、gpt-6-astra、high，使用同一个各场景 fixture Git HEAD、prompt、contract 和 grader；旧新运行分别挂载保存的技能快照。
- `node scripts/compare-host-evals.js <before.json> <after.json>`：下表两组 comparable 均为 true。

| 配对场景 | 调用方式 | 修改前/后 | 语义复核 |
|---|---|---|---|
| natural-review-selection | native | Passed / Passed | 均有实际读取隔离 .agents/skills 入口的命令证据；发现 limit - 1 少返回一行；未误报输入校验与输入不变规则 |
| review-requirement-evidence | explicit | Passed / Passed | 均发现不足时仍通知的违约；承认可见输入/构造校验，不扩展到数据库或租户等非目标；回执均加载 2 个资源 |

四次配对运行的最终文件、HEAD、index 和被检查 Git 元数据均无漂移；这不证明不存在瞬时或外部副作用。评估主体只读分析 Java 样例，没有执行 Java 编译或运行时测试。评分器的文本信号另经本轮语义复核，不是通用正确性证明。

原生选择场景耗时 69.643s → 125.947s，需求场景 80.095s → 108.581s；后者输出也更长，前者宿主记录了断流/服务繁忙重试。仅两个样例且宿主服务存在波动，不能推导速度、token 节省或准确率改善。自然选择场景未要求 LOADED_RESOURCES 回执，其资源数 0 不能解释为未加载文件。

额外保留两次 catalog 烟测（都通过），但 description 被写入 catalog prompt，导致提示词指纹不同；比较器正确拒绝其作为严格配对。首次需求评估虽然正确发现缺陷，却因 README 简称被严格扩展名匹配误判；保留原失败后修正评分器，重新运行旧新两版，同一评分规则下均通过。

结果与模型输出摘要：[skill-optimization-results.json](2026-10-13-skill-optimization-results.json)。原始输出及前后完整快照保留于本机临时证据目录 C:/Users/22518/AppData/Local/Temp/yan-skill-opt-20261013-ZKPGnu，临时目录不是长期依赖。

## 安装与边界

执行 install-local.cmd --dry-run agents、install-local.cmd agents，再执行 install-local.cmd status，结果为 agents CURRENT。仅更新本项目管理的共享目录 C:/Users/22518/.agents/skills；四个已安装入口经 Python UTF-8 模式的 quick_validate.py 校验通过。系统默认 GBK 解码不适合这些 UTF-8 文件，本轮通过 python -X utf8 运行校验，没有修改 Python 配置。

尚未运行 Claude/Cursor live 评估，也没有覆盖所有业务类型或所有分析/修复模式。未改业务项目、未做数据库操作、未提交或推送本仓库。当前会话若缓存技能目录，可在新会话验证发现更新。
