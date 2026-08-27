#!/usr/bin/env bash
set -eu
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
solana --version
cargo-build-sbf --version || true
ls "$HOME/.local/share/solana/install/releases" 2>/dev/null | tail -n 20 || true
rustc --version
