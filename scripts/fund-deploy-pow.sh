#!/usr/bin/env bash
set -eu

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
. "$HOME/.cargo/env" 2>/dev/null || true

DEPLOY_KP="/mnt/d/Travel/kna-docker/secrets/deploy-keypair.json"
DEPLOY_PUB="FfNVnqMmVPHYBQCaZdHbteBMpc7TReNsTpocHBRz1u6J"
TARGET_LAMPORTS="${1:-3000000000}"  # default 3 SOL

solana config set --url https://api.devnet.solana.com --keypair "$DEPLOY_KP"

echo "=== Balance before ==="
solana balance "$DEPLOY_PUB" --url devnet

if ! command -v devnet-pow >/dev/null 2>&1; then
  echo "Installing devnet-pow..."
  cargo install devnet-pow
fi

echo "=== Available PoW faucets ==="
devnet-pow get-all-faucets -ud || true

echo "=== Mining toward ${TARGET_LAMPORTS} lamports (may take several minutes) ==="
devnet-pow mine \
  -k "$DEPLOY_KP" \
  -ud \
  -d 3 \
  --reward 0.02 \
  --no-infer \
  -t "$TARGET_LAMPORTS"

echo "=== Balance after ==="
solana balance "$DEPLOY_PUB" --url devnet
