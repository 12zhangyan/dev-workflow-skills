# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A collection of Claude Code skills for Java backend developers. Skills are distributed via install scripts and land in `~/.claude/skills/` on the user's machine. There is no build step; the only check is `scripts/check-board-sync.sh` (board copy sync + JS syntax, also run by GitHub Actions) — the "product" is the SKILL.md files.

## Skills

| Skill | Entry point | Supporting files |
|-------|-------------|-----------------|
| `/dev-doc` | `skills/dev-doc/SKILL.md` | `reference.md` (question sets + doc template), `examples.md`, `assets/board/` (HTML board template) |
| `/bug-fix` | `skills/bug-fix/SKILL.md` | `reference.md` (question sets + doc template), `examples.md` |
| `/code-reading` | `skills/code-reading/SKILL.md` | `reference.md` (doc template) |
| `/biz-flow` | `skills/biz-flow/SKILL.md` | `reference.md` (question set + doc template), `examples.md` |

## Installation

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

The scripts download the repo archive (tarball/zip) and copy the `skills/` subtree into `~/.claude/skills/` — no hardcoded file list, so new files under `skills/` are picked up automatically. Restart Claude Code after install.

`install-local.cmd` (Windows cmd) installs from the local checkout instead of downloading, and targets the user-level **skills** dir of three tools — `~/.claude/skills`, `~/.cursor/skills` (Cursor ≥1.6), `~/.codex/skills` — copying each skill dir whole. Args `claude` / `cursor` / `codex` (combinable) restrict targets; no args installs all three. It iterates `skills/*` (no hardcoded list) and per-skill removes+recopies, leaving other skills untouched. Kept **pure ASCII on purpose**: cmd.exe parses batch files per the OEM code page, so non-ASCII comments/echo break parsing (and can execute stray tokens).

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
  assets/        ← files copied into the user's project (dev-doc only: the HTML board template)
```

SKILL.md frontmatter controls runtime behavior (`allowed-tools`, `model`, `effort`, `disable-model-invocation`). All skills set `disable-model-invocation: true`, meaning Claude must follow the explicit step-by-step instructions in the file rather than exercising free-form judgment.

Skills reference their sibling files with relative paths (e.g., `[reference.md](reference.md#step-3-问题集)`). These paths resolve correctly because the skill is executed from its own directory inside `~/.claude/skills/`. `bug-fix` and `code-reading` reuse the board template from `../dev-doc/assets/board/` (sibling dir after install).

### HTML board

**Division of responsibilities**: the md files are AI-execution documents (precise paths, change lists, actionable todos for Claude/Cursor); board entries are standalone human-readable write-ups. Narrative fields (`background`, `solution`, `coreDesign`, `symptom`, `rootCause`, `fixPlan`, …) are authored by the skills for a colleague who didn't participate in the work — complete sentences, the "why" included, `\n` renders as paragraph breaks. They are never excerpts of the md.

The board is a multi-file static page; skills modify only the data file (plus shell upgrades, see below):

```
project-html/
  index.html               ← shell (local mermaid vendor with CDN fallback)
  css/board.css            ← styles (paper/editorial theme: serif headings, vermilion accent)
  js/board.js              ← rendering; declares `const BOARD_VERSION = N` at top
  js/vendor/mermaid.min.js ← ~3MB local vendor for intranet use; copy via bash cp, never Read+Write
  build.js                 ← Node build script (no deps): generates pages/ + docs/INDEX.md + first-run archive
  data/changes.js          ← data arrays (htmlChangelog + changes) with append-marker lines
  pages/<slug>.html        ← GENERATED self-contained single pages (one per entry, gitignored here)
```

Entry kinds: docs (default, from `/dev-doc`), `kind:"bug"` (from `/bug-fix`), `kind:"reading"` (from `/code-reading`), `kind:"biz"` (from `/biz-flow`, tester-facing business flow with `bizFlow`/`dataFlow`/`sequence`/`stateMachine` mermaid fields). Entries carry `service` / `module` (two-level grouping) and `docPath` (repo-relative path to the source md, rendered as a `../<docPath>` link, also the dedupe key — skills update the existing entry instead of appending when `docPath` matches). The `apis` field only records new or signature-changed endpoints.

**`build.js` (run by every skill after `node --check`, invoked as `node project-html/build.js`)** does three things: (1) regenerates `project-html/pages/<slug>.html` — one **self-contained single file per entry** (inlines css/board.css + board.js + local mermaid, single entry data) so a user can send one page to a colleague without the whole folder; (2) regenerates `docs/INDEX.md` (the doc index, refreshed from `changes.js` each run); (3) on first run (no `docs/archive/`) scans the project root and **copies** (never deletes) scattered legacy md / board html / API docs into `docs/archive/`. `slugOf()` in build.js must stay identical to `slugOf()` in board.js (they produce the same page filename), and likewise the collision-dedup map (`buildSlugMap()` in build.js / `_slugMap`+`pageSlug()` in board.js) — `buildPages`, `buildIndex`'s page cell, and board.js's `pageLink` must all resolve to the *same* deduped slug, or same-titled entries link to the wrong page. If `node` is absent, skills skip this step with a notice.

Shell upgrade mechanism: skills compare the user project's `BOARD_VERSION` against the template's; if lower/missing they re-copy the shell files (never `data/`). **Bump `BOARD_VERSION` whenever shell behavior changes** (board.js, build.js, index.html, or css). Skills must run `node --check` on `data/changes.js` after every append/update, then `node project-html/build.js`.

Two copies must stay in sync: `project-html/` (the live demo / a real project's board) and `skills/dev-doc/assets/board/` (the template skills copy into user projects). The shell files (`index.html`, `css/board.css`, `js/board.js`, `js/vendor/mermaid.min.js`, `build.js`) are byte-identical; only `data/changes.js` differs (template uses `<placeholder>` values). When changing board behavior, update both and run `bash scripts/check-board-sync.sh` (verifies sync + syntax; also runs in CI via `.github/workflows/check.yml`). The generated `project-html/pages/` and `docs/` are gitignored in this repo.

## Workflow the Skills Support

```
/dev-doc → AI executes → svn add → mvn test → AI review → /code-reading → human review → svn commit
```

- `/dev-doc` produces `docs/YYYY-MM-DD/<task>.md` in the user's project
- `/bug-fix` produces `docs/bugs/YYYY-MM-DD/<bug>.md`
- `/code-reading` produces `docs/code-reading/YYYY-MM-DD/<feature>.md`
- `/biz-flow` produces `docs/biz-flow/YYYY-MM-DD/<feature>.md` (tester-facing: business-flow + data-flow + sequence diagrams)
- All four skills auto-register their output in `project-html/data/changes.js` (dev-doc: doc entry, bug-fix: `kind:"bug"`, code-reading: `kind:"reading"`, biz-flow: `kind:"biz"`), then run `node project-html/build.js` to refresh per-entry single pages + `docs/INDEX.md`
- All skills use bash `date +%F` + `mkdir -p` for date generation and directory creation (no Python dependency)
- Closed-choice questions (task type, complexity, severity, file-conflict resolution) use the AskUserQuestion tool; free-text questions stay conversational

## Editing Skills

When modifying a skill:
- The execution steps in SKILL.md are the authoritative source of behavior — keep them precise and sequential
- `reference.md` holds content the skill loads at runtime (templates, question banks); keep it anchored with markdown headings that match the `#anchor` references in SKILL.md
- Test by installing locally (`install.ps1` / `install.sh`) and running the skill in a Java project
