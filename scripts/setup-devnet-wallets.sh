#!/usr/bin/env bash
# Create devnet keypairs under secrets/ and airdrop SOL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/secrets"
mkdir -p "$SECRETS"

WALLETS=(coordinator committee-1 committee-2 committee-3 guest-demo deploy)

for name in "${WALLETS[@]}"; do
  path="$SECRETS/${name}-keypair.json"
  if [[ ! -f "$path" ]]; then
    solana-keygen new --no-bip39-passphrase -o "$path" --force
    echo "Created $path"
  else
    echo "Exists $path"
  fi
  pubkey=$(solana-keygen pubkey "$path")
  echo "  $name: $pubkey"
  solana airdrop 2 "$pubkey" --url devnet || true
done

cat <<EOF

Wallets ready in secrets/.
Configure Squads 2-of-3 with committee-1/2/3 pubkeys (see docs/SQUADS-SETUP.md).
Set KNA_COMMITTEE_VAULT in .env.solana after creating the multisig.

EOF
