import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Writing notifications.
 *
 * The rule this file exists to hold: a notification is a side effect of
 * something that happened, and it must never be the reason the thing
 * fails. A guest's booking is confirmed whether or not the row telling
 * them so gets written — so every call here is best-effort, and a failure
 * is logged rather than thrown.
 *
 * The counterpart rule is that they are written inside the same
 * transaction as the change they describe wherever a transaction exists,
 * so a confirmation cannot be announced for a booking that was rolled
 * back.
 */

export type NotificationType =
  // to the guest
  | "BOOKING_CONFIRMED"
  | "BOOKING_DECLINED"
  | "ORDER_SETTLED"
  | "ORDER_CANCELLED"
  | "ARCHIVE_PUBLISHED"
  | "ARCHIVE_REJECTED"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "BOOKING_PAID"
  | "TOPUP_CREDITED"
  // to the guest, the household and coordinators
  | "BOOKING_UNPAID"
  // to the household whose listing was booked
  | "BOOKING_RECEIVED"
  // to whoever has to act
  | "BOOKING_AWAITING_DECISION"
  | "ORDER_AWAITING_SETTLEMENT"
  | "ARCHIVE_AWAITING_REVIEW";

type Db = PrismaClient | Prisma.TransactionClient;

interface NotifyInput {
  userId: string;
  type: NotificationType;
  /** Interpolation values for the i18n key named by `type`. */
  params?: Record<string, string | number>;
  href?: string;
}

/**
 * Adds one notification. Never throws.
 *
 * Callers are in the middle of confirming a booking or publishing an
 * archive entry; none of them should have to decide what to do when the
 * announcement fails.
 */
export async function notify(db: Db, input: NotifyInput): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        params: (input.params ?? {}) as Prisma.InputJsonValue,
        href: input.href ?? null,
      },
    });
  } catch (err) {
    console.error("notification not written:", input.type, err);
  }
}

/** Adds the same notification for several people, e.g. every coordinator. */
export async function notifyAll(db: Db, userIds: string[], input: Omit<NotifyInput, "userId">) {
  await Promise.all(userIds.map((userId) => notify(db, { ...input, userId })));
}

/**
 * Everyone who can act on a booking or an order awaiting a decision.
 *
 * Committee members are included because in the pilot the same people
 * often are the coordinators — the same reasoning as requireCoordinator,
 * which lets a seat stand in for the role.
 */
export async function coordinatorIds(): Promise<string[]> {
  const [byRole, bySeat] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["COORDINATOR", "ADMIN"] } },
      select: { id: true },
    }),
    prisma.committeeMember.findMany({ select: { userId: true } }),
  ]);
  return [...new Set([...byRole.map((u) => u.id), ...bySeat.map((m) => m.userId)])];
}

/** Everyone who may review an archive submission. */
export async function reviewerIds(): Promise<string[]> {
  const [admins, seats] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
    prisma.committeeMember.findMany({ select: { userId: true } }),
  ]);
  return [...new Set([...admins.map((u) => u.id), ...seats.map((m) => m.userId)])];
}
