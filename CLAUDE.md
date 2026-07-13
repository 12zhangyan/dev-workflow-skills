# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A collection of workflow skills for Java backend developers, targeting Claude Code, Cursor, and Codex. Skills are distributed via install scripts and land in user-level skill directories such as `~/.claude/skills/`, `~/.cursor/skills/`, and `~/.codex/skills/`. There is no build step; run `node scripts/check-all.js` for the full local check suite. Individual checks are `node scripts/check-scripts.js` (check script syntax and conventions), `node scripts/check-board-sync.js` (board copy sync + JS syntax; `scripts/check-board-sync.sh` is the bash wrapper used by CI), `node scripts/check-agent-doc-sync.js` (AGENTS/CLAUDE guide drift), `node scripts/check-docs.js` (README/workflow documentation coverage), `node scripts/check-skill-metadata.js` (skill frontmatter, BOM, required metadata), `node scripts/check-workflow-briefs.js` (standard Workflow Brief fields), `node scripts/check-installers.js` (installer target and Codex BOM-normalization guardrails), `node scripts/check-interaction-policy-sync.js` (shared interaction policy drift), and `node scripts/check-evals.js` (all skill eval files exist and parse) — the "product" is the skill folders.

## Skills

| Skill | Entry point | Supporting files |
|-------|-------------|-----------------|
| `dev-doc` | `skills/dev-doc/SKILL.md` | `reference.md` (question sets + doc template), `examples.md`, `scripts/validate-openapi.js`, `assets/board/` (HTML board template) |
| `bug-fix` | `skills/bug-fix/SKILL.md` | `reference.md` (question sets + doc template), `examples.md` |
| `code-reading` | `skills/code-reading/SKILL.md` | `reference.md` (doc template) |
| `review-check` | `skills/review-check/SKILL.md` | `reference.md` (review checklist + output format), `examples.md` |
| `review-repair` | `skills/review-repair/SKILL.md` | `reference.md` (direct repair workflow + output format), `examples.md` |
| `review-loop` | `skills/review-loop/SKILL.md` | `reference.md` (single-agent orchestration + output format), `examples.md` |
| `biz-flow` | `skills/biz-flow/SKILL.md` | `reference.md` (question set + doc template), `examples.md` |
| `review-fix` | `skills/review-fix/SKILL.md` | `reference.md` (review checklist + fix handoff templates), `examples.md` |

## Installation

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

The scripts download the repo archive (tarball/zip) and copy the `skills/` subtree into `~/.claude/skills/`, `~/.cursor/skills/`, and `~/.codex/skills/` by default — no hardcoded file list, so new files under `skills/` are picked up automatically. For the Codex target only, installers remove a leading UTF-8 BOM from copied `SKILL.md` files because Codex discovery expects frontmatter to start directly with `---`. Restart the target tool after install.

`install-local.cmd` (Windows cmd) installs from the local checkout instead of downloading, and targets the user-level **skills** dir of three tools — `~/.claude/skills`, `~/.cursor/skills` (Cursor ≥1.6), `~/.codex/skills` — copying each skill dir whole. Args `claude` / `cursor` / `codex` (combinable) restrict targets; no args installs all three. It iterates `skills/*` (no hardcoded list) and per-skill removes+recopies, leaving other skills untouched; Codex copies get `SKILL.md` BOM normalization after copy. Kept **pure ASCII on purpose**: cmd.exe parses batch files per the OEM code page, so non-ASCII comments/echo break parsing (and can execute stray tokens).

The full workflow also requires `superpowers-zh` (provides `/brainstorming`, `/requesting-code-review`, etc.):

```bash
npx superpowers-zh
```

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

**Division of responsibilities**: the md files are AI-execution documents (precise paths, change lists, actionable todos for Codex/Cursor); board entries are standalone human-readable write-ups. Narrative fields (`background`, `solution`, `coreDesign`, `symptom`, `rootCause`, `fixPlan`, …) are authored by the skills for a colleague who didn't participate in the work — complete sentences, the "why" included, `\n` renders as paragraph breaks. They are never excerpts of the md.

The board is a multi-file static page; skills modify only the data file (plus shell upgrades, see below):

