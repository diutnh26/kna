import { prisma } from "../lib/prisma";
import { loadChainConfig } from "./config";
import { getChainGateway } from "./gateway";
import { recomputeAndVerifySettled } from "./outbox";

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

export async function processOutboxRow(rowId: string) {
  const row = await prisma.chainOutbox.findUnique({ where: { id: rowId } });
  if (!row) return;

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
    const attempts = row.attempts;
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
