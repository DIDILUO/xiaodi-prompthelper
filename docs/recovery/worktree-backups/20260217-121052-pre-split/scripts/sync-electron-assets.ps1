$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$webuiDist = Join-Path $root 'webui\dist'
$serverDir = Join-Path $root 'server'
$electronDir = Join-Path $root 'electron'
$targetWebui = Join-Path $electronDir 'webui\dist'
$targetServer = Join-Path $electronDir 'server'

if (!(Test-Path $webuiDist)) { throw "Missing source: $webuiDist" }
if (!(Test-Path $serverDir)) { throw "Missing source: $serverDir" }

New-Item -ItemType Directory -Force -Path $targetWebui | Out-Null
New-Item -ItemType Directory -Force -Path $targetServer | Out-Null

function Invoke-RobocopyMirror {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Target
  )

  # /R /W limits retries for locked files to avoid long hangs.
  robocopy $Source $Target /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  $exitCode = $LASTEXITCODE
  if ($exitCode -gt 7) {
    throw "robocopy failed: $Source -> $Target (exitCode=$exitCode)"
  }
}

Invoke-RobocopyMirror -Source $webuiDist -Target $targetWebui
Invoke-RobocopyMirror -Source $serverDir -Target $targetServer

Write-Host "[sync] Copied webui/dist and server into electron package"