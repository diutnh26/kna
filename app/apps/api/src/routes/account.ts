import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  establishSession,
  requireAuth,
  revokeSessions,
  type AuthedRequest,
} from "../middleware/auth";
import { explorerTxUrl, isLikelyFakeSignature } from "@kna/chain-client";
import { loadChainConfig } from "../chain/config";

export const accountRouter = Router();

type AttestationProof = {
  state: string;
  pendingTxSig: string | null;
  finalizeTxSig: string | null;
} | null;

/**
 * The proof half of a booking's impact receipt: which ledger row carries it,
 * how far its attestation has got, and an Explorer link only for a real,
 * verified signature (finalize first, else the pending submit).
 */
function proofOf(entry: { id: string; attestation: AttestationProof } | undefined) {
  if (!entry) return null;
  const sig = [entry.attestation?.finalizeTxSig, entry.attestation?.pendingTxSig].find(
    (s): s is string => Boolean(s) && !isLikelyFakeSignature(s!)
  );
  return {
    ledgerEntryId: entry.id,
    state: entry.attestation?.state ?? null,
    explorerUrl: sig ? explorerTxUrl(loadChainConfig().cluster, sig) : null,
  };
}

/**
 * A person's own account: who they are, and what they have done here.
 *
 * The activity half is not a convenience feature. This platform asks a
 * visitor to believe that most of what they pay reaches a household, and
 * publishes a ledger to prove it in aggregate. The same claim held to the
 * individual is "here is what *you* paid, and here is what reached them" —
 * which is a stronger argument than a public total, because it is
 * checkable against the receipt in their pocket.
 */

/** Money is only counted once it has actually moved — as on the ledger. */
const SETTLED_BOOKING = ["CONFIRMED", "COMPLETED"];
const SETTLED_ORDER = ["PAID", "FULFILLED"];