```
project-html/
  index.html               ← shell (local mermaid vendor with CDN fallback)
  css/board.css            ← styles (paper/editorial theme: serif headings, vermilion accent)
  js/board.js              ← rendering; declares `const BOARD_VERSION = N` at top
  js/vendor/mermaid.min.js ← ~3MB local vendor for intranet use; copy via bash cp, never Read+Write
  build.js                 ← Node build script (no deps): generates pages/ + docs/INDEX.md + first-run archive
  board-add.js             ← Node write helper (no deps): skills feed it an entry JSON; it backs up, dedupes by docPath, escapes, appends/updates, and guards record count — replaces hand-edited marker-line writes
  data/changes.js          ← data arrays (htmlChangelog + changes) with append-marker lines
  pages/<slug>.html        ← GENERATED self-contained single pages (one per entry, gitignored here)
```

Entry kinds: docs (default, from `dev-doc`; also from `review-fix` only when it reaches the fix-handoff phase), `kind:"bug"` (from `bug-fix`), `kind:"reading"` (from `code-reading`), `kind:"biz"` (from `biz-flow`, tester-facing business flow with `bizFlow`/`dataFlow`/`sequence`/`stateMachine` mermaid fields plus optional `roles`/`context`/`dataChanges`/`validations`/`dataObjects` rich fields). `review-fix` first produces a review task package for other AIs; after review findings are pasted back, its fix-handoff document uses a default doc entry with `type:"代码审查"`. Entries carry `service` / `module` (two-level grouping) and `docPath` (repo-relative path to the source md, rendered as a `../<docPath>` link, also the dedupe key — skills update the existing entry instead of appending when `docPath` matches). The `apis` field only records new or signature-changed endpoints and may include `operationId` plus optional interface-level `specPath`. When `dev-doc` generates importable Apifox/OpenAPI YAML, entries also carry `apiSpecPath` (for example `docs/apifox/<date>/<task>.openapi.yaml`) and usually `apiIndexPath:"docs/apifox/INDEX.md"` so the board can link the import file directly.

**`build.js` (run by every skill after `node --check`, invoked as `node project-html/build.js`)** does three things: (1) regenerates `project-html/pages/<slug>.html` — one **self-contained single file per entry** (inlines css/board.css + board.js + local mermaid, single entry data) so a user can send one page to a colleague without the whole folder; (2) regenerates `docs/INDEX.md` (the doc index, refreshed from `changes.js` each run); (3) on first run (no `docs/archive/`) scans the project root and **copies** (never deletes) scattered legacy md / board html / API docs into `docs/archive/`. `slugOf()` in build.js must stay identical to `slugOf()` in board.js (they produce the same page filename), and likewise the collision-dedup map (`buildSlugMap()` in build.js / `_slugMap`+`pageSlug()` in board.js) — `buildPages`, `buildIndex`'s page cell, and board.js's `pageLink` must all resolve to the *same* deduped slug, or same-titled entries link to the wrong page. If `node` is absent, skills skip this step with a notice.

Board writes go through **`board-add.js`** (`node project-html/board-add.js <entry.json>`), not hand-edited marker lines: skills build a structured entry object (`{ changelog, entry }`) and the script deterministically backs up `data/changes.js`, dedupes by `docPath` (in-place update preserving `status`, else append), escapes strings, re-emits the file (preserving the header + field-doc comments), and aborts without writing if parsing fails or the record count would drop. This is the CLAUDE.md Rule 5 ("决策能用代码判定就别交给模型") applied to the wipeout-prone write path. The template `data/changes.js` ships **empty** (no placeholder entry) so first-create and subsequent writes share one path. Manual marker-line Edit remains only as a `node`-absent fallback.

Shell upgrade mechanism: skills compare the user project's `BOARD_VERSION` against the template's; if lower/missing they re-copy the shell files (never `data/`). **Bump `BOARD_VERSION` whenever shell behavior changes** (board.js, build.js, board-add.js, index.html, or css). Skills must run `node project-html/board-add.js` to write, then `node project-html/build.js`.

Two copies must stay in sync: `project-html/` (the live demo / a real project's board) and `skills/dev-doc/assets/board/` (the template skills copy into user projects). The shell files (`index.html`, `css/board.css`, `js/board.js`, `js/vendor/mermaid.min.js`, `build.js`, `board-add.js`) are byte-identical; only `data/changes.js` differs (template ships empty with just append markers). When changing board behavior, update both and run `node scripts/check-board-sync.js` (or `bash scripts/check-board-sync.sh` where bash is available; both verify sync + syntax). The generated `project-html/pages/` and `docs/` are gitignored in this repo.

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
- `dev-doc`, `bug-fix`, `code-reading`, and `biz-flow` auto-register their output in `project-html/data/changes.js`; `review-fix` registers only its second-stage fix-handoff document (doc entry with `type:"代码审查"`), then runs `node project-html/build.js` to refresh per-entry single pages + `docs/INDEX.md`
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

