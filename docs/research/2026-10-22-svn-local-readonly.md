# 2026-10-22：SVN 工作副本改为允许本地只读命令

用户裁决：项目里既有 Git 也有 SVN，SVN 工作副本放宽为可以运行本地只读命令，联网和写入命令仍然禁止。这一条替代 [2026-10-21 的零命令规则](2026-10-21-svn-no-commands.md)。它是用户裁决的边界，不是从失败中推导出来的规则；下面的证据只用来确认"本地命令不连服务器"这一前提。

## 规则

`skills/_shared/workflow-gates.md` 的"VCS 归属与纳管"是唯一完整定义：

- 判断归属不变：仍只用 `detect-vcs` 检查目录是否存在，外层 `.git` 不代表内层 SVN 归 Git。
- 允许：`svn status`、`svn diff`（可加 `--summarize`）、`svn info`，均加 `--non-interactive`，以及 `svnversion`。
- 禁止联网命令：`log`、`blame`、`update`、`status -u`、带 `-r`/`-c` 的 `diff`、远端 URL。
- 禁止写入命令：`add`、`commit`、`revert`、`cleanup`、`upgrade`、`resolve`、`delete`、`move`、`propset`、`lock`。
- 命令成功时与 Git 同口径：按 status/diff 确定改动与纳管，`?` 的应纳管文件标 `VCSGateBlocked`；基线写 `svnversion` 的原样结果。
- 命令不存在、报错或要求认证时，降级为原先的口径：以用户提供的文件清单或 patch 和本轮实际修改为准，报告"SVN 未检查"。

check、repair、loop、dev-doc、handoff、incident 记录、看板外壳升级和 host-capabilities 各自在使用处保留一句具体步骤。这是沿用 10-21 的 live 观察：规则只写在共享文档里时，模型到具体模式里仍按 Git 处理。

## 离线验证（svn 1.13.0，Windows）

用 `svnadmin create` 建本地仓库，`file:///` 检出后提交一个文件，再修改它并新增一个未纳管文件，然后把仓库目录改名，模拟服务器不可达：

| 命令 | 服务器不可达时 |
|---|---|
| `svn status` | 成功：`M A.java`、`? NewTest.java` |
| `svn diff` | 成功：输出与 BASE 的差异 |
| `svn diff --summarize` | 成功：`M A.java` |
| `svn info --show-item revision` | 成功，但返回 `0`：提交后未 update，工作副本根目录仍是旧修订 |
| `svnversion` | 成功：`0:1M`，准确表达混合修订加本地修改；update 后为 `1M` |
| `svn log -l 1` | 失败：`E170013 Unable to connect` |
| `svn status -u` | 失败：`E170013 Unable to connect` |

结论：允许的命令只读工作副本内的原始副本，不需要服务器；被禁止的两类命令确实需要服务器。基线因此用 `svnversion` 而不是 `svn info` 的单一修订号。

未覆盖：没有在真实的 http/svn 协议服务器、需要认证的仓库，或旧格式工作副本上验证；也没有做 live 模型评测，所以不声称模型行为有改善。

## 评测与检查

- 改写 check 40、repair 32、loop 42、yan-dev-doc 40 与 81 的期望输出，与新规则一致。上一轮审核发现的 9 条"要求跑 svn status/diff 或标 `VCSGateBlocked`"的旧评测，在新规则下已经一致，不需要改写。
- `check-review-boundaries.js` 新增扫描：skill 正文和评测期望中，联网或写入类 svn 命令只能出现在禁止语境里。它对旧内容能检出 yan-dev-doc 40 的"按需查询 svn log"。
