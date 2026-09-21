# Selective map/Explore sync from d:\Travel\kna into kna-docker.
# NEVER copies apps/api/src/chain, apps/web/src/wallet, programs, or packages.
#
# Usage:
#   .\scripts\sync-map-from-kna.ps1 -DryRun
#   .\scripts\sync-map-from-kna.ps1

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$srcWeb = Join-Path (Split-Path $RepoRoot -Parent) "kna\apps\web\src"
$dstWeb = Join-Path $RepoRoot "app\apps\web\src"

if (-not (Test-Path $srcWeb)) {
    Write-Error "Source not found: $srcWeb"
}

$files = @(
    @{ Rel = "lib\geography.js"; DestDir = "lib" },
    @{ Rel = "components\VietnamMap.jsx"; DestDir = "components" },
    @{ Rel = "components\InteractiveMap.jsx"; DestDir = "components" },
    @{ Rel = "components\InteractiveMap.test.jsx"; DestDir = "components" }
)

Write-Host "Map-only sync"
Write-Host "  Source: $srcWeb"
Write-Host "  Target: $dstWeb"
Write-Host "  Protected: chain/, wallet/, programs/, packages/ (never touched)"

foreach ($f in $files) {
    $from = Join-Path $srcWeb $f.Rel
    $to = Join-Path $dstWeb $f.Rel
    if (-not (Test-Path $from)) {
        Write-Error "Missing source file: $from"
    }
    if ($DryRun) {
        Write-Host "  [dry] $from -> $to"
    } else {
        $dir = Join-Path $dstWeb $f.DestDir
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Copy-Item -Path $from -Destination $to -Force
        Write-Host "  copied $($f.Rel)"
    }
}

if ($DryRun) {
    Write-Host "[DRY RUN] Explore.jsx / i18n / leaflet must still be wired manually if missing."
    exit 0
}

Write-Host "Map component files synced. Ensure leaflet is in apps/web package.json and Explore.jsx includes the map section."
exit 0
