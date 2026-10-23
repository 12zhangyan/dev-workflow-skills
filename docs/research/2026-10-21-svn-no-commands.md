# 2026-10-21：SVN 工作副本零命令

> 已被取代：2026-10-22 起 SVN 工作副本允许本地只读命令，见 [SVN 本地只读](2026-10-22-svn-local-readonly.md)（#35）。本文保留为当时的裁决与 live 观察记录；其中 `detect-vcs` 识别内嵌 SVN 的结论仍然有效。

用户规则：只有 Git 管理的项目才收集 VCS 证据；SVN 管理的项目不执行任何 `svn` 命令。这是用户裁决的边界，不是从失败中推导出来的规则；以下证据只覆盖“识别 owner”这一步。

## 改动

- `workflow-gates.md` 的“VCS 归属与纳管”是唯一完整定义：owner 只用 `detect-vcs` 这类目录存在性检查判断；SVN owner 不执行任何 `svn` 命令或 SVN 客户端操作；改动范围以用户提供的文件清单、patch 和本轮实际修改为准；纳管、未提交和基线状态报告为“SVN 未检查”，不写 clean、不标 `VCSGateBlocked`、不宣称可提交。
- check、repair、loop、dev-doc、handoff、看板外壳升级、incident 记录和 host-capabilities 的 VCS 相关句子都写明了 SVN 零命令；看板外壳升级在 SVN 下按状态未知照常升级，依赖 `sync` 的备份保留旧文件。
- 新增 eval：check 40、repair 32、loop 42、yan-dev-doc 81；边界检查守护上述措辞，变异测试确认删掉 check mode 的规则会失败。

## live 观察（Claude Code 2.1.306，claude-sonnet-5-5，stream-json 手工诊断）

fixture：外层 Git 仓库，`.gitignore` 忽略 `legacy/`；`legacy/` 内放空的 `.svn` 目录模拟内嵌 SVN 工作副本，再放入 report-ownership 的源码和测试。准备 fixture 和运行时都没有执行 svn 命令。

| 版本 | 执行 svn 命令 | 识别出 SVN owner | 状态报告 |
|---|---:|---:|---|
| 只加零命令规则 | 0/2 | 0/2 | 用外层 `git status`/`check-ignore` 判断“被 git 忽略”，建议改 `.gitignore` 或 `git add -f` |
| 加 `detect-vcs <目录>` 具体步骤 | 0/3 | 3/3 | “SVN 未检查”，请用户提交前核对 |

- 第一行是一次真实失败：规则只写了“找到最近的 Git/SVN owner”，没写怎么找，模型看到根目录有 `.git` 就按 Git 处理。按准入标准改成具体步骤：对文件所在目录运行 `detect-vcs`，并写明“仓库根有 `.git` 不代表内层目录归 Git”。
- 改后 3 次仍会额外运行只读 `git status`，并把结果作为背景写进报告，但不拿它当结论。由于这些命令只读，没有进一步收紧。
- 样本很小（2 次对 3 次），runner 也无法托管这个 fixture，因为被忽略的 `legacy/` 不会进入克隆。真实 SVN 项目需要网络或认证的情况没有覆盖。
