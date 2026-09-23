import "dotenv/config";
import { createApp } from "./app";
import { assertProductionConfig } from "./lib/config";
import { startChainWorker } from "./chain/worker";
import { backfillWallets } from "./chain/wallets";

assertProductionConfig();

const port = Number(process.env.PORT) || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`KNĂ API listening on http://localhost:${port}`);
  startChainWorker();
  backfillWallets()
    .then((n) => n && console.log(`[wallets] created ${n} wallet(s) for existing accounts`))
    .catch((err) => console.error("[wallets] backfill failed:", err));
});
