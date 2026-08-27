# Refresh the snapshot under .\app from d:\Travel\kna.
# Does not change the original project. Re-run: docker compose up --build
#
# SAFETY: Solana/Track-2 work lives under app/programs, app/packages/chain-client,
# app/apps/api/src/chain, etc. This script will REFUSE to run without -Force
# if those paths exist, unless -DryRun is used to preview only.

param(
    [switch]$DryRun,
    [switch]$Force,
    [switch]$SkipSolanaCheck
)

$ErrorActionPreference = "Stop"
$src = Join-Path (Split-Path $PSScriptRoot -Parent) "kna"
$dst = Join-Path $PSScriptRoot "app"

if (-not (Test-Path $src)) {
    Write-Error "Original project not found at $src"
}

$solanaMarkers = @(
    (Join-Path $dst "programs"),
    (Join-Path $dst "packages\chain-client"),
    (Join-Path $dst "Anchor.toml"),
    (Join-Path $dst "apps\api\src\chain"),
    (Join-Path $dst "apps\web\src\wallet")
)

$hasSolanaWork = $false
foreach ($marker in $solanaMarkers) {
    if (Test-Path $marker) {
        $hasSolanaWork = $true
        Write-Host "  [marker] $marker"
    }
}

if ($hasSolanaWork -and -not $SkipSolanaCheck -and -not $Force) {
    Write-Host ""
    Write-Host "WARNING: Track 2 / Solana artifacts detected under app/." -ForegroundColor Yellow
    Write-Host "Running sync would overwrite hackathon-specific code." -ForegroundColor Yellow
    Write-Host "Use -DryRun to preview, or -Force to proceed anyway (NOT recommended)." -ForegroundColor Yellow
    Write-Host "Use -SkipSolanaCheck only if you know the upstream kna tree includes Solana." -ForegroundColor Yellow
    exit 2
}

$excludeDirs = @("node_modules", ".git", "dist", "coverage", ".claude", ".agents", "target", ".anchor", "programs", "packages")
$excludeFiles = @(".env", ".env.solana")

Write-Host "Source: $src"
Write-Host "Target: $dst"
if ($DryRun) {
    Write-Host "[DRY RUN] No files will be copied." -ForegroundColor Cyan
    robocopy $src $dst /E /L /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NP
    exit 0
}

if (-not $Force -and $hasSolanaWork) {
    $answer = Read-Host "Solana work exists. Type YES to sync anyway"
    if ($answer -ne "YES") {
        Write-Host "Aborted."
        exit 1
    }
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NP
if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }
Write-Host "Snapshot updated. Next: docker compose up --build"
exit 0
