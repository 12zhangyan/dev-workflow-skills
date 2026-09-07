# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What This Repo Is

A collection of workflow skills for Java backend developers, targeting Claude Code, Cursor, and Codex. Skills are distributed via install scripts and land in user-level skill directories such as `~/.claude/skills/`, `~/.cursor/skills/`, and `~/.codex/skills/`. There is no build step; run `node scripts/check-all.js` for the full local and CI check suite. Individual checks are `node scripts/check-scripts.js` (check script syntax and conventions), `node scripts/check-board-sync.js` (board copy sync + JS syntax; `scripts/check-board-sync.sh` is the bash compatibility wrapper), `node scripts/check-board-behavior.js` (board lifecycle and catalog/detail behavior), `node scripts/check-agent-doc-sync.js` (AGENTS/CLAUDE guide drift), `node scripts/check-docs.js` (README/workflow coverage plus local Skill links and anchors), `node scripts/check-skill-inventory.js` (skill inventory, docs mentions, and OpenAI metadata), `node scripts/check-skill-metadata.js` (skill frontmatter, BOM, required metadata), `node scripts/check-portable-contracts.js` (three-host portable routing and side-effect contracts), `node scripts/check-route-loading.js` (per-entry/mode direct-resource allowlists and lazy-load guards), `node scripts/check-host-eval-runner.js` (no-cost host availability and eval-runner probe), `node scripts/check-workflow-briefs.js` (standard Workflow Brief fields), `node scripts/check-review-boundaries.js` (Review Gate boundary guardrails), `node scripts/check-document-boundaries.js` (document skill boundary guardrails), `node scripts/check-installers.js` (installer guardrails plus isolated Claude Code, Cursor, and Codex payload/BOM smoke tests), `node scripts/check-interaction-policy-sync.js` (shared interaction policy drift), and `node scripts/check-evals.js` (all skill eval files exist and parse) — the "product" is the skill folders.

The boundary checks guard high-risk behavior invariants, not prose style; if a skill rewrites the same rule with equivalent wording, update the matching check in the same change.

## Skills

| Skill | Entry point | Supporting files |
|-------|-------------|-----------------|
| `yan-dev-doc` | `skills/yan-dev-doc/SKILL.md` | conditional `publishing-openapi.md`, `publishing-board.md`, `scripts/validate-openapi.js`, `assets/board/` |
| `yan-project-analysis` | `skills/yan-project-analysis/SKILL.md` | `evals.json`, and `modes/` containing understanding, incident, business |
| `yan-code-review` | `skills/yan-code-review/SKILL.md` | `evals.json`, and `modes/` containing package, check, repair, loop |
| `yan-conversation-handoff` | `skills/yan-conversation-handoff/SKILL.md` | `reference.md` (cross-conversation handoff template) |

## Installation

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

The scripts require Node.js, download the repo archive (tarball/zip), and copy the `skills/` subtree into `~/.claude/skills/`, `~/.cursor/skills/`, and `~/.codex/skills/` by default. Each install is a transactional clean replacement: all selected targets are staged outside discovery roots first, each host is protected by an install lock, manifests are atomically replaced, and an activation failure rolls every selected target back. Before activation, the installer plans removal of this distribution's current managed directories, formerly managed directories, and known legacy names. Unmodified managed copies are deleted only after commit; pre-manifest, ownership-ambiguous, or locally modified same-name directories remain under `~/.yan-dev-workflow-skills-backups/<host>/<snapshot-id>/`. Unrelated Skills and existing legacy `.yan-backups/` folders are preserved. Each target gets a schema-v2 `.yan-dev-workflow-skills.json`; schema v1 is validated and migrated, while malformed or unsupported manifests block replacement. `--dry-run` previews the plan. `backups`, `restore`, and `backup-prune --keep N` manage recoverable snapshots. Remote wrappers accept `--ref` and `--sha256` for pinned, verified archives. For the Codex target only, the Node installer removes a leading UTF-8 BOM from copied `SKILL.md` files and fails explicitly if normalization cannot be completed. Restart the target tool after install.

`install-local.cmd` (Windows cmd) installs from the local checkout instead of downloading. Args `claude` / `cursor` / `codex` (combinable) restrict targets; no args installs all three. Every install uses the transactional clean-replacement behavior above. Add `--dry-run` to preview; use `status` for CURRENT/DRIFT/OUTDATED/UNMANAGED, `doctor` for discovery-root and duplicate diagnostics, `backups [target]` to list snapshots, `restore --backup <snapshot-id> [--skill <name>] <target>` to recover, and `backup-prune --keep <N> [--dry-run] [target]` for explicit retention. The deprecated `--migrate-legacy` argument remains accepted and emits a warning. The cmd wrapper stays **pure ASCII on purpose** because cmd.exe parses batch files per the OEM code page.

