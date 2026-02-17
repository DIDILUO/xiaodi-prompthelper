$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot ".tmp-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Resolve-LogFilePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return $Path
  }

  try {
    Remove-Item -Force -Path $Path -ErrorAction Stop
    return $Path
  }
  catch {
    $dir = Split-Path -Parent $Path
    $name = [System.IO.Path]::GetFileNameWithoutExtension($Path)
    $ext = [System.IO.Path]::GetExtension($Path)
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $fallback = Join-Path $dir ("{0}-{1}{2}" -f $name, $stamp, $ext)
    Write-Host "[dev] log file is locked, fallback to: $fallback"
    return $fallback
  }
}

$webuiOutLog = Resolve-LogFilePath -Path (Join-Path $logDir "webui-dev.out.log")
$webuiErrLog = Resolve-LogFilePath -Path (Join-Path $logDir "webui-dev.err.log")

function Test-PortReady {
  param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5173,
    [int]$TimeoutMs = 250
  )

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      $client.Close()
      return $false
    }
    $client.EndConnect($async) | Out-Null
    $client.Close()
    return $true
  }
  catch {
    return $false
  }
}

$webuiArgs = @("/c", "npm run dev --prefix webui")
$webuiProc = Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList $webuiArgs `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $webuiOutLog `
  -RedirectStandardError $webuiErrLog `
  -PassThru

$ready = $false
for ($i = 0; $i -lt 80; $i++) {
  if ($webuiProc.HasExited) { break }
  if (Test-PortReady) {
    $ready = $true
    break
  }
  Start-Sleep -Milliseconds 250
}

if (-not $ready) {
  Write-Host ""
  Write-Host "[dev] webui not ready at http://127.0.0.1:5173"
  if (Test-Path $webuiOutLog) {
    Write-Host "----- webui stdout (tail) -----"
    Get-Content -Path $webuiOutLog -Tail 120
  }
  if (Test-Path $webuiErrLog) {
    Write-Host "----- webui stderr (tail) -----"
    Get-Content -Path $webuiErrLog -Tail 120
  }
  if ($null -ne $webuiProc -and -not $webuiProc.HasExited) {
    Stop-Process -Id $webuiProc.Id -Force
  }
  exit 1
}

Write-Host "[dev] webui ready: http://127.0.0.1:5173"
$env:ELECTRON_DEV_SERVER_URL = "http://127.0.0.1:5173"

try {
  npm run start --prefix electron
  exit $LASTEXITCODE
}
finally {
  if ($null -ne $webuiProc -and -not $webuiProc.HasExited) {
    Stop-Process -Id $webuiProc.Id -Force
  }
}
