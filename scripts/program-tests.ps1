# On-chain integration tests for kna-trust-layer, from Windows.
#
# LiteSVM has no Windows binary, so everything runs in Docker:
#   1. anchor build (same image and script as CI's anchor-build job)
#   2. the LiteSVM tests in a Linux Node container, against a copy of app/
#      so the Windows node_modules are left alone
#
# Usage (from the repo root):
#   .\scripts\program-tests.ps1              # build the program, then test
#   .\scripts\program-tests.ps1 -SkipBuild   # reuse app\target\deploy\kna_trust_layer.so

param([switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root "app"
$image = "kna-anchor:local"

if (-not $SkipBuild) {
  docker image inspect $image *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Building $image (first run compiles Anchor; takes a while)..."
    docker build -f (Join-Path $root "Dockerfile.anchor-dev") -t $image $root
    if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
  }

  Write-Host "anchor build + Rust unit tests..."
  docker run --rm `
    -v "${app}:/workspace/app" `
    -v "$(Join-Path $root 'scripts\ci-anchor-build.sh'):/ci-anchor-build.sh:ro" `
    $image bash -lc "sed 's/\r$//' /ci-anchor-build.sh | bash"
  if ($LASTEXITCODE -ne 0) { throw "anchor build failed" }
}

$so = Join-Path $app "target\deploy\kna_trust_layer.so"
if (-not (Test-Path $so)) { throw "Missing $so - run without -SkipBuild" }

Write-Host "LiteSVM program tests..."
$testCmd = @'
set -euo pipefail
mkdir -p /work
cd /src
tar --exclude=./node_modules --exclude='./apps/*/node_modules' --exclude='./packages/*/node_modules' \
    --exclude=./target --exclude='./packages/*/dist' -cf - . | tar -xf - -C /work
cd /work
npm ci --ignore-scripts --no-audit --no-fund
KNA_PROGRAM_SO=/src/target/deploy/kna_trust_layer.so npm run test:program
'@
docker run --rm `
  -v "${app}:/src:ro" `
  -v kna-npm-cache:/root/.npm `
  node:24-bookworm bash -lc $testCmd.Replace("`r", "")
if ($LASTEXITCODE -ne 0) { throw "program tests failed" }
