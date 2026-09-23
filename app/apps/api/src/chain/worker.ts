import { ATTESTATION_CANCELLED } from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { loadChainConfig } from "./config";
import { getChainGateway } from "./gateway";
import { LedgerNotAttestableError, recomputeAndVerifySettled } from "./outbox";
import { registerAccountOnChain } from "./accounts-onchain";
import { NotReadyError, cancelBookingOnChain, recordBookingOnChain } from "./bookings-onchain";

const MAX_ATTEMPTS = 8;

export async function claimOutboxBatch(limit = 5) {
  const config = loadChainConfig();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + config.workerLeaseSec * 1000);
  const candidates = await prisma.chainOutbox.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "RETRYABLE", leaseUntil: { lt: now } },
        { status: "AWAITING_COMMITTEE", leaseUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const claimed = [];
  for (const row of candidates) {
    const updated = await prisma.chainOutbox.updateMany({
      where: {
        id: row.id,
        OR: [
          { status: row.status, leaseUntil: null },
          { status: row.status, leaseUntil: { lt: now } },
          { status: row.status, leaseUntil: row.leaseUntil },
        ],
      },
      data: {
        leaseUntil,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 1) claimed.push(row);
  }
  return claimed;
}

type OutboxRow = NonNullable<Awaited<ReturnType<typeof prisma.chainOutbox.findUnique>>>;

/**
 * Chain work that is not a ledger attestation: one handler per event type,
 * plus where to show its last error. A NotReadyError (waiting on another
 * event, e.g. an account registration) retries far longer before DEAD.
 */
const handlers: Record<
  string,
  { run: (payload: Record<string, string>) => Promise<unknown>; onError: (payload: Record<string, string>, message: string) => Promise<unknown> }
> = {
  ACCOUNT_REGISTER: {
    run: ({ userId }) => registerAccountOnChain(userId),
    onError: ({ userId }, message) =>
      prisma.wallet.updateMany({ where: { userId }, data: { registerError: message } }),
  },
  BOOKING_RECORD: {
    run: ({ bookingId }) => recordBookingOnChain(bookingId),
    onError: ({ bookingId }, message) =>
      prisma.booking.updateMany({ where: { id: bookingId }, data: { onchainError: message } }),
  },
  BOOKING_CANCEL: {
    run: ({ bookingId }) => cancelBookingOnChain(bookingId),
    onError: ({ bookingId }, message) =>
      prisma.booking.updateMany({ where: { id: bookingId }, data: { onchainError: message } }),
  },
};

const MAX_NOT_READY_ATTEMPTS = 60;

async function processChainEvent(row: OutboxRow) {
  const handler = handlers[row.eventType];
  const payload = row.payload as Record<string, string>;
  try {
    if (!getChainGateway().isEnabled()) {
      throw new Error("Solana disabled — leaving outbox for later");
    }
    await handler.run(payload);
    await prisma.chainOutbox.update({
      where: { id: row.id },
      data: { status: "DONE", leaseUntil: null, lastError: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown worker error";
    const limit = err instanceof NotReadyError ? MAX_NOT_READY_ATTEMPTS : MAX_ATTEMPTS;
    await prisma.chainOutbox.update({
      where: { id: row.id },
      data: {
        status: row.attempts >= limit ? "DEAD" : "RETRYABLE",
        lastError: message,
        leaseUntil: null,
      },
    });
    await handler.onError(payload, message);
  }
}

export async function processOutboxRow(rowId: string) {
  const row = await prisma.chainOutbox.findUnique({ where: { id: rowId } });
  if (!row) return;
  if (row.eventType in handlers) return processChainEvent(row);

  try {
    if (!getChainGateway().isEnabled()) {
      throw new Error("Solana disabled — leaving outbox for later");
    }
    const payload = row.payload as { ledgerEntryId: string; payloadHash: string };
    const { entry, hash, payload: rebuilt } = await recomputeAndVerifySettled(payload.ledgerEntryId);
    if (hash !== payload.payloadHash) {
      throw new Error("Payload hash drift — refusing to attest stale data");
    }

    const gateway = getChainGateway();
    const reconciled = await gateway.reconcileLedger({
      ledgerEntryId: entry.id,
      providerLabel: entry.toLabel,
      payload: rebuilt,
    });

    if (reconciled.hasFinal) {
      await prisma.$transaction([
        prisma.ledgerAttestation.update({
          where: { ledgerEntryId: entry.id },
          data: {
            pendingPda: reconciled.pendingPda,
            finalPda: reconciled.finalPda,
            payloadHash: hash,
            state: "FINALIZED",
            lastError: null,
            verifiedAt: new Date(),
          },
        }),
        prisma.chainOutbox.update({
          where: { id: row.id },
          data: { status: "FINALIZED", leaseUntil: null, lastError: null },
        }),
      ]);
      return;
    }

    // Withdrawn by the coordinator (cancel_pending): terminal, stop polling.
    if (reconciled.pendingStatus === ATTESTATION_CANCELLED) {
      await prisma.$transaction([
        prisma.ledgerAttestation.update({
          where: { ledgerEntryId: entry.id },
          data: {
            pendingPda: reconciled.pendingPda,
            state: "CANCELLED",
            lastError: null,
            verifiedAt: new Date(),
          },
        }),
        prisma.chainOutbox.update({
          where: { id: row.id },
          data: { status: "CANCELLED", leaseUntil: null, lastError: null },
        }),
      ]);
      return;
    }

    if (reconciled.hasPending) {
      await prisma.$transaction([
        prisma.ledgerAttestation.update({
          where: { ledgerEntryId: entry.id },
          data: {
            pendingPda: reconciled.pendingPda,
            payloadHash: hash,
            state: "AWAITING_COMMITTEE",
            lastError: null,
            verifiedAt: new Date(),
          },
        }),
        prisma.chainOutbox.update({
          where: { id: row.id },
          data: { status: "AWAITING_COMMITTEE", leaseUntil: null, lastError: null },
        }),
      ]);
      return;
    }

    // No on-chain account yet — keep waiting for coordinator Phantom submit.
    await prisma.$transaction([
      prisma.ledgerAttestation.upsert({
        where: { ledgerEntryId: entry.id },
        create: {
          ledgerEntryId: entry.id,
          payloadHash: hash,
          pendingPda: reconciled.pendingPda,
          state: "PENDING_SIGNATURE",
        },
        update: {
          payloadHash: hash,
          pendingPda: reconciled.pendingPda,
          state: "PENDING_SIGNATURE",
          lastError: null,
        },
      }),
      prisma.chainOutbox.update({
        where: { id: row.id },
        data: {
          status: "PENDING",
          leaseUntil: null,
          lastError: "Awaiting coordinator Phantom submit_attestation",
        },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown worker error";
    // Retrying cannot make a row attestable, so it goes straight to DEAD.
    const attempts = err instanceof LedgerNotAttestableError ? MAX_ATTEMPTS : row.attempts;
    await prisma.chainOutbox.update({
      where: { id: row.id },
      data: {
        status: attempts >= MAX_ATTEMPTS ? "DEAD" : "RETRYABLE",
        lastError: message,
        leaseUntil: null,
      },
    });
    await prisma.ledgerAttestation.updateMany({
      where: { ledgerEntryId: (row.payload as { ledgerEntryId?: string }).ledgerEntryId },
      data: {
        lastError: message,
        state: attempts >= MAX_ATTEMPTS ? "DEAD" : "RETRYABLE",
      },
    });
  }
}

export async function runWorkerOnce() {
  const rows = await claimOutboxBatch();
  for (const row of rows) {
    await processOutboxRow(row.id);
  }
  return rows.length;
}

export function startChainWorker() {
  const config = loadChainConfig();
  if (!config.workerEnabled) {
    console.log("[chain-worker] disabled (CHAIN_WORKER_ENABLED!=true)");
    return;
  }
  console.log("[chain-worker] started as reconciler (no mock submit)");
  setInterval(() => {
    runWorkerOnce().catch((err) => console.error("[chain-worker]", err));
  }, config.workerPollMs);
}
