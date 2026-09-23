import "dotenv/config";
import { createApp } from "./app";
import { assertProductionConfig } from "./lib/config";
import { startChainWorker } from "./chain/worker";
import { backfillWallets } from "./chain/wallets";
import { runCheckoutJobOnce } from "./lib/checkout";

assertProductionConfig();

const port = Number(process.env.PORT) || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`KNĂ API listening on http://localhost:${port}`);
  startChainWorker();
  backfillWallets()
    .then((n) => n && console.log(`[wallets] created ${n} wallet(s) for existing accounts`))
    .catch((err) => console.error("[wallets] backfill failed:", err));

  // Check-out: payment reminders, the automatic charge, UNPAID.
  const every = Number(process.env.CHECKOUT_JOB_INTERVAL_MS ?? 10 * 60_000);
  setInterval(() => {
    runCheckoutJobOnce()
      .then((s) => (s.reminded || s.charged || s.unpaid) && console.log("[checkout]", s))
      .catch((err) => console.error("[checkout] job failed:", err));
  }, every);
});
