---
name: review-check
description: 根据 review-fix 生成的 Review 任务包、dev-doc、patch/diff 或当前工作区变更执行一次只读代码审查，按统一清单输出结构化 findings。当用户说"使用 review-check skill"、Claude Code 输入 /review-check，或要求"按审查清单 review/执行 review/输出 findings 给 review-fix 汇总"时使用；不得修改代码或生成修复交接文档
argument-hint: [review-task路径 | dev-doc路径 | diff/patch路径 | 功能描述]
arguments: entry
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion
shell: bash
model: sonnet
effort: high
---

# 代码审查执行

## 任务定位

执行一次**只读 code review**。它回答的是："这批改动有没有会导致缺陷、回归、安全风险或维护风险的问题？"

与相邻 skill 的分工：
- `/review-fix`：生成 Review 任务包，回收多方 findings，并产出修复交接。
- `/review-check`：拿任务包或 diff 执行一次审查，只输出 findings，不修代码。
- `/code-reading`：生成代码地图，只梳理结构，不判断问题。

## 执行流程

### 共享交互协议

先遵循 [../_shared/interaction-policy.md](../_shared/interaction-policy.md)：只基于已读取材料下结论；材料不足时输出"材料不足，无法下结论"，不要伪装成未发现问题；需求/实现/状态/权限/数据归属冲突要作为重点审查项。

同时遵循 [../_shared/workflow-gates.md](../_shared/workflow-gates.md)：本 skill 只执行 Review Gate 的只读审查；输出必须包含 VerificationStatus，说明已看到或未看到哪些验证命令/结果，材料不足时不能给通过结论。

### Step 0：入口识别

`$entry` 为空时询问：

> "这次要审查什么？请给 Review 任务包路径、dev-doc 路径、patch/diff 路径，或一句功能描述。"

入口模式：
- 路径包含 `review-task.md` 或文档标题含 `Review 任务包` → **任务包模式**
- 含 `.patch` / `.diff` 或文件名含 `changes.patch` → **patch 模式**
- 含 `.md` 且路径在 `docs/` 下 → **文档模式**
- 其他自然语言 → **上下文模式**

告知用户："检测到入口模式：[模式名]，开始只读审查。"

### Step 1：收集审查材料

静默执行，只用于审查，不完整展示给用户：

```bash
vcs_root="$PWD"
vcs_type="none"
while [ "$vcs_root" != "/" ]; do
  if [ -e "$vcs_root/.git" ]; then vcs_type="git"; break; fi
  if [ -d "$vcs_root/.svn" ]; then vcs_type="svn"; break; fi
  parent=$(dirname "$vcs_root")
  [ "$parent" = "$vcs_root" ] && break
  vcs_root="$parent"
done
case "$vcs_type" in
  git)
    echo "VCS_TYPE=git"
    git -c "safe.directory=$vcs_root" -C "$vcs_root" branch --show-current 2>/dev/null
    git -c "safe.directory=$vcs_root" -C "$vcs_root" status --short 2>/dev/null
    git -c "safe.directory=$vcs_root" -C "$vcs_root" diff --name-status 2>/dev/null
    git -c "safe.directory=$vcs_root" -C "$vcs_root" diff --stat 2>/dev/null
    ;;
  svn)
    echo "VCS_TYPE=svn"
    svn info "$vcs_root" 2>/dev/null | grep -E "^(Relative URL|Revision):"
    svn status "$vcs_root" 2>/dev/null
    svn diff --summarize "$vcs_root" 2>/dev/null
    ;;
  *) echo "VCS_TYPE=none" ;;
esac
find "$vcs_root" -maxdepth 3 \( -name pom.xml -o -name build.gradle -o -name package.json \) 2>/dev/null
```

判断规则：先按目录结构识别 Git/SVN，不要用"git 命令失败"推断为 SVN 或无 VCS。Git 出现 dubious ownership / safe.directory 报错时，只使用 `git -c "safe.directory=$vcs_root"` 做本次只读命令，不修改全局 git 配置。Git 项目必须同时看 `status --short` 和 `diff`；SVN 项目必须同时看 `svn status` 和 `svn diff --summarize`，避免漏掉未纳入版本控制的新增源码或测试文件。

按模式读取：
- 任务包模式：Read `$entry`，提取审查目标、证据包路径、关键源码、测试命令和回收格式。
- patch 模式：Read patch/diff，提取文件列表、关键 hunk、接口/状态/事务相关改动；若存在 `??` 新增文件，按路径优先级主动读取关键新增文件。
- 文档模式：Read dev-doc，提取目标、范围、代码变更清单、测试关注点；必要时读取同日期的 `docs/code-reading/`。
- 上下文模式：用 Grep/Glob 查找候选入口；不确定时询问用户补充 dev-doc、patch 或入口类。

