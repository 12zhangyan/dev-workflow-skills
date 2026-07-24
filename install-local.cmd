@echo off
setlocal enabledelayedexpansion

REM Safe local installer for Claude Code, Cursor, and Codex.
REM Usage:
REM   install-local.cmd
REM   install-local.cmd claude cursor codex
REM   install-local.cmd status
REM   install-local.cmd doctor
REM   install-local.cmd --migrate-legacy claude

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required for safe installation and Codex BOM normalization.
  exit /b 1
)

set "ACTION=install"
set "MIGRATE="
set "TARGETS="

:parse
if "%~1"=="" goto run
if /i "%~1"=="status" (
  set "ACTION=status"
) else if /i "%~1"=="doctor" (
  set "ACTION=doctor"
) else if /i "%~1"=="--migrate-legacy" (
  set "MIGRATE=--migrate-legacy"
) else if /i "%~1"=="claude" (
  set "TARGETS=!TARGETS! claude"
) else if /i "%~1"=="cursor" (
  set "TARGETS=!TARGETS! cursor"
) else if /i "%~1"=="codex" (
  set "TARGETS=!TARGETS! codex"
) else (
  echo [ERROR] Unknown argument: %~1
  echo Allowed: status doctor claude cursor codex --migrate-legacy
  exit /b 1
)
shift
goto parse

:run
if defined TARGETS (
  node "%~dp0scripts\install-core.js" %ACTION% --source "%~dp0." --home "%USERPROFILE%" --targets %TARGETS% %MIGRATE%
) else (
  node "%~dp0scripts\install-core.js" %ACTION% --source "%~dp0." --home "%USERPROFILE%" %MIGRATE%
)
set "RESULT=%ERRORLEVEL%"
endlocal & exit /b %RESULT%
