import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { BOOKING_STATUSES, LISTING_CATEGORIES, MODERATION_STATUSES, ORDER_STATUSES, PRODUCT_CATEGORIES, PROVIDER_TYPES, ROLES } from "../lib/enums";
import {
  createListing,
  createProduct,
  imageUrlSchema,
  listingCreateSchema,
  listingUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  removeListing,
  removeProduct,
  setAvailability,
  updateListing,
  updateProduct,
} from "../lib/catalog";
import { cancelBooking, decideOrder } from "../lib/decisions";
import { voidLedgerEntries, PAID_BOOKING_STATUSES } from "../lib/ledger";
import { notify, notifyAll, reviewerIds } from "../lib/notify";
import { creditTopUp } from "../lib/topups";
import { passwordPolicy } from "../lib/password";
import { enqueueBookingRecord } from "../chain/bookings-onchain-queue";
import { enqueueAccountRegistration, provisionAndRegister } from "../chain/wallets";
import { resetPaymentWallet } from "../chain/accounts-onchain";
import { AdminError, type Field, type Resource, type Row } from "./engine";

type Tx = Prisma.TransactionClient;

// ── Helpers ──────────────────────────────────────────────────────────

/** End every session of an account (its authority just shrank). */
async function revokeSessions(tx: Tx, userId: string) {
  await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** There must always be one active admin, and it cannot be yourself you lock out. */
async function guardAdminLoss(tx: Tx, actorId: string, target: Row, what: string) {
  if (target.role !== "ADMIN") return;
  if (target.id === actorId) throw new AdminError(`You cannot ${what} your own admin account.`);
  const others = await tx.user.count({ where: { role: "ADMIN", disabledAt: null, id: { not: target.id } } });
  if (others === 0) throw new AdminError(`The platform needs at least one active admin; you cannot ${what} the last one.`);
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

/** Re-open a chain job that gave up, so the worker tries it again. */
async function reviveOutbox(tx: Tx, idempotencyKey: string) {
  await tx.chainOutbox.updateMany({
    where: { idempotencyKey, status: { in: ["DEAD", "RETRYABLE"] } },
    data: { status: "PENDING", attempts: 0, leaseUntil: null, lastError: null },
  });
}

// Content edited by an admin goes back to the Committee: publishing is
// theirs to decide, including publishing a changed version.
async function backToReview(ctx: { after: (fn: () => Promise<unknown>) => void }, title: string, type: string) {
  ctx.after(async () =>
    notifyAll(prisma, await reviewerIds(), {
      type: "ARCHIVE_AWAITING_REVIEW",
      params: { title, type },
      href: "#review",
    })
  );
}

// ── People ───────────────────────────────────────────────────────────

const users: Resource = {
  name: "users",
  group: "people",
  model: "user",
  titleField: "email",
  fields: [
    { name: "email", type: "text", list: true, create: true, required: true },
    { name: "fullName", type: "text", list: true, create: true, edit: true, required: true },
    { name: "role", type: "select", options: ROLES, list: true, create: true, edit: true, required: true },
    { name: "locale", type: "select", options: ["en", "vi"], create: true, edit: true },
    { name: "password", type: "password", create: true, required: true },
    { name: "emailVerified", type: "boolean", list: true, edit: true },
    { name: "disabledAt", type: "datetime", list: true },
    { name: "createdAt", type: "datetime", list: true },
  ],
  search: ["email", "fullName"],
  filters: ["role"],
  sort: { field: "createdAt", dir: "desc" },
  hidden: ["passwordHash", "emailVerifyToken", "emailVerifyExpiry", "tokenVersion", "googleSub"],
  create: {
    schema: z.object({
      email: z.string().trim().toLowerCase().email(),
      fullName: z.string().trim().min(1).max(120),
      role: z.enum(ROLES),
      locale: z.enum(["en", "vi"]).default("en"),
      password: passwordPolicy,
    }),
    async run(ctx, input) {
      const email = input.email as string;
      if (await ctx.tx.user.findUnique({ where: { email } })) {
        throw new AdminError("An account with that email already exists.");
      }
      const user = await ctx.tx.user.create({
        data: {
          email,
          fullName: input.fullName as string,
          role: input.role as string,
          locale: input.locale as string,
          passwordHash: await bcrypt.hash(input.password as string, 10),
          emailVerified: true,
        },
      });
      ctx.after(() => provisionAndRegister(user.id));
      return user;
    },
  },
  update: {
    schema: z.object({
      fullName: z.string().trim().min(1).max(120).optional(),
      role: z.enum(ROLES).optional(),
      locale: z.enum(["en", "vi"]).optional(),
      emailVerified: z.boolean().optional(),
    }),
    async run(ctx, row, input) {
      const roleChanges = input.role !== undefined && input.role !== row.role;
      if (roleChanges && row.role === "ADMIN") await guardAdminLoss(ctx.tx, ctx.actor.id, row, "remove the admin role from");
      const updated = await ctx.tx.user.update({ where: { id: row.id }, data: input });
      if (roleChanges) await revokeSessions(ctx.tx, row.id);
      return updated as unknown as Row;
    },
  },
  async remove(ctx, row) {
    await guardAdminLoss(ctx.tx, ctx.actor.id, row, "delete");
    const id = row.id;
    const [bookings, orders, topUps, provider, seat, contributed, moderated, wallet] = await Promise.all([
      ctx.tx.booking.count({ where: { guestId: id } }),
      ctx.tx.order.count({ where: { buyerId: id } }),
      ctx.tx.topUp.count({ where: { userId: id } }),
      ctx.tx.provider.findUnique({ where: { userId: id } }),
      ctx.tx.committeeMember.findUnique({ where: { userId: id } }),
      ctx.tx.archiveEntry.count({ where: { contributedById: id } }),
      ctx.tx.archiveEntry.count({ where: { moderatedById: id } }),
      ctx.tx.wallet.findUnique({ where: { userId: id } }),
    ]);
    const reasons = [
      bookings && `${bookings} booking(s)`,
      orders && `${orders} order(s)`,
      topUps && `${topUps} top-up(s)`,
      provider && "a provider profile",
      seat && "a Committee seat",
      (contributed || moderated) && "archive records",
      wallet?.registeredTx && "a wallet registered on-chain",
    ].filter(Boolean);
    if (reasons.length > 0) {
      await ctx.tx.user.update({ where: { id }, data: { disabledAt: new Date() } });
      await revokeSessions(ctx.tx, id);
      return { outcome: "disabled", reason: `kept because it has ${reasons.join(", ")}` };
    }
    await ctx.tx.notification.deleteMany({ where: { userId: id } });
    await ctx.tx.refreshToken.deleteMany({ where: { userId: id } });
    await ctx.tx.walletLink.deleteMany({ where: { userId: id } });
    await ctx.tx.wallet.deleteMany({ where: { userId: id } });
    await ctx.tx.chainOutbox.deleteMany({ where: { idempotencyKey: `account:${id}:register` } });
    await ctx.tx.user.delete({ where: { id } });
    return { outcome: "deleted" };
  },
  actions: [
    {
      name: "disable",
      reason: true,
      danger: true,
      when: (row) => !row.disabledAt,
      async run(ctx, row) {
        await guardAdminLoss(ctx.tx, ctx.actor.id, row, "disable");
        await ctx.tx.user.update({ where: { id: row.id }, data: { disabledAt: new Date() } });
        await revokeSessions(ctx.tx, row.id);
      },
    },
    {
      name: "enable",
      when: (row) => Boolean(row.disabledAt),
      async run(ctx, row) {
        await ctx.tx.user.update({ where: { id: row.id }, data: { disabledAt: null } });
      },
    },
    {
      name: "signOutEverywhere",
      async run(ctx, row) {
        await revokeSessions(ctx.tx, row.id);
      },
    },
    {
      name: "setPassword",
      fields: [{ name: "password", type: "password", required: true }],
      schema: z.object({ password: passwordPolicy }),
      async run(ctx, row, input) {
        await ctx.tx.user.update({
          where: { id: row.id },
          data: { passwordHash: await bcrypt.hash(input.password as string, 10) },
        });
        await revokeSessions(ctx.tx, row.id);
      },
    },
  ],
};

const providerFields = z.object({
  type: z.enum(PROVIDER_TYPES),
  displayName: z.string().trim().min(1).max(120),
  buon: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(2000).nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  verified: z.boolean().optional(),
});

const providers: Resource = {
  name: "providers",
  group: "people",
  model: "provider",
  titleField: "displayName",
  include: { user: { select: { email: true, fullName: true } } },
  fields: [
    { name: "imageUrl", type: "image", list: true, create: true, edit: true },
    { name: "displayName", type: "text", list: true, create: true, edit: true, required: true },
    { name: "userId", type: "ref", ref: "users", display: "user.email", list: true, create: true, required: true },
    { name: "type", type: "select", options: PROVIDER_TYPES, list: true, create: true, edit: true, required: true },
    { name: "buon", type: "text", list: true, create: true, edit: true, required: true },
    { name: "bio", type: "textarea", create: true, edit: true },
    { name: "verified", type: "boolean", list: true, create: true, edit: true },
    { name: "createdAt", type: "datetime" },
  ],
  search: ["displayName", "buon"],
  filters: ["type", "verified"],
  sort: { field: "createdAt", dir: "desc" },
  create: {
    schema: providerFields.extend({ userId: z.string().min(1) }),
    async run(ctx, input) {
      const user = await ctx.tx.user.findUnique({ where: { id: input.userId as string }, include: { provider: true } });
      if (!user) throw new AdminError("That user does not exist.", 404);
      if (user.provider) throw new AdminError("That user already has a provider profile.");
      if (user.role === "GUEST") await ctx.tx.user.update({ where: { id: user.id }, data: { role: "PROVIDER" } });
      return ctx.tx.provider.create({ data: input as Prisma.ProviderUncheckedCreateInput });
    },
  },
  update: {
    schema: providerFields.partial(),
    async run(ctx, row, input) {
      return (await ctx.tx.provider.update({ where: { id: row.id }, data: input })) as unknown as Row;
    },
  },
  async remove(ctx, row) {
    const [listings, products] = await Promise.all([
      ctx.tx.listing.count({ where: { providerId: row.id } }),
      ctx.tx.product.count({ where: { providerId: row.id } }),
    ]);
    if (listings + products > 0) {
      await ctx.tx.provider.update({ where: { id: row.id }, data: { verified: false } });
      await ctx.tx.listing.updateMany({ where: { providerId: row.id }, data: { published: false } });
      await ctx.tx.product.updateMany({ where: { providerId: row.id }, data: { published: false } });
      return { outcome: "unpublished", reason: "unverified and every listing and product unpublished; they have history" };
    }
    await ctx.tx.provider.delete({ where: { id: row.id } });
    const user = await ctx.tx.user.findUnique({ where: { id: row.userId as string } });
    if (user?.role === "PROVIDER") {
      await ctx.tx.user.update({ where: { id: user.id }, data: { role: "GUEST" } });
      await revokeSessions(ctx.tx, user.id);
    }
    return { outcome: "deleted" };
  },
};

const seatFields = z.object({
  role: z.string().trim().min(1).max(120),
  buon: z.string().trim().min(1).max(120),
  since: z.string().trim().min(1).max(40),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const committee: Resource = {
  name: "committee",
  group: "people",
  model: "committeeMember",
  titleField: "role",
  include: { user: { select: { email: true, fullName: true } } },
  notice:
    "A seat here gives review rights on the platform. It does not change the Committee's Squads multisig on devnet, which its members manage themselves.",
  fields: [
    { name: "userId", type: "ref", ref: "users", display: "user.fullName", list: true, create: true, required: true },
    { name: "role", type: "text", list: true, create: true, edit: true, required: true },
    { name: "buon", type: "text", list: true, create: true, edit: true, required: true },
    { name: "since", type: "text", list: true, create: true, edit: true, required: true },
    { name: "sortOrder", type: "number", list: true, create: true, edit: true },
  ],
  search: ["role", "buon"],
  sort: { field: "sortOrder", dir: "asc" },
  create: {
    schema: seatFields.extend({ userId: z.string().min(1) }),
    async run(ctx, input) {
      const user = await ctx.tx.user.findUnique({ where: { id: input.userId as string }, include: { committeeSeat: true } });
      if (!user) throw new AdminError("That user does not exist.", 404);
      if (user.committeeSeat) throw new AdminError("That user already holds a seat.");
      return ctx.tx.committeeMember.create({ data: input as Prisma.CommitteeMemberUncheckedCreateInput });
    },
  },
  update: {
    schema: seatFields.partial(),
    async run(ctx, row, input) {
      return (await ctx.tx.committeeMember.update({ where: { id: row.id }, data: input })) as unknown as Row;
    },
  },
  async remove(ctx, row) {
    await ctx.tx.committeeMember.delete({ where: { id: row.id } });
    await revokeSessions(ctx.tx, row.userId as string);
    return { outcome: "deleted" };
  },
};

const wallets: Resource = {
  name: "wallets",
  group: "people",
  model: "wallet",
  titleField: "pubkey",
  include: { user: { select: { email: true } } },
  fields: [
    { name: "userId", type: "ref", ref: "users", display: "user.email", list: true },
    { name: "pubkey", type: "mono", list: true },
    { name: "registeredTx", type: "mono", list: true },
    { name: "registeredAt", type: "datetime" },
    { name: "registerError", type: "text" },
    { name: "createdAt", type: "datetime" },
  ],
  search: ["pubkey"],
  sort: { field: "createdAt", dir: "desc" },
  hidden: ["encryptedSecret"],
  actions: [
    {
      name: "retryRegistration",
      when: (row) => !row.registeredTx,
      async run(ctx, row) {
        await enqueueAccountRegistration(ctx.tx, row.userId as string);
        await reviveOutbox(ctx.tx, `account:${row.userId}:register`);
      },
    },
  ],
};

const walletLinks: Resource = {
  name: "walletLinks",
  group: "people",
  model: "walletLink",
  titleField: "pubkey",
  include: { user: { select: { email: true } } },
  fields: [
    { name: "userId", type: "ref", ref: "users", display: "user.email", list: true },
    { name: "pubkey", type: "mono", list: true },
    { name: "isDefault", type: "boolean", list: true },
    { name: "linkedAt", type: "datetime", list: true },
    { name: "paymentWalletTx", type: "mono" },
  ],
  search: ["pubkey"],
  sort: { field: "linkedAt", dir: "desc" },
  hidden: ["challengeNonce", "challengeExpiry", "linkVersion"],
  actions: [
    {
      name: "unlink",
      reason: true,
      danger: true,
      transactional: false,
      async run(_ctx, row) {
        // A Phantom that pays bookings is named on-chain; point the account
        // back at its fixed wallet first, or its next payment would fail.
        if (row.isDefault) await resetPaymentWallet(row.userId as string);
        await prisma.walletLink.delete({ where: { id: row.id } });
      },
    },
  ],
};

// ── Catalogue ────────────────────────────────────────────────────────

const rangeFields: Field[] = [
  { name: "from", type: "date", required: true },
  { name: "to", type: "date", required: true },
];

const listings: Resource = {
  name: "listings",
  group: "catalog",
  model: "listing",
  titleField: "title",
  include: { provider: { select: { displayName: true } } },
  fields: [
    { name: "imageUrl", type: "image", list: true, create: true, edit: true },
    { name: "title", type: "text", list: true, create: true, edit: true, required: true },
    { name: "providerId", type: "ref", ref: "providers", display: "provider.displayName", list: true, create: true, required: true },
    { name: "category", type: "select", options: LISTING_CATEGORIES, list: true, create: true, edit: true, required: true },
    { name: "priceVnd", type: "money", list: true, create: true, edit: true, required: true },
    { name: "unit", type: "select", options: ["per night", "per person"], create: true, edit: true, required: true },
    { name: "inventory", type: "number", list: true, create: true, edit: true, required: true },
    { name: "maxGuestsPerRoom", type: "number", create: true, edit: true, required: true },
    { name: "published", type: "boolean", list: true, create: true, edit: true },
    { name: "blurb", type: "textarea", create: true, edit: true, required: true },
    { name: "duration", type: "text", create: true, edit: true, required: true },
    { name: "groupSize", type: "text", create: true, edit: true, required: true },
    { name: "carbonRating", type: "text", create: true, edit: true, required: true },
    { name: "customs", type: "textarea", create: true, edit: true },
    { name: "createdAt", type: "datetime" },
  ],
  search: ["title", "blurb"],
  filters: ["category", "published", "providerId"],
  sort: { field: "createdAt", dir: "desc" },
  create: {
    schema: listingCreateSchema.extend({ providerId: z.string().min(1) }),
    async run(ctx, input) {
      const { providerId, ...data } = input as z.infer<typeof listingCreateSchema> & { providerId: string };
      if (!(await ctx.tx.provider.findUnique({ where: { id: providerId } }))) {
        throw new AdminError("That provider does not exist.", 404);
      }
      return createListing(ctx.tx, providerId, data);
    },
  },
  update: {
    schema: listingUpdateSchema,
    async run(ctx, row, input) {
      return (await updateListing(ctx.tx, row as never, input)) as unknown as Row;
    },
  },
  remove: (ctx, row) => removeListing(ctx.tx, row as never),
  actions: [
    {
      name: "openDays",
      fields: rangeFields,
      schema: z.object({ from: ymd, to: ymd }),
      async run(ctx, row, input) {
        return { days: await setAvailability(ctx.tx, row as never, { ...(input as { from: string; to: string }), open: true }) };
      },
    },
    {
      name: "closeDays",
      fields: rangeFields,
      schema: z.object({ from: ymd, to: ymd }),
      async run(ctx, row, input) {
        return { days: await setAvailability(ctx.tx, row as never, { ...(input as { from: string; to: string }), open: false }) };
      },
    },
  ],
};

const products: Resource = {
  name: "products",
  group: "catalog",
  model: "product",
  titleField: "title",
  include: { provider: { select: { displayName: true } } },
  fields: [
    { name: "imageUrl", type: "image", list: true, create: true, edit: true },
    { name: "title", type: "text", list: true, create: true, edit: true, required: true },
    { name: "providerId", type: "ref", ref: "providers", display: "provider.displayName", list: true, create: true, required: true },
    { name: "category", type: "select", options: PRODUCT_CATEGORIES, list: true, create: true, edit: true, required: true },
    { name: "priceVnd", type: "money", list: true, create: true, edit: true, required: true },
    { name: "stock", type: "number", list: true, create: true, edit: true, required: true },
    { name: "published", type: "boolean", list: true, create: true, edit: true },
    { name: "note", type: "textarea", create: true, edit: true, required: true },
    { name: "createdAt", type: "datetime" },
  ],
  search: ["title", "note"],
  filters: ["category", "published", "providerId"],
  sort: { field: "createdAt", dir: "desc" },
  create: {
    schema: productCreateSchema.extend({ providerId: z.string().min(1) }),
    async run(ctx, input) {
      const { providerId, ...data } = input as z.infer<typeof productCreateSchema> & { providerId: string };
      if (!(await ctx.tx.provider.findUnique({ where: { id: providerId } }))) {
        throw new AdminError("That provider does not exist.", 404);
      }
      return createProduct(ctx.tx, providerId, data);
    },
  },
  update: {
    schema: productUpdateSchema,
    async run(ctx, row, input) {
      return (await updateProduct(ctx.tx, row as never, input)) as unknown as Row;
    },
  },
  remove: (ctx, row) => removeProduct(ctx.tx, row as never),
};

// ── Money (actions only) ─────────────────────────────────────────────

const bookings: Resource = {
  name: "bookings",
  group: "money",
  model: "booking",
  titleField: "id",
  include: { listing: { select: { title: true } }, guest: { select: { email: true } } },
  fields: [
    { name: "id", type: "mono", list: true },
    { name: "listingId", type: "ref", ref: "listings", display: "listing.title", list: true },
    { name: "guestId", type: "ref", ref: "users", display: "guest.email", list: true },
    { name: "status", type: "select", options: BOOKING_STATUSES, list: true },
    { name: "checkIn", type: "date", list: true },
    { name: "checkOut", type: "date" },
    { name: "nights", type: "number" },
    { name: "rooms", type: "number" },
    { name: "guests", type: "number" },
    { name: "totalVnd", type: "money", list: true },
    { name: "providerPayoutVnd", type: "money" },
    { name: "communityFundVnd", type: "money" },
    { name: "platformFeeVnd", type: "money" },
    { name: "onchainTx", type: "mono" },
    { name: "onchainError", type: "text" },
    { name: "payTx", type: "mono" },
    { name: "reminderStage", type: "number" },
    { name: "decidedVia", type: "text" },
    { name: "createdAt", type: "datetime" },
  ],
  search: ["id"],
  filters: ["status", "listingId", "guestId"],
  sort: { field: "createdAt", dir: "desc" },
  actions: [
    {
      name: "cancel",
      reason: true,
      danger: true,
      transactional: false,
      when: (row) =>
        ["PENDING", "CONFIRMED"].includes(row.status as string) && new Date(row.checkIn as string) > todayUtc(),
      async run(ctx, row) {
        return cancelBooking(row.id, ctx.actor.id, "ADMIN", `cancelled by admin: ${ctx.reason}`);
      },
    },
    {
      name: "retryOnchainRecord",
      when: (row) => !row.onchainTx && ["CONFIRMED", "UNPAID"].includes(row.status as string),
      async run(ctx, row) {
        await enqueueBookingRecord(ctx.tx, row.id);
        await reviveOutbox(ctx.tx, `booking:${row.id}:record`);
      },
    },
  ],
};

const orders: Resource = {
  name: "orders",
  group: "money",
  model: "order",
  titleField: "id",
  include: { buyer: { select: { email: true } } },
  fields: [
    { name: "id", type: "mono", list: true },
    { name: "buyerId", type: "ref", ref: "users", display: "buyer.email", list: true },
    { name: "status", type: "select", options: ORDER_STATUSES, list: true },
    { name: "totalVnd", type: "money", list: true },
    { name: "marketplaceFeeVnd", type: "money" },
    { name: "paymentStatus", type: "text" },
    { name: "paymentRef", type: "mono" },
    { name: "decidedVia", type: "text" },
    { name: "createdAt", type: "datetime", list: true },
  ],
  search: ["id", "paymentRef"],
  filters: ["status"],
  sort: { field: "createdAt", dir: "desc" },
  actions: [
    {
      name: "settle",
      transactional: false,
      when: (row) => row.status === "PENDING",
      run: (ctx, row) => decideOrder(row.id, "settle", ctx.actor.id, "ADMIN"),
    },
    {
      name: "cancel",
      reason: true,
      danger: true,
      transactional: false,
      when: (row) => row.status === "PENDING",
      run: (ctx, row) => decideOrder(row.id, "cancel", ctx.actor.id, "ADMIN"),
    },
  ],
};

const ledger: Resource = {
  name: "ledger",
  group: "money",
  model: "ledgerEntry",
  titleField: "id",
  include: { attestation: { select: { state: true } } },
  fields: [
    { name: "id", type: "mono", list: true },
    { name: "fromLabel", type: "text", list: true },
    { name: "toLabel", type: "text", list: true },
    { name: "totalVnd", type: "money", list: true },
    { name: "platformFeeVnd", type: "money" },
    { name: "communityFundVnd", type: "money" },
    { name: "bookingId", type: "mono" },
    { name: "orderId", type: "mono" },
    { name: "offsetId", type: "mono" },
    { name: "createdAt", type: "datetime", list: true },
    { name: "voidedAt", type: "datetime", list: true },
    { name: "voidReason", type: "text" },
  ],
  search: ["fromLabel", "toLabel", "id"],
  sort: { field: "createdAt", dir: "desc" },
  actions: [
    {
      // Append-only: a row that no longer stands is voided, never deleted.
      // One already attested on-chain stays — its proof is public.
      name: "void",
      reason: true,
      danger: true,
      when: (row) => !row.voidedAt && !row.attestation,
      async run(ctx, row) {
        await voidLedgerEntries(ctx.tx, { id: row.id }, `voided by admin: ${ctx.reason}`, ctx.actor.id);
      },
    },
  ],
};

const offsets: Resource = {
  name: "offsets",
  group: "money",
  model: "offsetContribution",
  titleField: "id",
  include: { booking: { select: { status: true } } },
  fields: [
    { name: "bookingId", type: "ref", ref: "bookings", list: true },
    { name: "projectId", type: "text", list: true },
    { name: "mode", type: "text", list: true },
    { name: "kgCo2e", type: "number", list: true },
    { name: "amountVnd", type: "money", list: true },
    { name: "origin", type: "text" },
    { name: "createdAt", type: "datetime", list: true },
  ],
  search: ["bookingId", "projectId"],
  filters: ["projectId", "mode"],
  sort: { field: "createdAt", dir: "desc" },
  actions: [
    {
      name: "withdraw",
      reason: true,
      danger: true,
      when: (row) => !PAID_BOOKING_STATUSES.includes((row.booking as { status: string } | null)?.status ?? ""),
      async run(ctx, row) {
        await voidLedgerEntries(ctx.tx, { offsetId: row.id }, `offset withdrawn by admin: ${ctx.reason}`, ctx.actor.id, {
          offsetId: null,
        });
        await ctx.tx.offsetContribution.delete({ where: { id: row.id } });
      },
    },
  ],
};

const topups: Resource = {
  name: "topups",
  group: "money",
  model: "topUp",
  titleField: "id",
  include: { user: { select: { email: true } } },
  fields: [
    { name: "userId", type: "ref", ref: "users", display: "user.email", list: true },
    { name: "source", type: "select", options: ["VIETQR", "FAUCET"], list: true },
    { name: "amountVnd", type: "money", list: true },
    { name: "status", type: "select", options: ["AWAITING_PAYMENT", "PAID", "CREDITED", "FAILED"], list: true },
    { name: "paymentRef", type: "mono" },
    { name: "mintTx", type: "mono" },
    { name: "error", type: "text" },
    { name: "createdAt", type: "datetime", list: true },
    { name: "paidAt", type: "datetime" },
  ],
  search: ["paymentRef", "id"],
  filters: ["status", "source"],
  sort: { field: "createdAt", dir: "desc" },
  actions: [
    {
      name: "retryCredit",
      transactional: false,
      when: (row) => row.status === "PAID",
      run: (_ctx, row) => creditTopUp(row.id),
    },
    {
      name: "markFailed",
      reason: true,
      danger: true,
      when: (row) => row.status === "AWAITING_PAYMENT",
      async run(ctx, row) {
        await ctx.tx.topUp.update({ where: { id: row.id }, data: { status: "FAILED", error: `admin: ${ctx.reason}` } });
      },
    },
  ],
};

const fundFields = z.object({
  quarter: z.string().trim().regex(/^Q[1-4] \d{4}$/, 'Quarter looks like "Q3 2026".'),
  what: z.string().trim().min(1).max(500),
  toBuon: z.string().trim().min(1).max(120),
  amountVnd: z.number().int().min(1).max(10_000_000_000),
});

const fund: Resource = {
  name: "fund",
  group: "money",
  model: "communityFundEntry",
  titleField: "what",
  notice: "Community Fund disbursements, entered by hand. Every change is kept in the admin audit log.",
  fields: [
    { name: "quarter", type: "text", list: true, create: true, edit: true, required: true },
    { name: "what", type: "text", list: true, create: true, edit: true, required: true },
    { name: "toBuon", type: "text", list: true, create: true, edit: true, required: true },
    { name: "amountVnd", type: "money", list: true, create: true, edit: true, required: true },
    { name: "createdAt", type: "datetime" },
  ],
  search: ["what", "toBuon", "quarter"],
  filters: ["quarter"],
  sort: { field: "createdAt", dir: "desc" },
  create: {
    schema: fundFields,
    run: (ctx, input) => ctx.tx.communityFundEntry.create({ data: input as z.infer<typeof fundFields> }),
  },
  update: {
    schema: fundFields.partial(),
    async run(ctx, row, input) {
      return (await ctx.tx.communityFundEntry.update({ where: { id: row.id }, data: input })) as unknown as Row;
    },
  },
  async remove(ctx, row) {
    await ctx.tx.communityFundEntry.delete({ where: { id: row.id } });
    return { outcome: "deleted" };
  },
};

// ── Governance and content ───────────────────────────────────────────

const decisionFields = z.object({
  status: z.enum(["passed", "declined"]),
  title: z.string().trim().min(1).max(200),
  fromLabel: z.string().trim().min(1).max(200),
  date: ymd,
  note: z.string().trim().min(1).max(2000),
});
const toDecision = (input: Record<string, unknown>) =>
  input.date ? { ...input, date: new Date(`${input.date}T00:00:00Z`) } : input;

const decisions: Resource = {
  name: "decisions",
  group: "governance",
  model: "committeeDecision",
  titleField: "title",
  fields: [
    { name: "title", type: "text", list: true, create: true, edit: true, required: true },
    { name: "status", type: "select", options: ["passed", "declined"], list: true, create: true, edit: true, required: true },
    { name: "fromLabel", type: "text", list: true, create: true, edit: true, required: true },
    { name: "date", type: "date", list: true, create: true, edit: true, required: true },
    { name: "note", type: "textarea", create: true, edit: true, required: true },
  ],
  search: ["title", "fromLabel"],
  filters: ["status"],
  sort: { field: "date", dir: "desc" },
  create: {
    schema: decisionFields,
    run: (ctx, input) => ctx.tx.committeeDecision.create({ data: toDecision(input) as never }),
  },
  update: {
    schema: decisionFields.partial(),
    async run(ctx, row, input) {
      return (await ctx.tx.committeeDecision.update({ where: { id: row.id }, data: toDecision(input) })) as unknown as Row;
    },
  },
  async remove(ctx, row) {
    await ctx.tx.committeeDecision.delete({ where: { id: row.id } });
    return { outcome: "deleted" };
  },
};

const archiveFields = z.object({
  type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  meta: z.string().trim().min(1).max(300),
  keeperBuon: z.string().trim().min(1).max(120),
  body: z.string().trim().max(20_000).nullable().optional(),
  pillar: z.string().trim().max(80).nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
});
const REVIEW_RESET = { moderationStatus: "IN_REVIEW", moderatedById: null, moderatedAt: null, moderationNote: null };

const archive: Resource = {
  name: "archive",
  group: "governance",
  model: "archiveEntry",
  titleField: "title",
  notice:
    "Only the Committee publishes. What you create or change here goes to the Committee's review queue; you can take a published entry down, not put one up.",
  fields: [
    { name: "imageUrl", type: "image", list: true, create: true, edit: true },
    { name: "title", type: "text", list: true, create: true, edit: true, required: true },
    { name: "type", type: "text", list: true, create: true, edit: true, required: true },
    { name: "moderationStatus", type: "select", options: MODERATION_STATUSES, list: true },
    { name: "keeperBuon", type: "text", list: true, create: true, edit: true, required: true },
    { name: "meta", type: "text", create: true, edit: true, required: true },
    { name: "pillar", type: "text", create: true, edit: true },
    { name: "body", type: "textarea", create: true, edit: true },
    { name: "moderationNote", type: "text" },
    { name: "createdAt", type: "datetime" },
  ],
  search: ["title", "keeperBuon", "type"],
  filters: ["moderationStatus", "type"],
  sort: { field: "createdAt", dir: "desc" },
  create: {
    schema: archiveFields,
    async run(ctx, input) {
      const entry = await ctx.tx.archiveEntry.create({
        data: { ...(input as z.infer<typeof archiveFields>), moderationStatus: "IN_REVIEW", contributedById: ctx.actor.id },
      });
      await backToReview(ctx, entry.title, entry.type);
      return entry;
    },
  },
  update: {
    schema: archiveFields.partial(),
    async run(ctx, row, input) {
      const entry = await ctx.tx.archiveEntry.update({ where: { id: row.id }, data: { ...input, ...REVIEW_RESET } });
      await backToReview(ctx, entry.title, entry.type);
      return entry as unknown as Row;
    },
  },
  async remove(ctx, row) {
    const onChain = await ctx.tx.chainEntityRef.findUnique({ where: { archiveEntryId: row.id } });
    if (onChain) {
      // Its proof is on-chain; the record stays, off the public archive.
      await ctx.tx.archiveEntry.update({
        where: { id: row.id },
        data: { ...REVIEW_RESET, moderationNote: "Withdrawn by an admin; has an on-chain proof, so kept." },
      });
      return { outcome: "withdrawn", reason: "it has an on-chain proof" };
    }
    await ctx.tx.archiveEntry.delete({ where: { id: row.id } });
    return { outcome: "deleted" };
  },
  actions: [
    {
      name: "withdraw",
      reason: true,
      danger: true,
      when: (row) => row.moderationStatus === "PUBLISHED",
      async run(ctx, row) {
        await ctx.tx.archiveEntry.update({
          where: { id: row.id },
          data: { ...REVIEW_RESET, moderationNote: `Withdrawn by an admin: ${ctx.reason}` },
        });
        await backToReview(ctx, row.title as string, row.type as string);
      },
    },
  ],
};

const phraseFields = z.object({
  ede: z.string().trim().min(1).max(300),
  en: z.string().trim().min(1).max(300),
  note: z.string().trim().max(1000),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

const phrases: Resource = {
  name: "phrases",
  group: "governance",
  model: "phrase",
  titleField: "ede",
  notice: "Only the Committee publishes phrases. New and edited phrases go to their review queue.",
  fields: [
    { name: "ede", type: "text", list: true, create: true, edit: true, required: true },
    { name: "en", type: "text", list: true, create: true, edit: true, required: true },
    { name: "moderationStatus", type: "select", options: MODERATION_STATUSES, list: true },
    { name: "note", type: "textarea", create: true, edit: true },
    { name: "sortOrder", type: "number", list: true, create: true, edit: true },
    { name: "moderationNote", type: "text" },
  ],
  search: ["ede", "en"],
  filters: ["moderationStatus"],
  sort: { field: "sortOrder", dir: "asc" },
  create: {
    schema: phraseFields,
    async run(ctx, input) {
      const phrase = await ctx.tx.phrase.create({
        data: { ...(input as z.infer<typeof phraseFields>), moderationStatus: "IN_REVIEW" },
      });
      await backToReview(ctx, phrase.ede, "Phrase");
      return phrase;
    },
  },
  update: {
    schema: phraseFields.partial(),
    async run(ctx, row, input) {
      const phrase = await ctx.tx.phrase.update({ where: { id: row.id }, data: { ...input, ...REVIEW_RESET } });
      await backToReview(ctx, phrase.ede, "Phrase");
      return phrase as unknown as Row;
    },
  },
  async remove(ctx, row) {
    await ctx.tx.phrase.delete({ where: { id: row.id } });
    return { outcome: "deleted" };
  },
};

// ── Chain (read-only, with retries) ──────────────────────────────────

const outbox: Resource = {
  name: "outbox",
  group: "chain",
  model: "chainOutbox",
  titleField: "idempotencyKey",
  fields: [
    { name: "idempotencyKey", type: "mono", list: true },
    { name: "eventType", type: "text", list: true },
    { name: "status", type: "text", list: true },
    { name: "attempts", type: "number", list: true },
    { name: "lastError", type: "text", list: true },
    { name: "payload", type: "json" },
    { name: "createdAt", type: "datetime" },
    { name: "updatedAt", type: "datetime", list: true },
  ],
  search: ["idempotencyKey"],
  filters: ["status", "eventType"],
  sort: { field: "updatedAt", dir: "desc" },
  actions: [
    {
      name: "retry",
      when: (row) => ["DEAD", "RETRYABLE"].includes(row.status as string),
      async run(ctx, row) {
        await reviveOutbox(ctx.tx, row.idempotencyKey as string);
      },
    },
    {
      name: "abandon",
      reason: true,
      danger: true,
      when: (row) => ["PENDING", "RETRYABLE"].includes(row.status as string),
      async run(ctx, row) {
        await ctx.tx.chainOutbox.update({
          where: { id: row.id },
          data: { status: "DEAD", leaseUntil: null, lastError: `abandoned by admin: ${ctx.reason}` },
        });
      },
    },
  ],
};

const attestations: Resource = {
  name: "attestations",
  group: "chain",
  model: "ledgerAttestation",
  titleField: "ledgerEntryId",
  fields: [
    { name: "ledgerEntryId", type: "ref", ref: "ledger", list: true },
    { name: "state", type: "text", list: true },
    { name: "payloadHash", type: "mono" },
    { name: "pendingTxSig", type: "mono", list: true },
    { name: "finalizeTxSig", type: "mono" },
    { name: "cancelTxSig", type: "mono" },
    { name: "lastError", type: "text" },
    { name: "createdAt", type: "datetime", list: true },
  ],
  search: ["ledgerEntryId", "pendingTxSig"],
  filters: ["state"],
  sort: { field: "createdAt", dir: "desc" },
};

const chainAudit: Resource = {
  name: "chainAudit",
  group: "chain",
  model: "chainAuditLog",
  titleField: "action",
  fields: [
    { name: "action", type: "text", list: true },
    { name: "actorUserId", type: "ref", ref: "users", list: true },
    { name: "ledgerEntryId", type: "mono" },
    { name: "detail", type: "text", list: true },
    { name: "createdAt", type: "datetime", list: true },
  ],
  search: ["action", "detail"],
  filters: ["action"],
  sort: { field: "createdAt", dir: "desc" },
};

// ── System ───────────────────────────────────────────────────────────

const noticeSchema = z
  .object({
    userId: z.string().min(1).optional(),
    audience: z.enum([...ROLES, "ALL"]).optional(),
    message: z.string().trim().min(1).max(500),
    href: z.string().trim().max(200).optional(),
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.audience), "Choose one user, or an audience.");

const notifications: Resource = {
  name: "notifications",
  group: "system",
  model: "notification",
  titleField: "type",
  include: { user: { select: { email: true } } },
  fields: [
    { name: "userId", type: "ref", ref: "users", display: "user.email", list: true, create: true },
    { name: "audience", type: "select", options: [...ROLES, "ALL"], create: true },
    { name: "message", type: "textarea", create: true, required: true },
    { name: "href", type: "text", create: true },
    { name: "type", type: "text", list: true },
    { name: "params", type: "json" },
    { name: "readAt", type: "datetime", list: true },
    { name: "createdAt", type: "datetime", list: true },
  ],
  search: ["type"],
  filters: ["type"],
  sort: { field: "createdAt", dir: "desc" },
  create: {
    schema: noticeSchema,
    async run(ctx, input) {
      const { userId, audience, message, href } = input as z.infer<typeof noticeSchema>;
      const ids = userId
        ? [userId]
        : (
            await ctx.tx.user.findMany({
              where: { disabledAt: null, ...(audience === "ALL" ? {} : { role: audience }) },
              select: { id: true },
            })
          ).map((u) => u.id);
      for (const id of ids) {
        await notify(ctx.tx, { userId: id, type: "ADMIN_NOTICE", params: { message }, href: href || undefined });
      }
      return { sent: ids.length };
    },
  },
};

const adminAudit: Resource = {
  name: "adminAudit",
  group: "system",
  model: "adminAuditLog",
  titleField: "action",
  fields: [
    { name: "createdAt", type: "datetime", list: true },
    { name: "actorUserId", type: "ref", ref: "users", list: true },
    { name: "resource", type: "text", list: true },
    { name: "action", type: "text", list: true },
    { name: "recordId", type: "mono", list: true },
    { name: "reason", type: "text", list: true },
    { name: "changes", type: "json" },
  ],
  search: ["recordId", "reason"],
  filters: ["resource", "action", "actorUserId"],
  sort: { field: "createdAt", dir: "desc" },
};

export const RESOURCES: Resource[] = [
  users,
  providers,
  committee,
  wallets,
  walletLinks,
  listings,
  products,
  bookings,
  orders,
  ledger,
  offsets,
  topups,
  fund,
  decisions,
  archive,
  phrases,
  outbox,
  attestations,
  chainAudit,
  notifications,
  adminAudit,
];

export const RESOURCE_BY_NAME = new Map(RESOURCES.map((r) => [r.name, r]));