async function describeAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      locale: true,
      createdAt: true,
      committeeSeat: { select: { role: true, buon: true, since: true } },
      provider: { select: { id: true, displayName: true, type: true, buon: true, verified: true } },
    },
  });

  const [bookings, orders, contributions] = await Promise.all([
    prisma.booking.findMany({
      where: { guestId: userId },
      select: {
        status: true,
        totalVnd: true,
        communityFundVnd: true,
        providerPayoutVnd: true,
        offset: { select: { amountVnd: true, kgCo2e: true, mode: true } },
      },
    }),
    prisma.order.findMany({
      where: { buyerId: userId },
      select: { status: true, totalVnd: true, marketplaceFeeVnd: true },
    }),
    prisma.archiveEntry.count({ where: { contributedById: userId } }),
  ]);

  const settledBookings = bookings.filter((b) => SETTLED_BOOKING.includes(b.status));
  const settledOrders = orders.filter((o) => SETTLED_ORDER.includes(o.status));

  const isStaff = user.role === "COORDINATOR" || user.role === "ADMIN";
  const providerId = user.provider?.id ?? null;

  let providerMoney: {
    earnedVnd: number;
    fundVnd: number;
    platformVnd: number;
    bookings: number;
    pending: number;
  } | null = null;

  if (providerId) {
    const providerBookings = await prisma.booking.findMany({
      where: { listing: { providerId } },
      select: {
        status: true,
        providerPayoutVnd: true,
        communityFundVnd: true,
        platformFeeVnd: true,
      },
    });
    const confirmed = providerBookings.filter((b) => SETTLED_BOOKING.includes(b.status));
    providerMoney = {
      earnedVnd: confirmed.reduce((n, b) => n + b.providerPayoutVnd, 0),
      fundVnd: confirmed.reduce((n, b) => n + b.communityFundVnd, 0),
      platformVnd: confirmed.reduce((n, b) => n + b.platformFeeVnd, 0),
      bookings: confirmed.length,
      pending: providerBookings.filter((b) => b.status === "PENDING").length,
    };
  }

  let staffMoney: {
    settledBookingsVnd: number;
    toProvidersVnd: number;
    toFundVnd: number;
    paidWithDemo: number;
    awaitingPayment: number;
  } | null = null;

  if (isStaff) {
    const [allBookings, demoPaid] = await Promise.all([
      prisma.booking.findMany({
        where: { status: { in: SETTLED_BOOKING } },
        select: {
          totalVnd: true,
          providerPayoutVnd: true,
          communityFundVnd: true,
        },
      }),
      prisma.booking.count({
        where: { paymentStatus: "PAID", demoTxSigs: { not: null } },
      }),
    ]);
    const awaitingPayment = await prisma.booking.count({
      where: { paymentStatus: "AWAITING_PAYMENT" },
    });
    staffMoney = {
      settledBookingsVnd: allBookings.reduce((n, b) => n + b.totalVnd, 0),
      toProvidersVnd: allBookings.reduce((n, b) => n + b.providerPayoutVnd, 0),
      toFundVnd: allBookings.reduce((n, b) => n + b.communityFundVnd, 0),
      paidWithDemo: demoPaid,
      awaitingPayment,
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      locale: user.locale,
      memberSince: user.createdAt,
      isCommitteeMember: Boolean(user.committeeSeat),
      committeeRole: user.committeeSeat?.role ?? null,
      provider: user.provider,
    },
    moneyView: isStaff ? "staff" : providerId ? "provider" : "guest",
    providerMoney,
    staffMoney,
    totals: {
      bookings: bookings.length,
      bookingsAwaiting: bookings.filter((b) => b.status === "PENDING").length,
      orders: orders.length,
      ordersAwaiting: orders.filter((o) => o.status === "PENDING").length,
      contributions,
      // Settled only. Showing a pending booking as money spent would
      // overstate it in the person's own favour, which is the same error
      // the public ledger used to make in the platform's favour.
      // Includes settled offsets: the guest paid them, so leaving them out
      // would understate what this platform cost them.
      spentVnd:
        settledBookings.reduce((n, b) => n + b.totalVnd + (b.offset?.amountVnd ?? 0), 0) +
        settledOrders.reduce((n, o) => n + o.totalVnd, 0),
      // What actually reached the people they bought from. Artisans keep
      // 95% of a marketplace order; a booking's household share is stored.
      toProvidersVnd:
        settledBookings.reduce((n, b) => n + b.providerPayoutVnd, 0) +
        settledOrders.reduce((n, o) => n + (o.totalVnd - o.marketplaceFeeVnd), 0),
      toCommunityFundVnd: settledBookings.reduce((n, b) => n + b.communityFundVnd, 0),

      // Offsets are counted apart from the rest, not folded into it. An
      // offset takes no commission and no Fund share — the whole amount
      // reaches the project — so adding it to `toProvidersVnd` would
      // credit a household with money that went to a planting site.
      offsets: bookings.filter((b) => b.offset).length,
      // The commitments a guest has actually made to turn up and work,
      // which is the part they will want reminding of.
      // Both modes that involve turning up count: joining a session during
      // the stay, and coming back for the next one.
      offsetsJoining: bookings.filter(
        (b) => b.offset?.mode === "IN_PERSON" || b.offset?.mode === "NEXT_SESSION"
      ).length,
      offsetKgCo2e: settledBookings.reduce((n, b) => n + (b.offset?.kgCo2e ?? 0), 0),
      toOffsetProjectsVnd: settledBookings.reduce((n, b) => n + (b.offset?.amountVnd ?? 0), 0),
    },
  };
}

accountRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  res.json(await describeAccount(req.user!.id));
});

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "A name is required.").max(120).optional(),
  locale: z.enum(["en", "vi"]).optional(),
});

/**
 * Name and language only.
 *
 * Email is deliberately not editable here. It is the login identifier and
 * the only route back into an account, and changing it safely needs
 * confirmation sent to the new address — which needs email delivery, which
 * this project does not have yet. An endpoint that changed it without that
 * step could lock someone out of their own bookings.
 */
accountRouter.patch("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: "Nothing to update." });
  }

  await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
  res.json(await describeAccount(req.user!.id));
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many attempts. Wait a few minutes and try again." },
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Your current password is required."),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "New password must include a letter.")
    .regex(/\d/, "New password must include a digit."),
});

/**
 * Changing a password ends every other session.
 *
 * The usual reason someone changes one is that they think somebody else
 * has it. Leaving that somebody signed in for the remaining days of their
 * token would defeat the point of the change.
 */
