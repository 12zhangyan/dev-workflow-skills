# skill 集合在 TypeMe 的两轮实用迭代（2026-10-12）

## 完成结果

已完成：核对源版本 → 安装当前 skill 集合 → TypeMe 第一轮优化 → 按 skill-creator 修正专项参考 → 检查并重新安装 → 使用安装后的参考完成 TypeMe 第二轮优化 → 最终检查及独立隔离夹具复测。

远端 main 实时读取为 063a09a7e6f86b21d52d1fa6cf4c2ea9ce7c0d6d，本地 b0babc9a8260dae1921f1b835426c7e22a58fe06 包含它，且工作区另有用户已有未提交更新。首次 GitHub 直连失败，使用 Windows 已启用的代理做一次命令级访问后核实，未修改 Git 或系统代理配置。安装使用当前完整工作树，未覆盖或丢弃已有修改。

## 实用暴露的缺口与本轮增量

原行为测试/浏览器参考虽然要求检查状态转换与失败恢复，但没有具体覆盖请求跨页面或会话后，旧成功、错误、重试和 finally 各自的副作用。第一轮还实际遇到测试夹具卸载整个路由宿主导致路由重置的问题；修复了夹具后，在隔离副本运行同一最终测试与原实现，确认失败确实来自业务断言。

按 skill-creator 的窄修正原则，仅修改：

- skills/_shared/behavioral-testing.md：加入可控延迟、异步状态归属、旧回调/身份重试、保留真实宿主的指导。
- skills/_shared/browser-verification.md：加入从真实入口切换上下文后释放旧响应，观察当前页面、身份与请求次数。
- skills/yan-code-review/modes/repair/evals.json：新增第 25、26 个结果导向场景，涵盖迟到导航、401/CSRF 与正常会话对照。

没有扩充公共入口，没有新增强制阶段或依赖；两个参考继续由实际验证缺口触发条件加载。其余原有工作按启动指纹核对没有改变。没有修改系统 skill-creator；它的 Windows quick_validate 默认 GBK 解码失败，通过 python -X utf8 调用解决。

## TypeMe 实际结果

第一轮修复目录失败误报、自动进入/参数切换与迟到创建导航；新增 4 项回归在旧实现上全部失败，修复后该文件 14/14 通过。

第二轮使用重新安装后的指导，沿共享请求层追踪旧 401、CSRF 重试、token 等待、正文读取、busy 清理与目录消费者。修复了旧会话清除新登录态、旧写入用新身份重发、旧资料/导出及清理污染新上下文等问题。旧构建上真实 Chromium 复现登录乙账号后被甲的迟到 401 踢回登录页。

最终 TypeMe 前端 57 个文件、1197 项测试通过；类型检查、构建与资源检查通过；Chromium 在 320/390/1440 三种宽度共 44 项检查通过。最终相关 26 项测试在隔离副本原实现上产生 15 个目标断言失败、11 个通过，对照可区分旧缺陷。详见 TypeMe/docs/optimization/verification/2026-10-12-skills-two-rounds/REPORT.md。

## skill 验证与安装

- node scripts/check-all.js：退出 0，全部检查通过，包括 4 个公共 skill、11 个 eval suites、216 个场景、36 个三宿主静态契约、11 个路由和 36 个有预算资源。
- install-local.cmd agents：完成两次本地共享安装（使用前一次、修正后一次）。install-local.cmd status：agents CURRENT。
- python -X utf8 系统 skill-creator/scripts/quick_validate.py 已安装 yan-code-review：Skill is valid。
- 已安装 66 个文件全部与当前源文件相同；仅 SKILL.md 按安装契约移除开头 UTF-8 BOM。0 漂移，详见 workspace-and-install-audit.json 与 installed-file-hashes.json。
- 安装树 SHA-256：cab78fef91f8e52342984ffb86669db2b1fe4c3ef83b46cc6be2a62cc3282202。
- 原有文件检查没有丢失文件，两个仓库 HEAD 未变。本轮新增测试/脚本/证据仍未纳管，未执行 add、commit、push 或发布。

## 独立复测

依据仓库的技能修改验证规则，让一个无本轮结论上下文的独立 agent 使用已安装 check 模式，只读审查临时复制的 Java/JS/浏览器观察混合夹具。仅提供原始材料与任务，没有提供期望 finding 或修复方案。

它识别了折扣契约偏差、测试共享错误常量造成的虚假绿色、异步 QUEUED 过早显示已保存三项问题；未把 Mapper stub 当作真实 SQL 验证，也未向本机离线草稿强加服务端保存要求。实际运行 Node 测试 4/4 通过，独立业务断言 85 !== 90 失败；明确未执行 Java、DB 或浏览器。读取 5 个相关 skill 资源，夹具前后字节无变化。细节见 independent-forward-test.json。

这是一例独立只读复测，加上本次同一 Agent 在 TypeMe 的实用回归；不是配对模型试验，也不构成跨宿主提升率。TypeMe 的浏览器验证使用合成 API，不证明真实后端、数据库持久化或部署行为；本轮未连接用户授权的本地 MySQL，未外发个人数据或调用真实 AI。
