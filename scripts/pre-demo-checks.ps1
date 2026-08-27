$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppRoot = Join-Path $RepoRoot "app"
$EvidencePath = Join-Path $RepoRoot "docs\DEVNET-EVIDENCE.json"
$EnvPath = Join-Path $RepoRoot "secrets\.env.solana"

Write-Host "== KNĂ pre-demo checks =="

if (-not (Test-Path $EvidencePath)) {
  throw "Missing docs/DEVNET-EVIDENCE.json"
}
if (-not (Test-Path $EnvPath)) {
  throw "Missing secrets/.env.solana"
}

$evidence = Get-Content $EvidencePath | ConvertFrom-Json
if (-not $evidence.committeeVault) {
  throw "Evidence has no committeeVault"
}
if ($evidence.committeeVault -eq $evidence.coordinator) {
  throw "committeeVault still equals coordinator; Squads path is not active"
}
if (-not $evidence.squads.executeSig) {
  throw "Missing squads.executeSig in evidence"
}
if (-not $evidence.demoFinalize.finalPda) {
  throw "Missing final PDA in evidence"
}

Push-Location $AppRoot
try {
  npm run build:chain-client
  npm run check:program-id --workspace @kna/chain-client
  npm run test:chain-client
  npm run test:api
  $env:VITE_API_URL = "https://kna-api.onrender.com"
  npm run build:web
  npm run build:api
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Evidence OK:"
Write-Host "  Program   $($evidence.programId)"
Write-Host "  Vault     $($evidence.committeeVault)"
Write-Host "  Pending   $($evidence.demoSubmit.pendingPda)"
Write-Host "  Final     $($evidence.demoFinalize.finalPda)"
Write-Host "  Execute   $($evidence.squads.executeSig)"
Write-Host ""
Write-Host "Pre-demo checks passed."
