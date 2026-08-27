import {
  Connection,
  PublicKey,
  Transaction,
  type ConfirmedSignatureInfo,
} from "@solana/web3.js";
import type { LedgerAttestationPayload } from "./canonical";
import { contentHashFromPayload, hashLedgerId, hashProviderLabel } from "./canonical";
import {
  decodeFinalAttestation,
  decodePendingAttestation,
  type DecodedFinalAttestation,
  type DecodedPendingAttestation,
} from "./accounts";
import { ATTESTATION_FINALIZED, ATTESTATION_PENDING, KNA_TRUST_PROGRAM_ID } from "./constants";
import { finalPdaFromLedgerId, pendingPdaFromLedgerId, programId } from "./instructions";

export function isLikelyFakeSignature(sig: string): boolean {
  return (
    sig.startsWith("mock_") ||
    sig.startsWith("devnet_") ||
    sig.length < 64 ||
    /[^1-9A-HJ-NP-Za-km-z]/.test(sig)
  );
}

export async function confirmSignature(
  connection: Connection,
  signature: string,
  commitment: "confirmed" | "finalized" = "confirmed"
) {
  if (isLikelyFakeSignature(signature)) {
    throw new Error("Rejected fake/mock transaction signature");
  }
  const status = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const value = status?.value?.[0];
  if (!value) {
    throw new Error("Transaction signature not found on cluster");
  }
  if (value.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(value.err)}`);
  }
  const conf = value.confirmationStatus;
  if (commitment === "finalized" && conf !== "finalized") {
    throw new Error(`Transaction not finalized (status=${conf ?? "unknown"})`);
  }
  if (commitment === "confirmed" && conf !== "confirmed" && conf !== "finalized") {
    throw new Error(`Transaction not confirmed (status=${conf ?? "unknown"})`);
  }
  return value;
}

export async function fetchPendingAttestation(
  connection: Connection,
  ledgerId: string
): Promise<{ address: string; account: DecodedPendingAttestation } | null> {
  const address = pendingPdaFromLedgerId(ledgerId);
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info) return null;
  return {
    address: address.toBase58(),
    account: decodePendingAttestation(Buffer.from(info.data), info.owner),
  };
}

export async function fetchFinalAttestation(
  connection: Connection,
  ledgerId: string
): Promise<{ address: string; account: DecodedFinalAttestation } | null> {
  const address = finalPdaFromLedgerId(ledgerId);
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info) return null;
  return {
    address: address.toBase58(),
    account: decodeFinalAttestation(Buffer.from(info.data), info.owner),
  };
}

export function assertPendingMatchesPayload(
  account: DecodedPendingAttestation,
  payload: LedgerAttestationPayload,
  providerLabel: string,
  expectedCoordinator?: string
) {
  if (account.status !== ATTESTATION_PENDING && account.status !== ATTESTATION_FINALIZED) {
    throw new Error(`Unexpected pending status ${account.status}`);
  }
  if (account.ledgerIdHash !== hashLedgerId(payload.ledgerId)) {
    throw new Error("On-chain ledger hash mismatch");
  }
  if (account.providerHash !== hashProviderLabel(providerLabel)) {
    throw new Error("On-chain provider hash mismatch");
  }
  if (account.contentHash !== contentHashFromPayload(payload)) {
    throw new Error("On-chain content hash mismatch");
  }
  if (account.totalVnd !== payload.totalVnd) throw new Error("total_vnd mismatch");
  if (account.platformVnd !== payload.platformFeeVnd) throw new Error("platform_vnd mismatch");
  if (account.communityVnd !== payload.communityFundVnd) {
    throw new Error("community_vnd mismatch");
  }
  if (account.providerVnd !== payload.providerPayoutVnd) {
    throw new Error("provider_vnd mismatch");
  }
  if (expectedCoordinator && account.submittedBy !== expectedCoordinator) {
    throw new Error("submitted_by does not match coordinator wallet");
  }
}

export function assertFinalMatchesPayload(
  account: DecodedFinalAttestation,
  payload: LedgerAttestationPayload,
  providerLabel: string
) {
  if (account.ledgerIdHash !== hashLedgerId(payload.ledgerId)) {
    throw new Error("Final ledger hash mismatch");
  }
  if (account.providerHash !== hashProviderLabel(providerLabel)) {
    throw new Error("Final provider hash mismatch");
  }
  if (account.contentHash !== contentHashFromPayload(payload)) {
    throw new Error("Final content hash mismatch");
  }
  if (account.totalVnd !== payload.totalVnd) throw new Error("final total_vnd mismatch");
  if (account.platformVnd !== payload.platformFeeVnd) {
    throw new Error("final platform_vnd mismatch");
  }
  if (account.communityVnd !== payload.communityFundVnd) {
    throw new Error("final community_vnd mismatch");
  }
  if (account.providerVnd !== payload.providerPayoutVnd) {
    throw new Error("final provider_vnd mismatch");
  }
}

export async function buildSubmitTransaction(opts: {
  connection: Connection;
  coordinator: PublicKey;
  ledgerId: string;
  providerLabel: string;
  payload: LedgerAttestationPayload;
  recordedAtUnix: number;
  feePayer?: PublicKey;
}): Promise<{
  transaction: Transaction;
  pendingPda: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
}> {
  const { buildSubmitAttestationIx } = await import("./instructions");
  const ix = buildSubmitAttestationIx({
    coordinator: opts.coordinator,
    ledgerId: opts.ledgerId,
    providerLabel: opts.providerLabel,
    payload: opts.payload,
    recordedAtUnix: opts.recordedAtUnix,
  });
  const { blockhash, lastValidBlockHeight } = await opts.connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: opts.feePayer ?? opts.coordinator,
    blockhash,
    lastValidBlockHeight,
  }).add(ix);
  return {
    transaction,
    pendingPda: pendingPdaFromLedgerId(opts.ledgerId).toBase58(),
    recentBlockhash: blockhash,
    lastValidBlockHeight,
  };
}

export function serializeTransactionBase64(tx: Transaction): string {
  return Buffer.from(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  ).toString("base64");
}

export async function assertProgramDeployed(connection: Connection) {
  const info = await connection.getAccountInfo(programId(), "confirmed");
  if (!info?.executable) {
    throw new Error(`Program ${KNA_TRUST_PROGRAM_ID} is not deployed on this cluster`);
  }
}

export type { ConfirmedSignatureInfo };
