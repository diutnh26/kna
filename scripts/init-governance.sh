#!/usr/bin/env bash
# Initialize on-chain governance after program deploy (idempotent best-effort).
# Usage (WSL): bash scripts/init-governance.sh
# Or from app/apps/api: npx tsx src/scripts/init-governance.ts
set -eu

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/app"
SECRETS="$ROOT/secrets"
RPC="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
PROGRAM_ID="${KNA_TRUST_PROGRAM_ID:-2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f}"
DEPLOY_KP="$SECRETS/deploy-keypair.json"

if [ ! -f "$DEPLOY_KP" ]; then
  echo "Missing $DEPLOY_KP"
  exit 1
fi

solana config set --url "$RPC" --keypair "$DEPLOY_KP"
echo "Program:"
solana program show "$PROGRAM_ID" --url "$RPC"

cd "$APP/apps/api"
if [ ! -d "$APP/node_modules" ]; then
  (cd "$APP" && npm install)
fi
(cd "$APP" && npm run build:chain-client)
npx tsx src/scripts/init-governance.ts
