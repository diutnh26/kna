#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== KNĂ pre-demo checks =="
test -f docs/DEVNET-EVIDENCE.json

node -e '
const ev = require("./docs/DEVNET-EVIDENCE.json");
if (!ev.committeeVault) throw new Error("missing committeeVault");
if (ev.committeeVault === ev.coordinator) throw new Error("vault still equals coordinator");
if (!ev.squads?.executeSig) throw new Error("missing squads.executeSig");
if (!ev.demoFinalize?.finalPda) throw new Error("missing final PDA");
console.log("evidence ok");
'

cd "$ROOT/app"
npm run build:chain-client
npm run check:program-id --workspace @kna/chain-client
npm run test:chain-client
npm run test:api
export VITE_API_URL="${VITE_API_URL:-https://kna-api.onrender.com}"
npm run build:web
npm run build:api
echo "Pre-demo checks passed."
