@echo off
chcp 65001 >nul

REM Dev launcher (keep terminal open after exit)
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="

echo [dev] Starting prompthelper-bridge-recovered-ce8k...
call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo [dev] Process exited, code=%EXIT_CODE%
echo [dev] Press any key to close this window.
pause >nul
exit /b %EXIT_CODE%
