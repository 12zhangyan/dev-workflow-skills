# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A collection of Claude Code skills for Java backend developers. Skills are distributed via install scripts and land in `~/.claude/skills/` on the user's machine. There is no build step and no test suite — the "product" is the SKILL.md files.

## Skills

| Skill | Entry point | Supporting files |
|-------|-------------|-----------------|
| `/dev-doc` | `skills/dev-doc/SKILL.md` | `reference.md` (question sets + doc template), `examples.md` |
| `/bug-fix` | `skills/bug-fix/SKILL.md` | `reference.md` (question sets + doc template) |
| `/code-reading` | `skills/code-reading/SKILL.md` | `reference.md` (doc template) |

## Installation

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/12zhangyan/dev-workflow-skills/main/install.ps1 | iex
```

The scripts download only the `skills/` subtree into `~/.claude/skills/`. Restart Claude Code after install.

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
```

SKILL.md frontmatter controls runtime behavior (`allowed-tools`, `model`, `effort`, `disable-model-invocation`). Both skills set `disable-model-invocation: true`, meaning Claude must follow the explicit step-by-step instructions in the file rather than exercising free-form judgment.

Skills reference their sibling files with relative paths (e.g., `[reference.md](reference.md#step-3-问题集)`). These paths resolve correctly because the skill is executed from its own directory inside `~/.claude/skills/`.

## Workflow the Skills Support

```
/dev-doc → AI executes → svn add → mvn test → AI review → /code-reading → human review → svn commit
```

- `/dev-doc` produces `docs/YYYY-MM-DD/<task>.md` in the user's project
- `/bug-fix` produces `docs/bugs/YYYY-MM-DD/<bug>.md`; both dev-doc and bug-fix auto-append to `project-html/index.html`
- `/code-reading` produces `docs/code-reading/YYYY-MM-DD/<feature>.md`
- All skills use `python3` (fallback `python`) for date generation and directory creation

## Editing Skills

When modifying a skill:
- The execution steps in SKILL.md are the authoritative source of behavior — keep them precise and sequential
- `reference.md` holds content the skill loads at runtime (templates, question banks); keep it anchored with markdown headings that match the `#anchor` references in SKILL.md
- Test by installing locally (`install.ps1` / `install.sh`) and running the skill in a Java project
