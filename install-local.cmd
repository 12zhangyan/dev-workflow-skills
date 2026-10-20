@echo off
setlocal enabledelayedexpansion
REM SHIFT also shifts %0, so capture the script directory before parsing arguments.
set "ROOT=%~dp0"

REM Shared installation in .agents/skills; legacy roots are read-only.
REM Usage:
REM   install-local.cmd
REM   install-local.cmd agents
REM   install-local.cmd status
REM   install-local.cmd doctor
REM   install-local.cmd --dry-run agents
REM   install-local.cmd backups agents
REM   install-local.cmd restore --backup SNAPSHOT agents
REM   install-local.cmd backup-prune --keep 5

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required for safe shared installation and SKILL.md BOM normalization.
  exit /b 1
)

set "ACTION=install"
set "MIGRATE="
set "TARGETS="
set "EXTRA="

:parse
if "%~1"=="" goto run
if /i "%~1"=="status" (
  set "ACTION=status"
) else if /i "%~1"=="doctor" (
  set "ACTION=doctor"
) else if /i "%~1"=="backups" (
  set "ACTION=backups"
) else if /i "%~1"=="restore" (
  set "ACTION=restore"
) else if /i "%~1"=="backup-prune" (
  set "ACTION=backup-prune"
) else if /i "%~1"=="--migrate-legacy" (
  set "MIGRATE=--migrate-legacy"
) else if /i "%~1"=="--dry-run" (
  set "EXTRA=!EXTRA! --dry-run"
) else if /i "%~1"=="--backup" (
  if "%~2"=="" goto missing_value
  set "EXTRA=!EXTRA! --backup %~2"
  shift
) else if /i "%~1"=="--skill" (
  if "%~2"=="" goto missing_value
  set "EXTRA=!EXTRA! --skill %~2"
  shift
) else if /i "%~1"=="--keep" (
  if "%~2"=="" goto missing_value
  set "EXTRA=!EXTRA! --keep %~2"
  shift
) else if /i "%~1"=="agents" (
  set "TARGETS=!TARGETS! agents"
) else if /i "%~1"=="claude" (
  set "TARGETS=!TARGETS! claude"
) else if /i "%~1"=="cursor" (
  set "TARGETS=!TARGETS! cursor"
) else if /i "%~1"=="codex" (
  set "TARGETS=!TARGETS! codex"
) else (
  echo [ERROR] Unknown argument: %~1
  echo Allowed: status doctor backups restore backup-prune agents
  echo Options: --dry-run --backup ID --skill NAME --keep N
  exit /b 1
)
shift
goto parse

:missing_value
echo [ERROR] Missing value for option.
exit /b 1

:run
if defined TARGETS (
  node "%ROOT%scripts\install-core.js" %ACTION% --source "%ROOT%." --home "%USERPROFILE%" --targets %TARGETS% %MIGRATE% %EXTRA%
) else (
  node "%ROOT%scripts\install-core.js" %ACTION% --source "%ROOT%." --home "%USERPROFILE%" %MIGRATE% %EXTRA%
)
set "RESULT=%ERRORLEVEL%"
endlocal & exit /b %RESULT%
