#!/usr/bin/env python3
from pathlib import Path
script = r'''#!/usr/bin/env bash
set -eu
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
. "$HOME/.cargo/env" 2>/dev/null || true
ROOT=/mnt/d/Travel/kna-docker
APP_SRC=$ROOT/app
SECRETS=$ROOT/secrets
DEPLOY_KP=$SECRETS/deploy-keypair.json
PROG_KP=$SECRETS/kna-trust-program-keypair.json
BUILD_DIR=/root/kna-build
RPC=https://api.devnet.solana.com
export CARGO_BUILD_JOBS=1
solana config set --url "$RPC" --keypair "$DEPLOY_KP"
solana balance --url "$RPC"
mkdir -p "$BUILD_DIR"
rsync -a --delete --exclude node_modules --exclude target --exclude .git "$APP_SRC/" "$BUILD_DIR/"
cd "$BUILD_DIR"
rustup default 1.79.0 2>/dev/null || true
anchor build
if [ -f "$PROG_KP" ]; then
  anchor deploy --provider.cluster devnet --program-keypair "$PROG_KP"
else
  anchor deploy --provider.cluster devnet
fi
PROGRAM_ID=2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f
solana program show "$PROGRAM_ID" --url "$RPC"
mkdir -p "$APP_SRC/target/idl" "$APP_SRC/target/deploy" "$APP_SRC/packages/chain-client/idl"
cp -f "$BUILD_DIR/target/idl/"*.json "$APP_SRC/target/idl/" 2>/dev/null || true
cp -f "$BUILD_DIR/target/idl/kna_trust_layer.json" "$APP_SRC/packages/chain-client/idl/kna_trust_layer.json" 2>/dev/null || true
cp -f "$BUILD_DIR/target/deploy/"*.so "$APP_SRC/target/deploy/" 2>/dev/null || true
cat > "$SECRETS/.env.solana" <<ENV
SOLANA_ENABLED=true
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=$RPC
KNA_TRUST_PROGRAM_ID=$PROGRAM_ID
KNA_COMMITTEE_VAULT=
CHAIN_WORKER_ENABLED=true
WALLET_LINK_DOMAIN=kna.local
ENV
echo Explorer: https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet
echo DONE
'''
Path('/mnt/d/Travel/kna-docker/tmp-run-deploy.sh').write_text(script, newline='\n')
print('wrote')
'''
# This file is executed on Windows to emit LF script via WSL python
print('use wsl python')
