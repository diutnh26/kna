#!/usr/bin/env bash
set -euo pipefail
export HOME=/root
# shellcheck disable=SC1091
source /root/.cargo/env
export PATH="/root/.local/share/solana/install/active_release/bin:/root/.cargo/bin:${PATH}"

echo "== versions =="
rustc --version
solana --version
avm --version || true
anchor --version || true

echo "== avm pin 0.30.1 =="
avm install 0.30.1 || true
avm use 0.30.1 || true
anchor --version

echo "== solana devnet =="
solana config set --url https://api.devnet.solana.com
solana config get

echo "== persist PATH =="
grep -q 'solana/install/active_release/bin' /root/.bashrc 2>/dev/null || \
  echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"' >> /root/.bashrc
grep -q 'cargo/env' /root/.bashrc 2>/dev/null || \
  echo '. "$HOME/.cargo/env"' >> /root/.bashrc

echo "done."