The four public skills are self-contained and do not require external methodology skills. Requirement clarification, test strategy, debugging, verification, and reviewer selection remain Agent decisions within this repository's evidence, safety, VCS, and acceptance boundaries.

## Architecture

Each skill is a self-contained directory:

```
skills/<name>/
  SKILL.md       ← skill definition (frontmatter + execution instructions)
  reference.md   ← optional compatibility index; runtime paths link directly to focused resources
  examples.md    ← filled-in examples the skill references during generation
  scripts/       ← deterministic helpers executed by the skill when needed
  assets/        ← files copied into the user's project (yan-dev-doc only: the HTML board template)
```

Public SKILL.md and mode frontmatter intentionally contain only portable `name` and `description` fields. Host-specific model, effort, tool allowlist, or invocation metadata must stay outside the shared behavior core. Codex invocation should be plain-language naming such as "使用 yan-dev-doc skill ..."; do not document `$skill-name` as a user input because `$` opens the Desktop skill/app selector, which may not index personal skills.

Each skill may include `agents/openai.yaml` for Codex UI metadata (display name, short description, default prompt). Keep it in sync with SKILL.md when changing a skill's purpose or invocation wording.

Skills reference their sibling files with relative paths. `yan-project-analysis` and `yan-code-review` are thin routers: choose one mode first, then load only `modes/<mode>/mode.md` and the references that mode explicitly needs. `skills/_shared/route-loading-contracts.json` is the machine-readable allowlist for every public entry and mode; `node scripts/check-route-loading.js` rejects undeclared direct Markdown resources, missing routed/conditional guards, contradictory eager-load instructions, oversized entry/mode/reference/example/template resources, missing eval coverage, and root routers that bypass `mode.md`. `--report` prints the static character/direct-resource baseline. Project-analysis modes reuse the board template from `../../../yan-dev-doc/assets/board/`, and runtime shell snippets search the common installed skill roots (`~/.codex`, `~/.claude`, `~/.cursor`, `~/.agents`) before falling back.

### Portable core and host adapters

The four public skills are one portable behavior core for Claude Code, Cursor, and Codex. Public `SKILL.md` and mode frontmatter use only the portable `name` and `description` discovery fields. Runtime instructions describe semantic capabilities (read/search, scoped edit, terminal, structured question, optional delegation) through `skills/_shared/host-capabilities.md`; they must not require one host's tool name or UI convention.

Cross-platform filesystem decisions use `skills/_shared/scripts/workflow-fs.js` instead of assuming Bash. Stable behavior contracts live in `skills/_shared/host-contracts.json` and are checked by `node scripts/check-portable-contracts.js`. This is an offline routing/side-effect contract suite, not evidence of live-model behavior. `node scripts/run-host-evals.js --probe` reports real Claude Code, Cursor Agent, and Codex CLI availability without model calls. Opt-in sampled evaluation uses `--live --host <host> --case <case> --workspace <git-worktree>`; the runner creates a temporary Git clone, stages the current checkout's `skills/` in a Git-ignored in-clone snapshot for sandbox access, and never writes the supplied workspace. Minimal-loading cases require a `LOADED_RESOURCES` receipt, reject forbidden/cross-mode resources, cap resource count, and record duration/output/resource-count metrics. Write-capable cases additionally require `--allow-write`, enforce their declared scope, and can assert produced artifact content with Unicode paths. Assessments use model stdout and actual artifacts; host diagnostics are retained only as a bounded head/tail summary.

Installation is also part of the host contract: Claude Code and Cursor preserve repository Markdown BOMs; only the Codex target strips the leading BOM from installed `SKILL.md`. `node scripts/check-installers.js` installs and byte-checks all three targets in an isolated home directory.

### HTML board

**Division of responsibilities**: the md files are AI-execution documents (precise paths, change lists, commands, evidence, and actionable todos for Codex/Cursor); board entries are independently authored human-readable solutions. Narrative fields (`background`, `solution`, `coreDesign`, `symptom`, `rootCause`, `fixPlan`, …) explain the why, flow, trade-offs, scope, and observable acceptance criteria to a colleague who did not participate. They are never excerpts of the md. Agent-only fields (`changeList`, `todos`, `stackTrace`, `codeLocation`) must stay out of board payloads.

The board is a multi-file static page; skills write its lightweight catalog and human-detail sidecars only through `board-add.js` (plus shell upgrades, see below):

