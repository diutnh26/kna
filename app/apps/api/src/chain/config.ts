import type { Prisma } from "@prisma/client";

export interface ChainConfig {
  enabled: boolean;
  cluster: "devnet" | "localnet";
  rpcUrl: string;
  programId: string;
  committeeVault: string;
  workerEnabled: boolean;
  workerPollMs: number;
  workerLeaseSec: number;
  walletLinkDomain: string;
  walletLinkTtlSec: number;
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export function loadChainConfig(): ChainConfig {
  const rawCluster = process.env.SOLANA_CLUSTER ?? "devnet";
  if (rawCluster === "mainnet-beta" || rawCluster === "mainnet") {
    throw new Error("Mainnet RPC is blocked for KNĂ hackathon builds.");
  }
  const cluster = rawCluster as ChainConfig["cluster"];

  return {
    enabled: parseBool(process.env.SOLANA_ENABLED),
    cluster,
    rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    programId: process.env.KNA_TRUST_PROGRAM_ID ?? "2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f",
    committeeVault: process.env.KNA_COMMITTEE_VAULT ?? "",
    workerEnabled: parseBool(process.env.CHAIN_WORKER_ENABLED),
    workerPollMs: Number(process.env.CHAIN_WORKER_POLL_MS ?? 5000),
    workerLeaseSec: Number(process.env.CHAIN_WORKER_LEASE_SEC ?? 60),
    walletLinkDomain: process.env.WALLET_LINK_DOMAIN ?? "kna.local",
    walletLinkTtlSec: Number(process.env.WALLET_LINK_TTL_SEC ?? 300),
  };
}

export type ChainTx = Prisma.TransactionClient;
