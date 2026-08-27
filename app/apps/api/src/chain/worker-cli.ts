import { runWorkerOnce, startChainWorker } from "./worker";

if (require.main === module) {
  startChainWorker();
  console.log("[chain-worker-cli] running");
}

export { runWorkerOnce, startChainWorker };