```
project-html/
  index.html               ← shell (local mermaid vendor with CDN fallback)
  css/board.css            ← styles (paper/editorial theme: serif headings, vermilion accent)
  js/board.js              ← rendering; declares `const BOARD_VERSION = N` at top
  js/vendor/mermaid.min.js ← ~3MB local vendor for intranet use; copy via bash cp, never Read+Write
  build.js                 ← Node build script (no deps): hydrates catalog + detail, generates pages/ + docs/INDEX.md + first-run archive
  board-add.js             ← deterministic splitter/writer; matches deliveryId/sourceDocPath/docPath, deep-merges lifecycle detail, filters Agent-only fields, backs up, and guards record count
  data/changes.js          ← lightweight catalog for home/search/filter (plus htmlChangelog)
  data/details/<id>.js     ← independently written human solution loaded only after selection
  pages/<slug>.html        ← GENERATED lightweight detail pages sharing board assets (gitignored here)
  exports/<slug>.html      ← GENERATED self-contained page only on explicit --standalone export (gitignored here)
```

Entry kinds: docs (delivery dossiers created by `yan-dev-doc` only when the user explicitly requests a board, an existing dossier needs continuation, or a downstream contract requires it), `kind:"bug"` (from `bug-fix`), `kind:"reading"` (from `code-reading`), `kind:"biz"` (from `biz-flow`, tester-facing business flow with `bizFlow`/`dataFlow`/`sequence`/`stateMachine` mermaid fields plus optional `roles`/`context`/`dataChanges`/`validations`/`dataObjects` rich fields). A delivery dossier carries `deliveryId`, `currentGate`, compact review health, and a nested human-readable `delivery` detail with plan/review/verification evidence. Direct package/repair/loop calls update that dossier by stable identity when one exists; check updates it only when lifecycle recording is explicit. Entries carry `service` / `module` (two-level grouping) and `docPath` (repo-relative path to the source md, rendered as a `../<docPath>` link). Optional `updatedAt`, `pinned`, and `lifecycle:"active|backlog|archived"` fields govern the workspace/backlog/archive views; old entries remain compatible as Plan-stage records. The `apis` field only records new or signature-changed endpoints and may include `operationId` plus optional interface-level `specPath`. When `yan-dev-doc` generates importable Apifox/OpenAPI YAML, entries also carry `apiSpecPath` (for example `docs/apifox/<date>/<task>.openapi.yaml`) and usually `apiIndexPath:"docs/apifox/INDEX.md` so the board can link the import file directly.

**`build.js` (run only after a skill actually writes or updates the board, invoked as `node project-html/build.js`)** does three things: (1) resolves every catalog `detailPath`, hydrates the human solution, and incrementally maintains `project-html/pages/<slug>.html` using shared assets; missing/mismatched details fail explicitly; (2) regenerates `docs/INDEX.md` from the lightweight catalog; (3) on first run copies scattered legacy docs into `docs/archive/`. A self-contained page is generated only by `node project-html/build.js --standalone <docPath|slug>`. `slugOf()` and collision maps in build.js/board.js must stay identical.

Board writes go through **`board-add.js`** (`node project-html/board-add.js <entry.json>`). It deterministically splits one independently authored human entry into a whitelisted catalog and `data/details/<detailId>.js`, filters Agent-only fields, matches by `deliveryId`, `sourceDocPath`, then `docPath`, deep-merges lifecycle detail, updates event arrays idempotently by stable `eventId`, preserves governance state, maintains `updatedAt`, backs up `changes.js`, and aborts on parse/count regressions. `node project-html/board-add.js --migrate` converts legacy rich entries without reading md. The template catalog ships empty.

Shell upgrade mechanism: skills compare the user project's `BOARD_VERSION` against the template's; if lower/missing they re-copy the shell files (never `data/`). **Bump `BOARD_VERSION` whenever shell behavior changes** (board.js, build.js, board-add.js, index.html, or css). Skills must run `node project-html/board-add.js` to write, then `node project-html/build.js`.

Two copies must stay in sync: `project-html/` and `skills/yan-dev-doc/assets/board/`. Shell files are byte-identical; template `data/changes.js` is empty and template `data/details/.gitkeep` only reserves the directory. Real detail sidecars are versioned project data; generated `pages/`, `exports/`, and repo-demo `docs/INDEX.md` remain ignored. Run `node scripts/check-board-sync.js` after shell changes.

## Workflow the Skills Support

```
目标与边界明确 → Agent 按可验收结果拆分并实施 → 用真实命令验证 → 按风险选择独立 Review/修复 → 人工验收；VCS、数据库和提交边界始终保留，文档/代码地图/看板等阶段按需进入
```

