param(
  [string]$PluginDir = "",
  [string]$OutDir = "",
  [string]$Apps = "",
  [switch]$SkipCcx,
  [switch]$SkipManual
)

$ErrorActionPreference = "Stop"

function Resolve-AbsPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )
  return (Resolve-Path -LiteralPath $Path).Path
}

function Ensure-Dir {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
  return (Resolve-Path -LiteralPath $Path).Path
}

function Get-RelativePathCompat {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,
    [Parameter(Mandatory = $true)]
    [string]$TargetPath
  )
  $baseAbs = (Resolve-Path -LiteralPath $BasePath).Path
  $targetAbs = (Resolve-Path -LiteralPath $TargetPath).Path
  if (-not $baseAbs.EndsWith("\")) {
    $baseAbs += "\"
  }
  $baseUri = New-Object System.Uri($baseAbs)
  $targetUri = New-Object System.Uri($targetAbs)
  $relativeUri = $baseUri.MakeRelativeUri($targetUri)
  return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace("/", "\")
}

function Normalize-AppsFilter {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @()
  }
  return $Value.Split(",", [System.StringSplitOptions]::RemoveEmptyEntries) `
    | ForEach-Object { $_.Trim().ToUpperInvariant() } `
    | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } `
    | Select-Object -Unique
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

if ([string]::IsNullOrWhiteSpace($PluginDir)) {
  $PluginDir = Join-Path $repoRoot "ps-plugin-uxp-starter"
}
$PluginDir = Resolve-AbsPath -Path $PluginDir

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path $PluginDir "dist"
}
$OutDir = Ensure-Dir -Path $OutDir
$manualRootDir = Join-Path $OutDir "manual"
if (-not $SkipManual) {
  $manualRootDir = Ensure-Dir -Path $manualRootDir
}

$manifestPath = Join-Path $PluginDir "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "manifest not found: $manifestPath"
}

$manifestRaw = Get-Content -Raw -LiteralPath $manifestPath -Encoding UTF8
$manifest = $manifestRaw | ConvertFrom-Json

$pluginId = [string]$manifest.id
if ([string]::IsNullOrWhiteSpace($pluginId)) {
  throw "manifest.id is required"
}

$pluginHosts = @($manifest.host)
if ($pluginHosts.Count -le 0) {
  throw "manifest.host is required"
}

$appsFilter = Normalize-AppsFilter -Value $Apps
if ($appsFilter.Count -gt 0) {
  $pluginHosts = @($pluginHosts | Where-Object {
    $hostApp = [string]$_.app
    $appsFilter -contains $hostApp.ToUpperInvariant()
  })
}
if ($pluginHosts.Count -le 0) {
  throw "no host matched. apps filter: $Apps"
}

$ignoredFileNames = @(
  ".uxprc",
  ".gitignore",
  ".npmignore",
  ".DS_Store",
  "yarn.lock",
  "package-lock.json",
  "manifest.json"
)

$filesToPack = @()
$allFiles = Get-ChildItem -LiteralPath $PluginDir -Recurse -File -Force
foreach ($file in $allFiles) {
  $relative = Get-RelativePathCompat -BasePath $PluginDir -TargetPath $file.FullName
  $relativePosix = $relative.Replace("\", "/")
  $fileName = [System.IO.Path]::GetFileName($relative)

  if ($relativePosix.StartsWith("dist/", [System.StringComparison]::OrdinalIgnoreCase)) { continue }
  if ($relativePosix.StartsWith(".git/", [System.StringComparison]::OrdinalIgnoreCase)) { continue }
  if ($relativePosix.StartsWith("uxp-plugin-tests", [System.StringComparison]::OrdinalIgnoreCase)) { continue }
  if ($fileName.StartsWith(".")) { continue }
  if ($ignoredFileNames -contains $fileName) { continue }
  if ($relativePosix.EndsWith(".ccx", [System.StringComparison]::OrdinalIgnoreCase)) { continue }
  if ($relativePosix.EndsWith(".xdx", [System.StringComparison]::OrdinalIgnoreCase)) { continue }

  $filesToPack += [PSCustomObject]@{
    SourcePath = $file.FullName
    RelativePath = $relative
  }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("xiaodi-uxp-ccx-" + $stamp + "-" + $PID)
Ensure-Dir -Path $tempRoot | Out-Null

$builtCcxPackages = @()
$builtManualPackages = @()
try {
  foreach ($pluginHost in $pluginHosts) {
    $hostApp = [string]$pluginHost.app
    if ([string]::IsNullOrWhiteSpace($hostApp)) {
      throw "manifest.host.app is required"
    }

    $stageDir = Join-Path $tempRoot ("stage-" + $hostApp)
    Ensure-Dir -Path $stageDir | Out-Null

    foreach ($item in $filesToPack) {
      $targetPath = Join-Path $stageDir $item.RelativePath
      $targetDir = Split-Path -Parent $targetPath
      if (-not [string]::IsNullOrWhiteSpace($targetDir)) {
        Ensure-Dir -Path $targetDir | Out-Null
      }
      Copy-Item -LiteralPath $item.SourcePath -Destination $targetPath -Force
    }

    $hostManifest = $manifestRaw | ConvertFrom-Json
    $hostManifest.host = $pluginHost
    $hostManifestJson = $hostManifest | ConvertTo-Json -Depth 100
    Set-Content -LiteralPath (Join-Path $stageDir "manifest.json") -Value $hostManifestJson -Encoding UTF8

    $baseName = "{0}_{1}" -f $pluginId, $hostApp
    $zipPath = Join-Path $OutDir ($baseName + ".zip")
    $ccxPath = Join-Path $OutDir ($baseName + ".ccx")

    if (-not $SkipCcx) {
      if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
      if (Test-Path -LiteralPath $ccxPath) { Remove-Item -LiteralPath $ccxPath -Force }

      Push-Location $stageDir
      try {
        Compress-Archive -Path * -DestinationPath $zipPath -CompressionLevel Optimal -Force
      } finally {
        Pop-Location
      }

      Move-Item -LiteralPath $zipPath -Destination $ccxPath -Force
      $builtCcxPackages += $ccxPath
      Write-Host ("[ccx-pack] built ccx: " + $ccxPath)
    }

    if (-not $SkipManual) {
      $manualPackageDir = Join-Path $manualRootDir $baseName
      if (Test-Path -LiteralPath $manualPackageDir) {
        Remove-Item -LiteralPath $manualPackageDir -Recurse -Force
      }
      Ensure-Dir -Path $manualPackageDir | Out-Null
      Get-ChildItem -LiteralPath $stageDir -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $manualPackageDir -Recurse -Force
      }
      $builtManualPackages += $manualPackageDir
      Write-Host ("[ccx-pack] built manual: " + $manualPackageDir)
    }
  }
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($builtCcxPackages.Count -le 0 -and $builtManualPackages.Count -le 0) {
  throw "no package generated"
}

Write-Host ("[ccx-pack] done. ccx=" + $builtCcxPackages.Count + ", manual=" + $builtManualPackages.Count)
