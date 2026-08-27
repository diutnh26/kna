#!/usr/bin/env bash
set -eu
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"

rustup install 1.84.0 --profile minimal
rustup default 1.84.0
export RUSTUP_TOOLCHAIN=1.84.0
unset CARGO_NET_OFFLINE

ROOT=/mnt/d/Travel/kna-docker
BUILD=/root/kna-build
export CARGO_BUILD_JOBS=1

solana config set --url https://api.devnet.solana.com --keypair "$ROOT/secrets/deploy-keypair.json"
mkdir -p "$BUILD"
rsync -a --delete --exclude node_modules --exclude target --exclude .git "$ROOT/app/" "$BUILD/"
cd "$BUILD"
rm -f Cargo.lock
rustup override set 1.84.0

patch_registry() {
  find "$HOME/.cargo/registry/src" -name Cargo.toml -type f -print0 2>/dev/null \
    | xargs -0 -r sed -i 's/edition = "2024"/edition = "2021"/g'
  find "$HOME/.cargo/registry/src" -name Cargo.toml -type f -print0 2>/dev/null \
    | xargs -0 -r sed -i '/edition2024/d'
  find "$HOME/.cargo/registry/src" -name Cargo.toml -type f -print0 2>/dev/null \
    | xargs -0 -r sed -i '/^rust-version/d'
}

pin_lock() {
  cargo +1.84.0 generate-lockfile || true
  cargo +1.84.0 update -p hashbrown --precise 0.14.5 2>/dev/null || true
  cargo +1.84.0 update -p indexmap --precise 2.7.1 2>/dev/null || true
  cargo +1.84.0 update -p jobserver --precise 0.1.32 2>/dev/null || true
  cargo +1.84.0 update -p unicode-segmentation --precise 1.12.0 2>/dev/null || true
  cargo +1.84.0 update -p ahash --precise 0.8.11 2>/dev/null || true
  cargo +1.84.0 update -p toml_edit --precise 0.22.22 2>/dev/null || true
  cargo +1.84.0 update -p toml_datetime --precise 0.6.8 2>/dev/null || true
  cargo +1.84.0 update -p winnow --precise 0.6.20 2>/dev/null || true
  cargo +1.84.0 update -p bytemuck --precise 1.21.0 2>/dev/null || true
  cargo +1.84.0 update -p zerocopy --precise 0.8.24 2>/dev/null || true
  cargo +1.84.0 update -p blake3 --precise 1.5.5 2>/dev/null || true
  cargo +1.84.0 update -p block-buffer --precise 0.10.4 2>/dev/null || true
  cargo +1.84.0 update -p crypto-common --precise 0.1.6 2>/dev/null || true
  cargo +1.84.0 update -p digest --precise 0.10.7 2>/dev/null || true
  cargo +1.84.0 update -p sha2 --precise 0.10.8 2>/dev/null || true
  # Keep proc-macro2 old enough that Anchor 0.30.1 IDL still compiles if IDL is enabled
  cargo +1.84.0 update -p proc-macro2 --precise 1.0.86 2>/dev/null || true
  cargo +1.84.0 update -p syn --precise 2.0.87 2>/dev/null || true
}

echo "=== host resolve ==="
rustc --version
pin_lock
cargo +1.84.0 check -p kna-trust-layer || true
cargo +1.84.0 fetch || true
patch_registry

echo "=== SBF build without IDL (avoids anchor-syn source_file breakage) ==="
SUCCESS=0
for i in $(seq 1 25); do
  echo "--- build attempt $i ---"
  patch_registry
  set +e
  OUT=$(anchor build --no-idl 2>&1)
  RC=$?
  set -e
  echo "$OUT" | tail -n 80
  if [ "$RC" -eq 0 ]; then
    SUCCESS=1
    break
  fi
  if echo "$OUT" | grep -Eq 'edition2024|feature `edition2024`|failed to parse manifest|requires rustc 1\.8[5-9]|is not supported by the following packages|source_file|This crate works only on'; then
    echo "toolchain/manifest issue — patch pins and retry"
    patch_registry
    pin_lock
    continue
  fi
  echo "Non-retryable build failure"
  exit "$RC"
done

if [ "$SUCCESS" -ne 1 ]; then
  echo "Exhausted build retries"
  exit 1
fi

cp -f Cargo.lock "$ROOT/app/Cargo.lock" || true

echo "=== deploy ==="
# Prefer direct solana program deploy of the built .so for reliability
SO=$(ls -1 target/deploy/*.so | head -n 1)
echo "Deploying $SO"
solana program deploy "$SO" \
  --program-id "$ROOT/secrets/kna-trust-program-keypair.json" \
  --url https://api.devnet.solana.com \
  --keypair "$ROOT/secrets/deploy-keypair.json"
solana program show 2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f --url https://api.devnet.solana.com

mkdir -p "$ROOT/app/target/idl" "$ROOT/app/target/deploy" "$ROOT/app/packages/chain-client/idl"
cp -f target/deploy/*.so "$ROOT/app/target/deploy/" || true
# Keep committed/hand-maintained IDL as source of truth when --no-idl
if [ -f "$ROOT/app/packages/chain-client/idl/kna_trust_layer.json" ]; then
  cp -f "$ROOT/app/packages/chain-client/idl/kna_trust_layer.json" "$ROOT/app/target/idl/" || true
fi

cat > "$ROOT/secrets/.env.solana" <<EOF
SOLANA_ENABLED=true
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
KNA_TRUST_PROGRAM_ID=2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f
KNA_COMMITTEE_VAULT=
CHAIN_WORKER_ENABLED=true
WALLET_LINK_DOMAIN=kna.local
EOF

echo Explorer: https://explorer.solana.com/address/2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f?cluster=devnet
echo DONE
