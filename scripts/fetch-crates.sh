#!/usr/bin/env bash
set -eu
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
rustup default stable
export CARGO_NET_OFFLINE=false
unset CARGO_NET_OFFLINE
# Remove offline from cargo config if present
mkdir -p "$HOME/.cargo"
if [ -f "$HOME/.cargo/config.toml" ]; then
  sed -i '/offline/d' "$HOME/.cargo/config.toml" || true
fi
if [ -f "$HOME/.cargo/config" ]; then
  sed -i '/offline/d' "$HOME/.cargo/config" || true
fi
echo "CARGO_NET_OFFLINE=${CARGO_NET_OFFLINE-unset}"
env | grep -i cargo || true
cd /root/kna-build
cargo fetch --locked 2>&1 | tail -30
echo FETCH_DONE
