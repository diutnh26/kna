#!/usr/bin/env bash
# Deploy trust program to devnet and print Program ID (WSL).
set -euo pipefail
cd "$(dirname "$0")/../app"
anchor build
anchor deploy --provider.cluster devnet
echo "Update KNA_TRUST_PROGRAM_ID in secrets/.env.solana with the address above."
