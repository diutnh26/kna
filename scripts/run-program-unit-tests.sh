#!/usr/bin/env bash
set -eu
export PATH="$HOME/.cargo/bin:$PATH"
rustup default 1.84.0 >/dev/null 2>&1 || rustup install 1.84.0 --profile minimal
cd /mnt/d/Travel/kna-docker/app
cargo +1.84.0 test -p kna-trust-layer --lib
echo UNIT_TESTS_OK
