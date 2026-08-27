#!/usr/bin/env bash
set -euo pipefail

export PATH="/root/.avm/bin:/root/.local/share/solana/install/active_release/bin:/usr/local/cargo/bin:${PATH}"
export RUSTUP_TOOLCHAIN=1.84.0
export CARGO_BUILD_JOBS=1

cd /workspace/app

mkdir -p /workspace/secrets
if [ ! -f /workspace/secrets/deploy-keypair.json ]; then
  solana-keygen new --no-bip39-passphrase -o /workspace/secrets/deploy-keypair.json -f
fi

patch_registry() {
  find "$HOME/.cargo/registry/src" -name Cargo.toml -type f -print0 2>/dev/null \
    | xargs -0 -r sed -i 's/edition = "2024"/edition = "2021"/g' || true
  find "$HOME/.cargo/registry/src" -name Cargo.toml -type f -print0 2>/dev/null \
    | xargs -0 -r sed -i '/edition2024/d' || true
  find "$HOME/.cargo/registry/src" -name Cargo.toml -type f -print0 2>/dev/null \
    | xargs -0 -r sed -i '/^rust-version/d' || true
}

pin_lock() {
  cargo generate-lockfile 2>/dev/null || true
  cargo update -p hashbrown --precise 0.14.5 2>/dev/null || true
  cargo update -p indexmap --precise 2.7.1 2>/dev/null || true
  cargo update -p jobserver --precise 0.1.32 2>/dev/null || true
  cargo update -p unicode-segmentation --precise 1.12.0 2>/dev/null || true
  cargo update -p ahash --precise 0.8.11 2>/dev/null || true
  cargo update -p toml_edit --precise 0.22.22 2>/dev/null || true
  cargo update -p toml_datetime --precise 0.6.8 2>/dev/null || true
  cargo update -p winnow --precise 0.6.20 2>/dev/null || true
  cargo update -p bytemuck --precise 1.21.0 2>/dev/null || true
  cargo update -p zerocopy --precise 0.8.24 2>/dev/null || true
  cargo update -p blake3 --precise 1.5.5 2>/dev/null || true
  cargo update -p block-buffer --precise 0.10.4 2>/dev/null || true
  cargo update -p crypto-common --precise 0.1.6 2>/dev/null || true
  cargo update -p digest --precise 0.10.7 2>/dev/null || true
  cargo update -p sha2 --precise 0.10.8 2>/dev/null || true
  cargo update -p proc-macro2 --precise 1.0.86 2>/dev/null || true
  cargo update -p syn --precise 2.0.87 2>/dev/null || true
}

pin_lock
patch_registry

SUCCESS=0
for i in $(seq 1 10); do
  echo "--- anchor build attempt $i ---"
  set +e
  OUT=$(anchor build --no-idl 2>&1)
  RC=$?
  set -e
  echo "$OUT" | tail -n 40
  if [ "$RC" -eq 0 ]; then
    SUCCESS=1
    break
  fi
  if echo "$OUT" | grep -Eq 'edition2024|failed to parse manifest|requires rustc 1\.8[5-9]'; then
    patch_registry
    pin_lock
    continue
  fi
  exit "$RC"
done

if [ "$SUCCESS" -ne 1 ]; then
  echo "Exhausted anchor build retries"
  exit 1
fi

cargo test -p kna-trust-layer --lib
test -f packages/chain-client/idl/kna_trust_layer.json
test -f target/deploy/kna_trust_layer.so
echo "CI_ANCHOR_BUILD_OK"
