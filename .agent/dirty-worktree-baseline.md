# Dirty Worktree Baseline

记录时间：2026-07-18 17:48 Asia/Shanghai

## 目的

本文件记录自治迭代启动时已经存在的未提交修改。后续轮次不得把这些文件当成本 Agent 的新改动，不得回滚、覆盖或清理，除非用户明确授权或某轮已先读取 diff 并把修改边界写入计划。

## Git 状态摘要

```text
## main...origin/main
 M .gitignore
 M AGENTS.md
 M CLAUDE.md
 M README.md
 M project-html/board-add.js
 M project-html/build.js
 M project-html/css/board.css
 M project-html/data/changes.js
 M project-html/index.html
 M project-html/js/board.js
 M scripts/check-all.js
 M scripts/check-board-sync.js
 M skills/biz-flow/SKILL.md
 M skills/biz-flow/reference.md
 M skills/bug-fix/SKILL.md
 M skills/bug-fix/reference.md
 M skills/code-reading/SKILL.md
 M skills/yan-dev-doc/SKILL.md
 M skills/yan-dev-doc/assets/board/board-add.js
 M skills/yan-dev-doc/assets/board/build.js
 M skills/yan-dev-doc/assets/board/css/board.css
 M skills/yan-dev-doc/assets/board/data/changes.js
 M skills/yan-dev-doc/assets/board/index.html
 M skills/yan-dev-doc/assets/board/js/board.js
 M skills/yan-dev-doc/reference.md
?? docs/2026-07-18/
?? project-html/data/details/
?? scripts/check-board-behavior.js
?? skills/yan-dev-doc/assets/board/data/details/
```

Git also reports a permission warning for `C:\Users\22518/.config/git/ignore`; current repository checks still pass.

## 本 Agent 启动后新增

```text
?? .agent/
```

## 保护规则

- 默认优先修改 `.agent/` 或未出现在启动 dirty baseline 中的文件。
- 如必须修改 baseline 中的文件，先读取该文件的当前 diff，说明本轮只追加或调整哪一段，并在验证后记录。
- 不执行 `git reset --hard`、`git checkout --`、强制覆盖、清理未跟踪目录或删除分支。
- `project-html/` 与 `skills/yan-dev-doc/assets/board/` 是同步资产；修改其中一处时必须按项目规则同步另一处并运行 `node scripts/check-board-sync.js`。
- 当前 `.agent/` 是本 Agent 的迭代记录目录；如后续纳入版本控制，可用普通 git diff 审查其内容。
