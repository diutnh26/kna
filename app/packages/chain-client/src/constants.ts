/** KNĂ trust layer program — replace after `anchor deploy` on devnet. */
export const KNA_TRUST_PROGRAM_ID = "2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f";

export const PLATFORM_FEE_BPS = 700;
export const COMMUNITY_FEE_BPS = 300;

export const ROLE_COORDINATOR = 1;
export const ROLE_COMMITTEE = 2;
export const ROLE_PROVIDER = 3;

export const ATTESTATION_PENDING = 0;
export const ATTESTATION_FINALIZED = 1;
export const ATTESTATION_CANCELLED = 2;

export const ACCOUNT_FLAG_GUEST = 1;
export const ACCOUNT_FLAG_PROVIDER = 2;

export const BOOKING_BOOKED = 0;
export const BOOKING_PAID = 1;
export const BOOKING_UNPAID = 2;
export const BOOKING_CANCELLED = 3;

export type SolanaCluster = "devnet" | "localnet" | "mainnet-beta";

export function assertDevnetCluster(cluster: string): void {
  if (cluster === "mainnet-beta" || cluster === "mainnet") {
    throw new Error("Mainnet is disabled for KNĂ hackathon builds.");
  }
}

export function explorerTxUrl(cluster: SolanaCluster, signature: string): string {
  const base =
    cluster === "devnet"
      ? "https://explorer.solana.com/tx/"
      : cluster === "localnet"
        ? "https://explorer.solana.com/tx/"
        : "https://explorer.solana.com/tx/";
  const suffix = cluster === "devnet" ? "?cluster=devnet" : cluster === "localnet" ? "?cluster=custom" : "";
  return `${base}${signature}${suffix}`;
}

export function explorerAccountUrl(cluster: SolanaCluster, address: string): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/address/${address}${suffix}`;
}