- `yan-dev-doc` produces `docs/YYYY-MM-DD/<task>.md` in the user's project
- `yan-project-analysis mode=incident` produces `docs/bugs/YYYY-MM-DD/<bug>.md`
- `yan-project-analysis mode=understanding` produces `docs/code-reading/YYYY-MM-DD/<feature>.md` in CodeMap mode, or zero-write chat output in ImpactAnalysis
- `review-check` performs a business-code/formal-doc read-only review from a review task/yan-dev-doc/patch and outputs structured findings; it updates an existing delivery's board review event through `board-add.js` only when lifecycle recording is explicit
- `review-repair` directly fixes accepted review findings in the working copy, preserves unrelated local changes, runs targeted verification, and reports fixed/blocked/rejected/deferred status; it does not create review tasks or perform read-only review
- `yan-code-review mode=loop` is a state-driven single-Agent closure: read-only review first, repair only accepted findings, then verify and recheck the latest diff when code changed. It does not invoke package or multi-Agent review merely because risk is high; route explicit task-package or independent-review requests to `package`. It includes untracked files while blocking Review/Submit approval until they are tracked, stops when no useful progress remains or evidence is sufficient, and never auto-commits.
- `yan-project-analysis mode=business` produces `docs/biz-flow/YYYY-MM-DD/<feature>.md` (tester-facing: business-flow + data-flow + sequence diagrams)
- `yan-code-review mode=package` produces one evidence-bounded review task; when the host supports delegation it actively dispatches independent read-only reviewer roles and aggregates their findings, otherwise it leaves a portable task for external return. Accepted findings can produce `<task>-fix-handoff.md` plus a repair prompt.
- `yan-conversation-handoff` produces `docs/handoffs/YYYY-MM-DD/<task>-handoff.md` from current-conversation evidence for a new AI conversation; it is not a board entry and does not replace the smaller `Workflow Brief`
- `yan-dev-doc` writes only its md plan by default. It creates or continues one delivery dossier in `project-html/data/changes.js` only on an explicit board request, for an existing dossier, or when a downstream contract requires it; `yan-code-review` package/repair/loop calls update that dossier by `deliveryId` or `sourceDocPath` when applicable. Check defaults to zero writes unless lifecycle recording is explicit (loop owns one consolidated event instead of duplicating sub-stage events). `bug-fix`, `code-reading`, and `biz-flow` keep their own entry kinds. Every actual board write runs `node project-html/build.js` to refresh lightweight detail pages + `docs/INDEX.md`
- All skills use `skills/_shared/scripts/workflow-fs.js prepare-date-dir` for date generation and directory creation; runtime behavior does not depend on Bash, PowerShell, or Python
- Interaction policy for documentation/review skills lives in `skills/_shared/interaction-policy.md`: evidence-prefill first, risk-grade unknowns, ask only blocking questions, and surface business logic conflicts with evidence.
- Workflow gate policy lives in `skills/_shared/workflow-gates.md`: gates describe evidence states, not a mandatory pipeline. An agent may combine implementation and verification, skip NotApplicable artifacts, or delegate independent slices while preserving authorization, safety, verification, and open-finding boundaries.
- Lightweight handoff policy lives in `skills/_shared/workflow-brief.md`: only real cross-Agent, cross-task, or deferred work produces a `Workflow Brief`; its evidence index replaces repeated source/artifact/changed/test blocks, while old fields remain readable.
- Shared review semantics live in `skills/_shared/workflow-chain.md`: it preserves finding-ID and verification-state traceability without prescribing a next-step matrix; the current Agent chooses the smallest useful action.
- Closed-choice questions are not automatically asked: infer first, and use the current host's structured-question capability only when the answer changes execution path, risk level, file conflict handling, or an irreversible business/data/API decision. Otherwise ask one concise conversational question.

## Editing Skills

When modifying a skill:
- The execution steps in SKILL.md are the authoritative source of behavior — keep them precise and sequential
- Focused Markdown resources hold runtime templates and question banks; `SKILL.md` must link directly to only the resources needed for the selected route. A `reference.md` compatibility index must not become an eager-load instruction.
- Keep `skills/_shared/route-loading-contracts.json` synchronized with each entry/mode's direct Markdown links, load guards, eval binding, and character budget; examples must remain conditional and mode templates must remain routed or conditional.
- `agents/openai.yaml` is the Codex UI/default-prompt metadata; update it when renaming a skill or changing the user-facing trigger
- Keep repository skill Markdown files (`skills/**/*.md`) encoded as UTF-8 with BOM. This is intentional: some Windows-based AI tools and PowerShell readers otherwise decode Chinese skill text as the local ANSI code page and show mojibake. Do not copy that BOM policy blindly into the installed Codex target: the installers strip the leading BOM from copied `SKILL.md` files under `~/.codex/skills` so Codex can discover the skill frontmatter.
- Test with `node scripts/check-all.js`, install locally, verify `install-local.cmd status`, and use the opt-in host eval runner or delegated agents against an isolated Java fixture
