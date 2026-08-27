#!/usr/bin/env bash
set -eu
# Upgrade Solana/Agave so platform-tools Cargo can parse edition2024 crates
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
curl -sSfL https://release.anza.xyz/v2.2.20/install | sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
cargo-build-sbf --version || true
ls "$HOME/.local/share/solana/install/active_release/bin" | head
# Show platform-tools cargo version if present
find "$HOME/.local/share/solana/install" -name cargo -type f 2>/dev/null | head -5
