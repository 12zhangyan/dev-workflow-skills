# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A collection of workflow skills for Java backend developers, targeting Claude Code, Cursor, and Codex. Skills are distributed via install scripts and land in user-level skill directories such as `~/.claude/skills/`, `~/.cursor/skills/`, and `~/.codex/skills/`. There is no build step; run `node scripts/check-all.js` for the full local and CI check suite. Individual checks are `node scripts/check-scripts.js` (check script syntax and conventions), `node scripts/check-board-sync.js` (board copy sync + JS syntax; `scripts/check-board-sync.sh` is the bash compatibility wrapper), `node scripts/check-board-behavior.js` (board lifecycle and catalog/detail behavior), `node scripts/check-agent-doc-sync.js` (AGENTS/CLAUDE guide drift), `node scripts/check-docs.js` (README/workflow coverage plus local Skill links and anchors), `node scripts/check-skill-inventory.js` (skill inventory, docs mentions, and OpenAI metadata), `node scripts/check-skill-metadata.js` (skill frontmatter, BOM, required metadata), `node scripts/check-workflow-briefs.js` (standard Workflow Brief fields), `node scripts/check-review-boundaries.js` (Review Gate boundary guardrails), `node scripts/check-document-boundaries.js` (document skill boundary guardrails), `node scripts/check-installers.js` (installer target guardrails plus an isolated Codex payload/BOM smoke), `node scripts/check-interaction-policy-sync.js` (shared interaction policy drift), and `node scripts/check-evals.js` (all skill eval files exist and parse) — the "product" is the skill folders.

The boundary checks guard high-risk behavior invariants, not prose style; if a skill rewrites the same rule with equivalent wording, update the matching check in the same change.

## Skills

| Skill | Entry point | Supporting files |
|-------|-------------|-----------------|
| `dev-doc` | `skills/dev-doc/SKILL.md` | `reference.md` (question sets + doc template), `examples.md`, `scripts/validate-openapi.js`, `assets/board/` (HTML board template) |
| `bug-fix` | `skills/bug-fix/SKILL.md` | `reference.md` (question sets + doc template), `examples.md` |
| `code-reading` | `skills/code-reading/SKILL.md` | `reference.md` (doc template), `examples.md` |
| `review-check` | `skills/review-check/SKILL.md` | `reference.md` (review checklist + output format), `examples.md` |
| `review-repair` | `skills/review-repair/SKILL.md` | `reference.md` (direct repair workflow + output format), `examples.md` |
| `review-loop` | `skills/review-loop/SKILL.md` | `reference.md` (single-agent orchestration + output format), `examples.md` |
| `biz-flow` | `skills/biz-flow/SKILL.md` | `reference.md` (question set + doc template), `examples.md` |
| `review-fix` | `skills/review-fix/SKILL.md` | `reference.md` (review checklist + fix handoff templates), `examples.md` |
| `conversation-handoff` | `skills/conversation-handoff/SKILL.md` | `reference.md` (cross-conversation handoff template), `examples.md` |

## Installation

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

The scripts download the repo archive (tarball/zip) and copy the `skills/` subtree into `~/.claude/skills/`, `~/.cursor/skills/`, and `~/.codex/skills/` by default — no hardcoded file list, so new files under `skills/` are picked up automatically. For the Codex target only, installers remove a leading UTF-8 BOM from copied `SKILL.md` files because Codex discovery expects frontmatter to start directly with `---`. Restart the target tool after install.

`install-local.cmd` (Windows cmd) installs from the local checkout instead of downloading, and targets the user-level **skills** dir of three tools — `~/.claude/skills`, `~/.cursor/skills` (Cursor ≥1.6), `~/.codex/skills` — copying each skill dir whole. Args `claude` / `cursor` / `codex` (combinable) restrict targets; no args installs all three. It iterates `skills/*` (no hardcoded list) and per-skill removes+recopies, leaving other skills untouched; Codex copies get `SKILL.md` BOM normalization after copy. Kept **pure ASCII on purpose**: cmd.exe parses batch files per the OEM code page, so non-ASCII comments/echo break parsing (and can execute stray tokens).

