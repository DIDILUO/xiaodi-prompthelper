@echo off
setlocal
chcp 65001 >nul

REM Hot-reload launcher for local development.
REM Usage:
REM   scripts\\dev-hot.cmd
REM   scripts\\dev-hot.cmd --dry-run

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"

cd /d "%REPO_ROOT%"
if not exist package.json (
  echo [dev-hot] error: package.json not found in repo root: "%REPO_ROOT%"
  exit /b 1
)

if /I "%~1"=="--dry-run" (
  echo [dev-hot] dry-run ok
  echo [dev-hot] repo root: "%REPO_ROOT%"
  echo [dev-hot] command: npm run dev
  exit /b 0
)

set "ELECTRON_RUN_AS_NODE="
title PromptHelper Bridge - Dev Hot Reload

echo [dev-hot] repo root: "%REPO_ROOT%"
echo [dev-hot] starting: npm run dev
call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo [dev-hot] process exited, code=%EXIT_CODE%
exit /b %EXIT_CODE%
