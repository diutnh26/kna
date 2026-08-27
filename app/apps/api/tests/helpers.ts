import bcrypt from "bcryptjs";
import type { Express } from "express";
import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/app";

let _app: ReturnType<typeof createApp> | undefined;

/** Lazily created so vi.mock in chain.test.ts can register before first use. */
export function getApp() {
  if (!_app) _app = createApp();
  return _app;
}

export function resetAppForTests() {
  _app = undefined;
}

export const app = new Proxy({} as Express, {
  get(_target, prop) {
    const real = getApp();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const PASSWORD = "test-password";

/** Wipes every table, in foreign-key-safe order. */
export async function resetDb() {
  await prisma.notification.deleteMany();
  await prisma.ledgerAttestation.deleteMany();
  await prisma.chainOutbox.deleteMany();
  await prisma.walletLink.deleteMany();
  await prisma.chainEntityRef.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.orderItem.deleteMany();
  // Before Booking: OffsetContribution holds a NoAction foreign key to it,
  // so deleting bookings first fails on the constraint. The test suite went
  // green while logging that failure, because afterAll swallowed it.
  await prisma.offsetContribution.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.order.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.product.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.committeeDecision.deleteMany();
  await prisma.communityFundEntry.deleteMany();
  await prisma.archiveEntry.deleteMany();
  await prisma.phrase.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.user.deleteMany();
}

export async function makeUser(
  email: string,
  role: "GUEST" | "PROVIDER" | "COORDINATOR" | "COMMITTEE" | "ADMIN" = "GUEST"
) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      fullName: email.split("@")[0],
      role,
    },
  });
}

export async function makeProvider(email: string, buon = "Buôn Test") {
  const user = await makeUser(email, "PROVIDER");
  const provider = await prisma.provider.create({
    data: {
      userId: user.id,
      type: "HOMESTAY",
      displayName: `Host ${email.split("@")[0]}`,
      buon,
      verified: true,
    },
  });
  return { user, provider };
}

export async function giveSeat(userId: string, role = "Chair · elder", buon = "Buôn Test") {
  return prisma.committeeMember.create({
    data: { userId, role, buon, since: "2026" },
  });
}

/** Midnight UTC today — matches bookings route slot dates. */
function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Open capacity for integration tests that book via POST /bookings. */
export async function seedAvailabilitySlots(listingId: string, days = 400, capacity = 24) {
  const start = todayUtc();
  await prisma.availabilitySlot.createMany({
    data: Array.from({ length: days }, (_, i) => ({
      listingId,
      date: new Date(start.getTime() + i * 86_400_000),
      capacity,
      booked: 0,
    })),
  });
}

export async function makeListing(providerId: string, priceVnd = 500_000) {
  const listing = await prisma.listing.create({
    data: {
      providerId,
      category: "STAY",
      title: "Test longhouse",
      blurb: "A test listing.",
      priceVnd,
      unit: "per night",
      duration: "1 night",
      groupSize: "Up to 2 guests",
      carbonRating: "Low",
      published: true,
    },
  });
  await seedAvailabilitySlots(listing.id);
  return listing;
}

/** Signs in via the real endpoint so tokens are minted the real way. */
export async function tokenFor(request: typeof import("supertest"), email: string) {
  const res = await request(app).post("/auth/login").send({ email, password: PASSWORD });
  return res.body.token as string;
}

/** A check-in far enough ahead that it never trips the past-date rule. */
export function soon(daysAhead = 30) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}
