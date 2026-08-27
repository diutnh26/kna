#!/usr/bin/env bash
set -euo pipefail
source /root/.cargo/env
export PATH="/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:/usr/bin:/bin"
export RUSTUP_TOOLCHAIN=1.79.0
avm install 0.30.1
avm use 0.30.1
anchor --version
solana config set --url https://api.devnet.solana.com
grep -q 'solana/install/active_release/bin' /root/.bashrc || \
  echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"' >> /root/.bashrc
grep -q 'cargo/env' /root/.bashrc || echo '. "$HOME/.cargo/env"' >> /root/.bashrc
echo done
