import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Outbox events for bookings on-chain. Kept apart from bookings-onchain.ts
 * (which talks to Solana) so routes can queue work without importing RPC.
 */

type Db = PrismaClient | Prisma.TransactionClient;

async function enqueue(db: Db, eventType: string, key: string, payload: Prisma.InputJsonValue) {
  if (process.env.SOLANA_ENABLED !== "true") return;
  await db.chainOutbox.upsert({
    where: { idempotencyKey: key },
    create: { eventType, idempotencyKey: key, payload, status: "PENDING" },
    update: {},
  });
}

/** create_booking, once the guest's and provider's accounts are registered. */
export const enqueueBookingRecord = (db: Db, bookingId: string) =>
  enqueue(db, "BOOKING_RECORD", `booking:${bookingId}:record`, { bookingId });

export const enqueueBookingCancel = (db: Db, bookingId: string) =>
  enqueue(db, "BOOKING_CANCEL", `booking:${bookingId}:cancel`, { bookingId });
