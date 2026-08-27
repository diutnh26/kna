#!/usr/bin/env bash
set -eu
export PATH="$HOME/.cargo/bin:$PATH"
cd /root/kna-build
cargo tree -i blake3 2>&1 | head -60
grep -A8 'name = "blake3"' Cargo.lock | head -20
