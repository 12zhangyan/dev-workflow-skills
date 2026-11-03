# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What This Repo Is

A portable workflow skill collection for software-development agents, with Java backend examples. Its purpose is trustworthy output, not a smarter agent: the skills hold irreversible-action boundaries (read-only database, no automatic VCS writes, local read-only SVN), fix auditable and handoff-ready artifact shapes, and persist plan/review/verification evidence, while evidence depth, slicing, implementation, testing and review style stay agent decisions. Do not claim accuracy or speed gains; matched old/new evals so far only support "no regression observed".

The behavior core is vendor- and model-neutral; Claude Code, Cursor and Codex are the currently maintained adapters, which does not mean every host or case is live-validated. The "product" is the skill folders. There is no build step: `node scripts/check-all.js` runs the full local and CI suite; the individual check commands are listed in [README.md](README.md#维护这个仓库).

Checks guard behavior and contracts, never wording. Hard safety/truthfulness boundaries are registered once in `scripts/invariants.json` and matched per sentence by keyword regexes, so equivalent rewording passes; identifiers, paths and enum values consumed by scripts, the board or downstream skills are its contract tokens and must not be CJK prose. Wording and non-safety guidance are guarded by evals. If a check fails when only wording changed, the check is wrong: delete or rewrite it instead of bending the skill text to it.

Further reference: installation and board usage in [README.md](README.md); host eval runner and board internals in [docs/maintaining.md](docs/maintaining.md); evidence for past skill changes in `docs/research/`.

## Skills

| Skill | Entry point | Supporting files |
|-------|-------------|-----------------|
| `yan-dev-doc` | `skills/yan-dev-doc/SKILL.md` | conditional `plan-template.md`, `publishing-openapi.md`, `publishing-board.md`, `scripts/validate-openapi.js`, `assets/board/` |
| `yan-project-analysis` | `skills/yan-project-analysis/SKILL.md` | `evals.json`, and `modes/` containing understanding, incident, business |
| `yan-code-review` | `skills/yan-code-review/SKILL.md` | `evals.json`, and `modes/` containing package, check, repair, loop |
| `yan-conversation-handoff` | `skills/yan-conversation-handoff/SKILL.md` | `reference.md` (cross-conversation handoff template) |
| `yan-requirement-analysis` | `skills/yan-requirement-analysis/SKILL.md` | `evals.json`, conditional `analysis-template.md` (requirement analysis template) |

Each `SKILL.md` (and each mode's `mode.md`) is the authoritative source of that skill's behavior and artifacts. Shared policy lives once in `skills/_shared/`: `workflow-gates.md` (evidence states, VCS ownership and the full SVN command boundary), `interaction-policy.md`, `workflow-brief.md`, `workflow-chain.md`, `host-capabilities.md`, and `board-publish-flow.md`. Shared scripts handle cross-platform work: `workflow-fs.js prepare-date-dir` / `detect-vcs` / `file-state`, `doc-check.js`, `board-bootstrap.js`. Runtime behavior does not depend on Bash, PowerShell or Python.

The five public skills are self-contained and do not require external methodology skills.

## Installation

The maintained installer (`install.sh`, `install.ps1`, `install-local.cmd`) requires Node.js and installs the complete `skills/` subtree, including `_shared`, only into `~/.agents/skills/`. Legacy `claude / cursor / codex` roots are read-only diagnostic inputs. Repository-specific skills belong in `.agents/skills/`. Installed `SKILL.md` files lose only the leading UTF-8 BOM. Details: [README.md](README.md#安装细节).

## Architecture

```
skills/<name>/
  SKILL.md       ← skill definition (frontmatter + execution instructions)
  reference.md   ← optional compatibility index; runtime paths link directly to focused resources
  examples.md    ← filled-in examples the skill references during generation
  scripts/       ← deterministic helpers executed by the skill when needed
  assets/        ← files copied into the user's project (yan-dev-doc only: the HTML board template)
```

Public SKILL.md and mode frontmatter contain only the portable `name` and `description` fields; host-specific model, effort, tool allowlist or invocation metadata stays outside the shared core. Runtime instructions describe semantic capabilities through `skills/_shared/host-capabilities.md` and must not require one host's tool name or UI convention. Codex invocation is plain-language naming such as "使用 yan-dev-doc skill ..."; do not document `$skill-name` as user input because `$` opens the Desktop skill/app selector.

`yan-project-analysis` and `yan-code-review` are thin routers: choose one mode first, then load only `modes/<mode>/mode.md` and the references that mode explicitly needs. `skills/_shared/route-loading-contracts.json` is the machine-readable allowlist of every entry/mode's direct resources, load guards, eval binding and character budget, checked by `node scripts/check-route-loading.js` (`--report` prints the size baseline). Shared helpers resolve resources from the current skill tree, then the environment override, then `~/.agents`, and only then the legacy host roots.

Board: md files are agent-execution documents; board entries are independently authored human-readable solutions, never excerpts of the md, and Agent-only fields (`changeList`, `todos`, `stackTrace`, `codeLocation`) stay out of board payloads. Skills write board data only through `node project-html/board-add.js`, then run `node project-html/build.js`. `project-html/` and `skills/yan-dev-doc/assets/board/` must stay in sync (`node scripts/check-board-sync.js`); bump `BOARD_VERSION` whenever shell behavior changes; `slugOf()` and collision maps in build.js/board.js must stay identical. Internals: [docs/maintaining.md](docs/maintaining.md#html-board-internals).

## Workflow the Skills Support

```
目标与边界明确 → Agent 按可验收结果拆分并实施 → 用真实命令验证 → 按风险选择独立 Review/修复 → 人工验收；VCS、数据库和提交边界始终保留，文档/代码地图/看板等阶段按需进入
```

Gates describe evidence states, not a mandatory pipeline. Artifact paths are listed in [README.md](README.md#产物位置); publishing rules per skill live in each `SKILL.md`.

## Editing Skills

When modifying a skill:
- Write each behavioral rule once at its authoritative entry or reference; keep unavoidable permission guardrails visible at the entry. Describe observable completion and the condition for reading each optional reference. Prefer deleting a redundant instruction over shortening every sentence, and measure the full selected route rather than only the entry length. Treat a shorter prompt as a loading result, not evidence of better decisions; compare representative positive and negative cases before making that claim.
- Admit a new or rewritten behavioral rule only against an observed failure: a real session or a live eval in which the agent without the rule does the wrong thing. If the no-rule control already behaves correctly, do not add the rule. Choose the form by failure type: discipline skipped under pressure → a recognition table or concrete-phrase tripwire; wrong output shape → a positive recipe stating what the output contains, in order; an omitted element → a required slot in the template; condition-dependent behavior → a conditional keyed to an observable predicate. Do not append exception clauses to a working rule; express a real exception as its own conditional. Rules without a recorded baseline failure may still land for coverage gaps, but their PR must say so and must not claim improved behavior.
- Admit a new static check only for executable behavior (scripts, installers, board), a contract token, or a registered invariant whose loss causes irreversible side effects or false completion claims. Do not pin skill sentences; add an invariant entry or an eval case instead.
- The execution steps in SKILL.md are the authoritative source of behavior — keep them precise and sequential
- Focused Markdown resources hold runtime templates and question banks; `SKILL.md` must link directly to only the resources needed for the selected route. A `reference.md` compatibility index must not become an eager-load instruction.
- Keep `skills/_shared/route-loading-contracts.json` synchronized with each entry/mode's direct Markdown links, load guards, eval binding, and character budget; examples must remain conditional and mode templates must remain routed or conditional.
- `agents/openai.yaml` is the Codex UI/default-prompt metadata; update it when renaming a skill or changing the user-facing trigger
- Keep repository skill Markdown files (`skills/**/*.md`) encoded as UTF-8 with BOM. This is intentional: some Windows-based AI tools and PowerShell readers otherwise decode Chinese skill text as the local ANSI code page and show mojibake. Installed shared `SKILL.md` files under `~/.agents/skills` omit that BOM so frontmatter discovery remains compatible; other installed Markdown keeps its source bytes.
- Test with `node scripts/check-all.js`, install locally, verify `install-local.cmd status`, and use the opt-in host eval runner or delegated agents against an isolated Java fixture
