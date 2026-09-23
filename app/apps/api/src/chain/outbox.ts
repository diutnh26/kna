import type { Prisma } from "@prisma/client";
import {
  contentHashFromPayload,
  hashProviderLabel,
  type LedgerAttestationPayload,
} from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { SETTLED_LEDGER_WHERE } from "../lib/ledger";

export function buildPayloadFromLedger(entry: {
  id: string;
  totalVnd: number;
  platformFeeVnd: number;
  communityFundVnd: number;
  toLabel: string;
  createdAt: Date;
  bookingId: string | null;
  orderId: string | null;
  offsetId: string | null;
}): LedgerAttestationPayload {
  const kind = entry.bookingId ? "booking" : entry.orderId ? "order" : "offset";
  return {
    ledgerId: entry.id,
    providerLabelHash: hashProviderLabel(entry.toLabel),
    totalVnd: entry.totalVnd,
    platformFeeVnd: entry.platformFeeVnd,
    communityFundVnd: entry.communityFundVnd,
    providerPayoutVnd: entry.totalVnd - entry.platformFeeVnd - entry.communityFundVnd,
    recordedAtIso: entry.createdAt.toISOString(),
    kind,
  };
}

export function payloadHash(entry: Parameters<typeof buildPayloadFromLedger>[0]): string {
  return contentHashFromPayload(buildPayloadFromLedger(entry));
}

/**
 * Only booking rows can be attested. The program's validate_split enforces
 * the booking split (7% platform, 3% community fund); a marketplace row
 * (5% / 0%) or an offset row (0% / 0%) would fail on-chain with
 * SplitMismatch. Supporting them needs a per-kind split in the program and
 * a redeploy, so until then they stay off the attestation queue.
 */
export function isAttestable(entry: { bookingId: string | null; voidedAt?: Date | null }) {
  return entry.bookingId !== null && !entry.voidedAt;
}

export class LedgerNotAttestableError extends Error {}

export async function enqueueLedgerSettledOutbox(tx: Prisma.TransactionClient, ledgerEntryId: string) {
  if (process.env.SOLANA_ENABLED !== "true") return;

  const entry = await tx.ledgerEntry.findUnique({ where: { id: ledgerEntryId } });
  if (!entry || !isAttestable(entry)) return;

  const hash = payloadHash(entry);
  await tx.chainOutbox.upsert({
    where: { idempotencyKey: `ledger:${ledgerEntryId}:settled` },
    create: {
      eventType: "LEDGER_SETTLED",
      idempotencyKey: `ledger:${ledgerEntryId}:settled`,
      payload: { ledgerEntryId, payloadHash: hash },
      status: "PENDING",
    },
    update: {},
  });

  await tx.ledgerAttestation.upsert({
    where: { ledgerEntryId },
    create: {
      ledgerEntryId,
      payloadHash: hash,
      state: "PENDING_SIGNATURE",
    },
    update: {},
  });
}

export async function recomputeAndVerifySettled(ledgerEntryId: string) {
  const entry = await prisma.ledgerEntry.findFirst({
    where: { id: ledgerEntryId, AND: [SETTLED_LEDGER_WHERE] },
  });
  if (!entry) {
    throw new LedgerNotAttestableError("Ledger entry is not settled");
  }
  if (!isAttestable(entry)) {
    throw new LedgerNotAttestableError("Only booking ledger entries can be attested on-chain");
  }
  return { entry, hash: payloadHash(entry), payload: buildPayloadFromLedger(entry) };
}
