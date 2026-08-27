import "dotenv/config";
import { createApp } from "./app";
import { assertProductionConfig } from "./lib/config";
import { startChainWorker } from "./chain/worker";

assertProductionConfig();

const port = Number(process.env.PORT) || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`KNĂ API listening on http://localhost:${port}`);
  startChainWorker();
});
