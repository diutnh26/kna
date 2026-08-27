#!/usr/bin/env bash
set -euo pipefail
export HOME=/root
source /root/.cargo/env
export PATH="/root/.local/share/solana/install/active_release/bin:/root/.cargo/bin:${PATH}"

echo "==> Install Rust 1.79.0 for Anchor 0.30.1 CLI"
rustup toolchain install 1.79.0
rustup component add rustfmt clippy --toolchain 1.79.0
export RUSTUP_TOOLCHAIN=1.79.0

echo "==> avm install 0.30.1 (this compiles anchor-cli)"
avm install 0.30.1
avm use 0.30.1

echo "==> versions"
rustc +1.84.0 --version
rustc +1.79.0 --version
solana --version
anchor --version

echo "==> solana devnet"
solana config set --url https://api.devnet.solana.com

grep -q 'solana/install/active_release/bin' /root/.bashrc || \
  echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"' >> /root/.bashrc
grep -q 'cargo/env' /root/.bashrc || echo '. "$HOME/.cargo/env"' >> /root/.bashrc

echo "done."
