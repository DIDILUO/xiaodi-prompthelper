<#
@phb-version-tag: recovered-ce8k-r17
@phb-version: 0.0.1-recovered-r17
@phb-version-note: CE8K reverse-recovered baseline; naming refactor batch17 complete.
@phb-updated-at: 2026-02-18
#>
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$workspaceRoot = Split-Path -Parent $root
$webuiDist = Join-Path $root 'webui\dist'
$serverDir = Join-Path $root 'server'
$electronDir = Join-Path $root 'electron'
$targetWebui = Join-Path $electronDir 'webui\dist'
$targetServer = Join-Path $electronDir 'server'
$backupRoot = Join-Path $workspaceRoot '本地备份\03-打包过程归档\sync-electron-assets-history'

if (!(Test-Path $webuiDist)) { throw "Missing source: $webuiDist" }
if (!(Test-Path $serverDir)) { throw "Missing source: $serverDir" }

function New-Stamp {
  Get-Date -Format 'yyyyMMdd-HHmmss'
}

function Move-ToTrashIfExists {
  param(
    [Parameter(Mandatory = $true)][string]$PathToMove,
    [Parameter(Mandatory = $true)][string]$TrashBatch,
    [Parameter(Mandatory = $true)][string]$Label
  )
  if (!(Test-Path $PathToMove)) { return }
  $target = Join-Path $TrashBatch $Label
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Move-Item -Path $PathToMove -Destination $target
}

function Invoke-RobocopyCopy {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Target,
    [string[]]$ExcludeDirs = @(),
    [string[]]$ExcludeFiles = @()
  )

  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  $args = @($Source, $Target, '/E', '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
  if ($ExcludeDirs.Count -gt 0) {
    $args += '/XD'
    $args += $ExcludeDirs
  }
  if ($ExcludeFiles.Count -gt 0) {
    $args += '/XF'
    $args += $ExcludeFiles
  }
  robocopy @args | Out-Null
  $exitCode = $LASTEXITCODE
  if ($exitCode -gt 7) {
    throw "robocopy copy failed: $Source -> $Target (exitCode=$exitCode)"
  }
}

$stamp = New-Stamp
$backupBatch = Join-Path $backupRoot ("sync-electron-assets-" + $stamp)
New-Item -ItemType Directory -Force -Path $backupBatch | Out-Null

Move-ToTrashIfExists -PathToMove $targetWebui -TrashBatch $backupBatch -Label 'electron-webui-dist'
Move-ToTrashIfExists -PathToMove $targetServer -TrashBatch $backupBatch -Label 'electron-server'

Invoke-RobocopyCopy -Source $webuiDist -Target $targetWebui
Invoke-RobocopyCopy -Source $serverDir -Target $targetServer -ExcludeDirs @('data') -ExcludeFiles @('package-lock.json')

Write-Host "[sync] Rebuilt electron/webui/dist and electron/server from fresh copies (backup: $backupBatch)"
