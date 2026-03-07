@echo off
setlocal
set "PS1_SCRIPT=%~dp0package-uxp-ccx.ps1"
if not exist "%PS1_SCRIPT%" (
  echo [ccx-pack] error: script not found "%PS1_SCRIPT%"
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_SCRIPT%" %*
exit /b %ERRORLEVEL%
