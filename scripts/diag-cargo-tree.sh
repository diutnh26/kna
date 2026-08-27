#!/usr/bin/env bash
set -eu
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
rustup default stable
cd /root/kna-build
echo "=== cpufeatures inverse deps ==="
cargo tree -i cpufeatures 2>&1 | head -100
echo "=== lock grep ==="
grep -n "cpufeatures\|block-buffer\|blake3" Cargo.lock | head -40
