# Upgrade the kna-trust-layer program IN PLACE on devnet (same program ID,
# so existing config, roles and attestations stay valid), from Windows.
#
# Needs: secrets\deploy-keypair.json (the upgrade authority) and a built
# app\target\deploy\kna_trust_layer.so (.\scripts\program-tests.ps1 builds it).
# The deploy buffer needs roughly 2x the program size in SOL-rent; it is
# refunded when the upgrade completes.
#
# Usage (from the repo root):
#   .\scripts\upgrade-devnet.ps1            # check, then upgrade
#   .\scripts\upgrade-devnet.ps1 -DryRun    # check balance and size only

param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root "app"
$secrets = Join-Path $root "secrets"
$programId = "2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f"

if (-not (Test-Path (Join-Path $secrets "deploy-keypair.json"))) {
  throw "Missing secrets\deploy-keypair.json (upgrade authority FfNV...u6J)"
}
if (-not (Test-Path (Join-Path $app "target\deploy\kna_trust_layer.so"))) {
  throw "Missing app\target\deploy\kna_trust_layer.so - run .\scripts\program-tests.ps1 first"
}

$script = @'
set -euo pipefail
export PATH=/root/.local/share/solana/install/active_release/bin:$PATH
solana config set --url https://api.devnet.solana.com --keypair /secrets/deploy-keypair.json >/dev/null
SO=/workspace/app/target/deploy/kna_trust_layer.so
AUTH=$(solana address)
echo "upgrade authority: $AUTH"
solana program show PROGRAM_ID | tee /tmp/show
grep -q "Authority: $AUTH" /tmp/show || { echo "deploy-keypair is not this program's upgrade authority"; exit 1; }
NEW=$(stat -c %s "$SO")
CUR=$(awk '/Data Length:/ {print $3}' /tmp/show)
echo "program size: current $CUR bytes, new $NEW bytes"
echo "balance: $(solana balance)"
if [ "DRY_RUN" = "1" ]; then exit 0; fi
if [ "$NEW" -gt "$CUR" ]; then
  EXTRA=$(( NEW - CUR + 1024 ))
  echo "extending program data by $EXTRA bytes"
  solana program extend PROGRAM_ID "$EXTRA"
fi
solana program deploy "$SO" --program-id PROGRAM_ID --upgrade-authority /secrets/deploy-keypair.json
solana program show PROGRAM_ID
'@
$script = $script.Replace("PROGRAM_ID", $programId).Replace("DRY_RUN", $(if ($DryRun) { "1" } else { "0" })).Replace("`r", "")

docker run --rm `
  -v "${app}:/workspace/app:ro" `
  -v "${secrets}:/secrets:ro" `
  kna-anchor:local bash -lc $script
if ($LASTEXITCODE -ne 0) { throw "upgrade failed" }
