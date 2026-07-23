@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  dev-workflow-skills local installer (Windows / cmd)
REM
REM  Copies each skill from this repo's skills\ folder, in Skills format
REM  (directory + SKILL.md), into the user-level skills dir of each tool:
REM    Claude Code : %USERPROFILE%\.claude\skills\<name>\
REM    Cursor      : %USERPROFILE%\.cursor\skills\<name>\
REM    Codex CLI   : %USERPROFILE%\.codex\skills\<name>\
REM
REM  Usage:
REM    install-local.cmd                 install into all three tools
REM    install-local.cmd claude          Claude Code only
REM    install-local.cmd cursor codex    only the listed tools (combinable)
REM
REM  Each skill directory is copied whole (incl. reference.md / examples.md /
REM  assets). Re-running overwrites the same-named skill and leaves any other
REM  skills in those folders untouched. Pure ASCII on purpose: cmd.exe parses
REM  batch files per the OEM code page, so non-ASCII text breaks parsing.
REM
REM  NOTE on Cursor duplicate loading: Cursor also loads skills from
REM  ~/.claude/skills, ~/.codex/skills and ~/.agents/skills (for compatibility),
REM  not only ~/.cursor/skills. Installing into all three tools can make the
REM  same skill appear multiple times in Cursor. If you only use Cursor, a
REM  single target is enough (e.g. "install-local.cmd claude"). Codex reads only
REM  its own ~/.codex/skills, so pass "codex" when you want Codex coverage.
REM ============================================================================

set "SRC=%~dp0skills"
if not exist "%SRC%" (
  echo [ERROR] skills folder not found: %SRC%
  echo         Run this script from the repo root ^(next to skills\^).
  exit /b 1
)

REM -- Parse args: pick target tools (no args = all) ---------------------------
set "DO_CLAUDE="
set "DO_CURSOR="
set "DO_CODEX="
if "%~1"=="" (
  set "DO_CLAUDE=1"
  set "DO_CURSOR=1"
  set "DO_CODEX=1"
) else (
  for %%A in (%*) do (
    if /i "%%~A"=="claude" set "DO_CLAUDE=1"
    if /i "%%~A"=="cursor" set "DO_CURSOR=1"
    if /i "%%~A"=="codex"  set "DO_CODEX=1"
  )
)
if not defined DO_CLAUDE if not defined DO_CURSOR if not defined DO_CODEX (
  echo [ERROR] Unrecognized argument: %*
  echo         Allowed: claude  cursor  codex  ^(combinable; default = all^)
  exit /b 1
)

echo Installing dev-workflow-skills locally ^(Skills format^)
echo Source: %SRC%
echo.

set "FAIL=0"
if defined DO_CLAUDE call :install "%USERPROFILE%\.claude\skills" "Claude Code"
if defined DO_CURSOR call :install "%USERPROFILE%\.cursor\skills" "Cursor"
if defined DO_CODEX  call :install "%USERPROFILE%\.codex\skills"  "Codex CLI"

echo.
if "%FAIL%"=="0" (
  echo Done. Restart Cursor / Claude Code / Codex to load the skills.
  echo Optional companion: run "npx superpowers-zh" from each concrete project directory.
) else (
  echo Done, but %FAIL% skill^(s^) failed to copy - see the log above.
)
endlocal & exit /b %FAIL%

REM -- Subroutine: copy every skill dir into one tool's skills folder ----------
:install
set "DEST=%~1"
set "TOOL=%~2"
echo === %TOOL%: %DEST% ===
if not exist "%DEST%\." mkdir "%DEST%" 2>nul
for %%L in (bug-fix biz-flow code-reading review-fix review-check review-repair review-loop) do (
  if exist "%DEST%\%%L\." rmdir /s /q "%DEST%\%%L"
)
for /d %%S in ("%SRC%\*") do (
  set "NAME=%%~nxS"
  if exist "%DEST%\!NAME!\." rmdir /s /q "%DEST%\!NAME!"
  robocopy "%%~fS" "%DEST%\!NAME!" /e /nfl /ndl /njh /njs /nc /ns /np >nul
  if errorlevel 8 (
    echo   [FAIL] !NAME!
    set /a FAIL+=1
  ) else (
    if /i "%TOOL%"=="Codex CLI" call :codex_normalize "%DEST%\!NAME!"
    echo   [ OK ] !NAME!
  )
)
echo.
goto :eof

REM -- Codex skill discovery expects SKILL.md to start with --- without BOM ----
:codex_normalize
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%~1'; Get-ChildItem -LiteralPath $d -Recurse -Filter 'SKILL.md' | ForEach-Object { $b=[System.IO.File]::ReadAllBytes($_.FullName); if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { [System.IO.File]::WriteAllBytes($_.FullName,$b[3..($b.Length-1)]) } }" >nul
goto :eof
