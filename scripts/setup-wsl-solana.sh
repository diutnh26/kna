#!/usr/bin/env bash
# Pin Solana CLI (Agave) + Anchor + Rust in Ubuntu WSL2.
# Run inside WSL: bash scripts/setup-wsl-solana.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Pinned versions — update together after testing
SOLANA_VERSION="2.1.5"
ANCHOR_VERSION="0.30.1"
RUST_VERSION="1.84.0"

echo "==> Installing Rust ${RUST_VERSION}"
if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain "${RUST_VERSION}"
  source "$HOME/.cargo/env"
else
  rustup toolchain install "${RUST_VERSION}" --component rustfmt clippy
  rustup default "${RUST_VERSION}"
fi

echo "==> Installing Solana CLI ${SOLANA_VERSION}"
if ! command -v solana >/dev/null 2>&1; then
  sh -c "$(curl -sSfL https://release.anza.xyz/v${SOLANA_VERSION}/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
else
  solana --version
fi

echo "==> Installing Anchor ${ANCHOR_VERSION}"
if ! command -v avm >/dev/null 2>&1; then
  # Pin the tag — HEAD now requires edition2024 / newer Cargo.
  cargo install --git https://github.com/coral-xyz/anchor --tag "v${ANCHOR_VERSION}" avm --locked --force
fi
avm install "${ANCHOR_VERSION}"
avm use "${ANCHOR_VERSION}"

echo "==> Solana config (devnet)"
solana config set --url devnet

cat <<EOF

Toolchain ready. Add to ~/.bashrc if needed:
  export PATH="\$HOME/.local/share/solana/install/active_release/bin:\$PATH"

Next:
  cd app && anchor build
  bash ../scripts/setup-devnet-wallets.sh

EOF