优先读取：
1. 任务包或 dev-doc 明确点名的关键文件。
2. 后端：Controller/Service/Mapper/Repository/DTO/枚举/配置类、SQL/XML/YAML。
3. 前端：路由、请求封装、状态管理、鉴权守卫、核心 Vue 页面、SSE/iframe/富文本渲染。
4. AI 生成/文件工具：读写/列表工具、路径解析器、沙箱根目录、生成产物部署逻辑。
5. 配置与部署：环境变量模板、Docker、CORS、JWT/Redis/LLM profile、CI 命令。

### Step 2：按清单审查

加载清单：[reference.md](reference.md#审查清单)

审查顺序：
1. **需求一致性**：实现是否符合 dev-doc / Review 任务包目标。
2. **需求冲突与业务正确性**：用户口径、dev-doc、现有状态机、字典、权限、数据归属、接口先后依赖是否冲突；主流程、状态流转、金额/数量/权限/库存等关键规则是否正确。
3. **边界与异常**：null、空集合、非法枚举、重复提交、异常分支。
4. **事务与并发**：回滚边界、跨服务调用、幂等、锁、分页状态。
5. **安全与敏感信息**：越权、敏感日志、注入、明文凭证。
6. **前端交互**：路由守卫、token 刷新、SSE 错误事件、XSS/iframe、loading 状态。
7. **AI 文件沙箱**：路径穿越、覆盖写、读取截断、生成/修改模式误判、部署回滚。
8. **性能与兼容**：N+1、循环远程调用、接口签名/响应结构变更、OpenAPI 生成兼容。
9. **测试与验证**：测试是否覆盖正常、异常、边界、回归；新增/修改的测试文件是否已纳入 VCS。
10. **提交完整性**：关键源码、测试、配置、SQL/XML、前端资源等是否存在"本地有文件但未被 Git/SVN 跟踪"的问题；这类问题即使本地测试通过，也会导致提交后缺文件。

### Step 3：判定 finding

只输出满足以下条件的问题：
- 能定位到文件、方法、接口、配置或数据路径。
- 有来自 diff/源码/文档的证据。
- 能说明影响。
- 有可执行修复建议。
- 有验证方式。

分级：
- `Critical`：可能造成数据错误、核心流程不可用、安全漏洞、生产事故。
- `Important`：高概率缺陷、重要回归、边界/异常会失败，修完再继续。
- `Minor`：维护性、局部测试增强、命名/重复逻辑等不阻塞问题。
- `Notes`：不确定观察或非阻塞建议，不进入 findings。

结论状态（三选一）：
- `Findings`：发现有证据的问题。
- `NoEvidenceIssue`：材料足够，未发现有证据的阻塞问题。
- `InsufficientMaterial`：关键材料不足，无法对目标范围下结论。必须列缺失材料和受影响结论范围，不得写"未发现问题"。

### Step 4：输出结构化结果

按模板输出：[reference.md](reference.md#输出格式)

要求：
- findings 按 `Critical / Important / Minor` 分组。
- 固定输出 `VerificationStatus`：已运行/未运行/未提供；命令、结果或未运行原因。
- 每条包含 `File/Line`、`Problem`、`Evidence`、`Impact`、`Fix`、`Verify`。
- 没有明确问题时，先判断材料是否足够：足够才输出"未发现有证据的阻塞问题"并列出已检查范围；不足则输出"材料不足，无法下结论"。
- 不输出大段源码，不复述全部 diff。

### Step 5：结束提醒

结尾输出：

```text
可将以上 findings 原样贴回 /review-fix，用于生成修复交接文档。
```

## 禁止事项

- 不修改代码，不写文件，不运行修复命令。
- 不执行数据库写操作或 DDL；涉及数据库只允许只读分析。
- 不把风格偏好包装成严重问题。
- 不因为"可能"就输出 finding；证据不足放入 Notes。
- 不在材料不足时宣称通过或未发现问题。
- 不要求重构无关模块，不回滚用户已有改动。

## 检查清单

- [ ] 已识别入口模式
- [ ] 已读取任务包 / dev-doc / patch / 关键源码
- [ ] 已按审查清单覆盖正确性、边界、事务、并发、安全、前端/SSE、AI 文件沙箱、性能、兼容、测试与提交完整性
- [ ] 每条 finding 都有证据、影响、修复建议、验证方式
- [ ] 已在 Findings / NoEvidenceIssue / InsufficientMaterial 三种结论中选择一种，并写明依据
- [ ] 未修改任何代码或文档
- [ ] 输出可直接贴回 `/review-fix`

## 相关资源

- 审查清单与输出模板：[reference.md](reference.md)
- 示例：[examples.md](examples.md)
- 组织多 AI review 与修复交接：`/review-fix`
- Review 前代码地图：`/code-reading`