Recommended companion workflow layer: [superpowers-zh](https://github.com/jnMetaCode/superpowers-zh). It provides general engineering-method skills such as brainstorming, test-driven development, systematic debugging, requesting code review, and verification before completion. This repository remains the Java delivery workflow layer: dev docs, bug/business-flow docs, review-task packages, structured finding IDs, repair handoff, code maps, board entries, Apifox/OpenAPI artifacts, and Workflow Briefs.

Install `superpowers-zh` from the concrete project directory, not from the user home directory:

```bash
npx superpowers-zh
```

If auto-detection cannot identify the host tool, follow `superpowers-zh` documentation and use `npx superpowers-zh --tool <name>` such as `codex`, `cursor`, or `claude`.

Integration policy:
- Use `superpowers-zh` before this repo's workflow when the requirement is still fuzzy (`brainstorming`), during implementation when TDD/debugging discipline is useful, or right before Review Gate for general verification discipline.
- Use this repo's skills for authoritative Java delivery artifacts and gates: `dev-doc`, `bug-fix`, `biz-flow`, `review-fix`, `review-check`, `review-repair`, `review-loop`, `code-reading`, and `conversation-handoff`.
- Do not let a `superpowers-zh` code-review result replace this repo's finding-ID chain. Convert useful findings into `review-check` / `review-fix` / `review-repair` IDs before repair or handoff.
- When documenting the combined workflow, use `skills/_shared/workflow-chain.md` as the source of truth: `superpowers-zh` may be inserted as optional preflight/TDD/debugging/verification/reviewer input, but its output must be recorded in this repo's blockers/conflicts, Verification Gate fields, `Workflow Brief`, or `CR/IM/MI/RJ/BK` IDs.

## Architecture

Each skill is a self-contained directory:

```
skills/<name>/
  SKILL.md       ← skill definition (frontmatter + execution instructions)
  reference.md   ← question sets and document templates loaded by the skill at runtime
  examples.md    ← filled-in examples the skill references during generation
  scripts/       ← deterministic helpers executed by the skill when needed
  assets/        ← files copied into the user's project (dev-doc only: the HTML board template)
```

SKILL.md frontmatter `name` and `description` are the portable discovery surface for Codex. Some files also keep Claude-oriented fields (`allowed-tools`, `model`, `effort`, `disable-model-invocation`) for compatibility, but do not rely on those fields to make Codex show slash commands. Codex invocation should be plain-language naming such as "使用 dev-doc skill ..."; do not document `$skill-name` as a user input because `$` opens the Desktop skill/app selector, which may not index personal skills.

Each skill may include `agents/openai.yaml` for Codex UI metadata (display name, short description, default prompt). Keep it in sync with SKILL.md when changing a skill's purpose or invocation wording.

Skills reference their sibling files with relative paths (e.g., `[reference.md](reference.md#step-3-查漏槽位)`). `bug-fix` and `code-reading` reuse the board template from `../dev-doc/assets/board/` (sibling dir after install), and runtime shell snippets search the common installed skill roots (`~/.codex`, `~/.claude`, `~/.cursor`, `~/.agents`) before falling back.

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
  board-add.js             ← deterministic splitter/writer; dedupes by docPath, writes catalog + detail, filters Agent-only fields, backs up, and guards record count
  data/changes.js          ← lightweight catalog for home/search/filter (plus htmlChangelog)
  data/details/<id>.js     ← independently written human solution loaded only after selection
  pages/<slug>.html        ← GENERATED lightweight detail pages sharing board assets (gitignored here)
  exports/<slug>.html      ← GENERATED self-contained page only on explicit --standalone export (gitignored here)
```

Entry kinds: docs (default, from `dev-doc`; also from `review-fix` only when it reaches the fix-handoff phase), `kind:"bug"` (from `bug-fix`), `kind:"reading"` (from `code-reading`), `kind:"biz"` (from `biz-flow`, tester-facing business flow with `bizFlow`/`dataFlow`/`sequence`/`stateMachine` mermaid fields plus optional `roles`/`context`/`dataChanges`/`validations`/`dataObjects` rich fields). `review-fix` first produces a review task package for other AIs; after review findings are pasted back, its fix-handoff document uses a default doc entry with `type:"代码审查"`. Entries carry `service` / `module` (two-level grouping) and `docPath` (repo-relative path to the source md, rendered as a `../<docPath>` link, also the dedupe key — skills update the existing entry instead of appending when `docPath` matches). Optional `updatedAt`, `pinned`, and `lifecycle:"active|backlog|archived"` fields govern the workspace/backlog/archive views; old entries remain compatible through date/status inference. The `apis` field only records new or signature-changed endpoints and may include `operationId` plus optional interface-level `specPath`. When `dev-doc` generates importable Apifox/OpenAPI YAML, entries also carry `apiSpecPath` (for example `docs/apifox/<date>/<task>.openapi.yaml`) and usually `apiIndexPath:"docs/apifox/INDEX.md"` so the board can link the import file directly.

**`build.js` (run by every skill after `node --check`, invoked as `node project-html/build.js`)** does three things: (1) resolves every catalog `detailPath`, hydrates the human solution, and incrementally maintains `project-html/pages/<slug>.html` using shared assets; missing/mismatched details fail explicitly; (2) regenerates `docs/INDEX.md` from the lightweight catalog; (3) on first run copies scattered legacy docs into `docs/archive/`. A self-contained page is generated only by `node project-html/build.js --standalone <docPath|slug>`. `slugOf()` and collision maps in build.js/board.js must stay identical.

Board writes go through **`board-add.js`** (`node project-html/board-add.js <entry.json>`). It deterministically splits one independently authored human entry into a whitelisted catalog and `data/details/<detailId>.js`, filters Agent-only fields, dedupes by `docPath`, preserves governance state, maintains `updatedAt`, backs up `changes.js`, and aborts on parse/count regressions. `node project-html/board-add.js --migrate` converts legacy rich entries without reading md. The template catalog ships empty.

Shell upgrade mechanism: skills compare the user project's `BOARD_VERSION` against the template's; if lower/missing they re-copy the shell files (never `data/`). **Bump `BOARD_VERSION` whenever shell behavior changes** (board.js, build.js, board-add.js, index.html, or css). Skills must run `node project-html/board-add.js` to write, then `node project-html/build.js`.

Two copies must stay in sync: `project-html/` and `skills/dev-doc/assets/board/`. Shell files are byte-identical; template `data/changes.js` is empty and template `data/details/.gitkeep` only reserves the directory. Real detail sidecars are versioned project data; generated `pages/`, `exports/`, and repo-demo `docs/INDEX.md` remain ignored. Run `node scripts/check-board-sync.js` after shell changes.

## Workflow the Skills Support

```
dev-doc → AI executes → svn add → mvn test → review-fix/review-check/review-repair split chain or review-loop single-agent loop → code-reading → human review → svn commit
```

- `dev-doc` produces `docs/YYYY-MM-DD/<task>.md` in the user's project
- `bug-fix` produces `docs/bugs/YYYY-MM-DD/<bug>.md`
- `code-reading` produces `docs/code-reading/YYYY-MM-DD/<feature>.md`
- `review-check` performs a read-only review from a review task/dev-doc/patch and outputs structured findings; it does not write docs or board entries
- `review-repair` directly fixes accepted review findings in the working copy, preserves unrelated local changes, runs targeted verification, and reports fixed/blocked/rejected/deferred status; it does not create review tasks or perform read-only review
- `review-loop` orchestrates standard (`review-fix → review-check → review-repair → verify → recheck`) or explicit quick mode in one AI run; it labels results `SingleAgentReview`, stops after at most two repair cycles, and never auto-commits
- `biz-flow` produces `docs/biz-flow/YYYY-MM-DD/<feature>.md` (tester-facing: business-flow + data-flow + sequence diagrams)
- `review-fix` first produces `docs/review-fix/YYYY-MM-DD/<task>-review-task.md` for Codex/Cursor/Claude review; after findings are pasted back, it can produce `<task>-fix-handoff.md` plus an AI fix prompt/code
- `conversation-handoff` produces `docs/handoffs/YYYY-MM-DD/<task>-handoff.md` from current-conversation evidence for a new AI conversation; it is not a board entry and does not replace the smaller `Workflow Brief`
- `dev-doc`, `bug-fix`, `code-reading`, and `biz-flow` auto-register their output in `project-html/data/changes.js`; `review-fix` registers only its second-stage fix-handoff document (doc entry with `type:"代码审查"`), then runs `node project-html/build.js` to refresh lightweight detail pages + `docs/INDEX.md`
- All skills use bash `date +%F` + `mkdir -p` for date generation and directory creation (no Python dependency)
- Interaction policy for documentation/review skills lives in `skills/_shared/interaction-policy.md`: evidence-prefill first, risk-grade unknowns, ask only blocking questions, and surface business logic conflicts with evidence.
- Workflow gate policy lives in `skills/_shared/workflow-gates.md`: every documentation/review skill should state the current gate, produced artifacts, evidence summary, next input, and blocker/failure branch. The intended Review Gate can use the split chain `review-fix -> review-check -> review-fix/review-repair` or `review-loop` for a single-agent closed loop before code-reading and human review.
- Lightweight handoff policy lives in `skills/_shared/workflow-brief.md`: every skill that produces a next action should output a copyable `Workflow Brief` with source/artifact/changed/test/finding pointers so the next AI reads indexed evidence instead of pasted full documents.
- Chain map lives in `skills/_shared/workflow-chain.md`: the single source of truth for "after skill X, run which skill next + copyable command" and finding-ID traceability (review-check emits CR/IM/MI IDs, review-fix preserves them on merge, review-repair backfills status by the same ID). Skills point here via workflow-gates.md instead of each re-listing the chain.
- Closed-choice questions are not automatically asked: infer first, and use AskUserQuestion only when the answer changes execution path, risk level, file conflict handling, or an irreversible business/data/API decision. Free-text questions stay conversational.

## Editing Skills

When modifying a skill:
- The execution steps in SKILL.md are the authoritative source of behavior — keep them precise and sequential
- `reference.md` holds content the skill loads at runtime (templates, question banks); keep it anchored with markdown headings that match the `#anchor` references in SKILL.md
- `agents/openai.yaml` is the Codex UI/default-prompt metadata; update it when renaming a skill or changing the user-facing trigger
- Keep repository skill Markdown files (`skills/**/*.md`) encoded as UTF-8 with BOM. This is intentional: some Windows-based AI tools and PowerShell readers otherwise decode Chinese skill text as the local ANSI code page and show mojibake. Do not copy that BOM policy blindly into the installed Codex target: the installers strip the leading BOM from copied `SKILL.md` files under `~/.codex/skills` so Codex can discover the skill frontmatter.
- Test by installing locally (`install.ps1` / `install.sh`) and running the skill in a Java project