accountRouter.post("/password", requireAuth, passwordLimiter, async (req: AuthedRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!user.passwordHash) {
    return res.status(400).json({
      error: "This account signs in with Google and has no password to change.",
    });
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(403).json({ error: "That is not your current password." });
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return res.status(400).json({ error: "The new password must be different." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  await revokeSessions(user.id);

  // The caller's own session was just invalidated — re-issue cookies so
  // this tab stays signed in after the change.
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const token = await establishSession(res, updated);
  res.json({ token });
});

/**
 * One timeline rather than three lists.
 *
 * A person does not think of their bookings, their orders and their
 * archive contributions as separate systems — they think "what have I done
 * here". Merging them server-side also keeps the sort honest: three lists
 * sorted independently and stacked would read as chronological without
 * being so.
 */
accountRouter.get("/activity", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      role: true,
      provider: { select: { id: true } },
    },
  });
  const isStaff = me.role === "COORDINATOR" || me.role === "ADMIN";
  const providerId = me.provider?.id ?? null;

  // Guest: own trips. Provider: own trips + stays on their listings.
  // Staff: platform-wide recent bookings (incl. demo mint history).
  const bookingWhere = isStaff
    ? {}
    : providerId
      ? { OR: [{ guestId: userId }, { listing: { providerId } }] }
      : { guestId: userId };

  const [bookings, orders, contributions] = await Promise.all([
    prisma.booking.findMany({
      where: bookingWhere,
      include: {
        listing: {
          select: {
            title: true,
            imageUrl: true,
            provider: { select: { displayName: true, buon: true } },
          },
        },
        guest: { select: { fullName: true, email: true } },
        offset: true,
        ledgerEntries: {
          where: { voidedAt: null },
          select: {
            id: true,
            attestation: {
              select: { state: true, pendingTxSig: true, finalizeTxSig: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: isStaff ? 60 : 40,
    }),
    prisma.order.findMany({
      where: providerId
        ? {
            OR: [
              { buyerId: userId },
              { items: { some: { product: { providerId } } } },
            ],
          }
        : { buyerId: userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                title: true,
                imageUrl: true,
                provider: { select: { displayName: true, buon: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.archiveEntry.findMany({
      where: { contributedById: userId },
      select: {
        id: true,
        title: true,
        type: true,
        imageUrl: true,
        moderationStatus: true,
        moderationNote: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const timeline = [
    ...bookings.map((b) => ({
      kind: "booking" as const,
      id: b.id,
      at: b.createdAt,
      status: b.status,
      title: b.listing.title,
      imageUrl: b.listing.imageUrl,
      from: b.listing.provider.displayName,
      buon: b.listing.provider.buon,
      guestName: b.guest.fullName,
      checkIn: b.checkIn,
      nights: b.nights,
      guests: b.guests,
      totalVnd: b.totalVnd,
      toProviderVnd: b.providerPayoutVnd,
      toCommunityFundVnd: b.communityFundVnd,
      platformFeeVnd: b.platformFeeVnd,
      proof: proofOf(b.ledgerEntries[0]),
      paymentRef: b.paymentRef,
      paymentStatus: b.paymentStatus,
      demoTxSigs: (() => {
        if (!b.demoTxSigs) return [] as string[];
        try {
          const parsed = JSON.parse(b.demoTxSigs);
          return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
          return [] as string[];
        }
      })(),
      offset: b.offset
        ? {
            projectId: b.offset.projectId,
            kgCo2e: b.offset.kgCo2e,
            amountVnd: b.offset.amountVnd,
            mode: b.offset.mode,
            origin: b.offset.origin,
            sessionStart: b.offset.sessionStart,
            sessionEnd: b.offset.sessionEnd,
          }
        : null,
    })),
    ...orders.map((o) => {
      const first = o.items[0]?.product;
      return {
        kind: "order" as const,
        id: o.id,
        at: o.createdAt,
        status: o.status,
        title: first?.title ?? "Order",
        imageUrl: first?.imageUrl ?? null,
        from: first?.provider.displayName ?? null,
        buon: first?.provider.buon ?? null,
        itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
        totalVnd: o.totalVnd,
        toProviderVnd: o.totalVnd - o.marketplaceFeeVnd,
        toCommunityFundVnd: 0,
      };
    }),
    ...contributions.map((c) => ({
      kind: "contribution" as const,
      id: c.id,
      at: c.createdAt,
      status: c.moderationStatus,
      title: c.title,
      imageUrl: c.imageUrl,
      entryType: c.type,
      moderationNote: c.moderationNote,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  res.json(timeline);
});
