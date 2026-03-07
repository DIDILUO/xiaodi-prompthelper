@echo off
setlocal
chcp 65001 >nul

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"

call "%SCRIPT_DIR%dev-hot.cmd" %*
set "EXIT_CODE=%ERRORLEVEL%"

REM Best-effort cleanup: close orphan dev terminals/processes tied to this repo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$repo=[System.IO.Path]::GetFullPath($env:REPO_ROOT);" ^
  "$repoEsc=[regex]::Escape($repo);" ^
  "$cmdPattern='dev-hot\\.cmd|npm run dev --prefix webui|start-electron\\.cjs';" ^
  "$parentCmd=(Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId;" ^
  "$targets=Get-CimInstance Win32_Process | Where-Object { " ^
  "  $_.ProcessId -ne $PID -and $_.ProcessId -ne $parentCmd -and $_.CommandLine -and ( " ^
  "    ((@('node.exe','electron.exe') -contains $_.Name.ToLowerInvariant()) -and $_.CommandLine -match $repoEsc) -or " ^
  "    (($_.Name.ToLowerInvariant() -eq 'cmd.exe') -and $_.CommandLine -match $cmdPattern) " ^
  "  )" ^
  "};" ^
  "foreach($p in $targets){ try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>nul

endlocal & exit /b %EXIT_CODE%
