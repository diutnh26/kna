#!/usr/bin/env bash
# One-shot devnet deploy (WSL root recommended).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/clean-and-build-anchor.sh"
bash "$ROOT/scripts/init-governance.sh"
echo "Deploy + init complete. Evidence: $ROOT/docs/DEVNET-EVIDENCE.json"
