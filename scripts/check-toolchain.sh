#!/usr/bin/env bash
source /root/.cargo/env
export PATH="/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:/usr/bin:/bin"
rustup show
echo '--- avm ---'
command -v avm
avm list || true
echo '--- anchor ---'
command -v anchor
anchor --version || true
echo '--- solana ---'
solana --version
ls -la /root/.avm/bin 2>/dev/null || true
