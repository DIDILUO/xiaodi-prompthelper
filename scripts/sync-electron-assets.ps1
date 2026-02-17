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

robocopy $webuiDist $targetWebui /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy $serverDir $targetServer /MIR /NFL /NDL /NJH /NJS /NP | Out-Null

Write-Host "[sync] Copied webui/dist and server into electron package"
