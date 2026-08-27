#!/usr/bin/env bash
set -euo pipefail
source /root/.cargo/env
export PATH="/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:/usr/bin:/bin"
bash /mnt/d/Travel/kna-docker/scripts/setup-devnet-wallets.sh
