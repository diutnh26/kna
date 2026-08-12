// Seeds the local dev DB with the same households and listings the
// frontend's mock arrays already show, so switching a screen from its
// hard-coded array to a fetch() doesn't change what's on screen.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { splitBooking, splitOrder } from "../src/lib/fees";

const prisma = new PrismaClient();

async function upsertProviderUser(opts: {
  email: string;
  fullName: string;
  type: "HOMESTAY" | "GUIDE" | "ARTISAN";
  buon: string;
  bio?: string;
}) {
  const passwordHash = await bcrypt.hash("changeme123", 10);
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {},
    create: { email: opts.email, passwordHash, fullName: opts.fullName, role: "PROVIDER" },
  });
  return prisma.provider.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      type: opts.type,
      displayName: opts.fullName,
      buon: opts.buon,
      bio: opts.bio,
      verified: true,
    },
  });
}

async function main() {
  console.log("Seeding KNĂ dev database…");

  // ── Providers (mirrors Travel.jsx / Marketplace.jsx hosts) ──────────
  const amiHBia = await upsertProviderUser({
    email: "ami.hbia@example.kna",
    fullName: "Amí H'Bia",
    type: "HOMESTAY",
    buon: "Buôn Akô Dhông",
  });
  const yWik = await upsertProviderUser({
    email: "y.wik@example.kna",
    fullName: "Y Wik Niê",
    type: "GUIDE",
    buon: "Buôn Đôn",
  });
  const amiLan = await upsertProviderUser({
    email: "ami.lan@example.kna",
    fullName: "Amí Lan",
    type: "ARTISAN",
    buon: "Buôn Kli A",
  });
  const yBla = await upsertProviderUser({
    email: "y.bla@example.kna",
    fullName: "Y Blă Êban",
    type: "ARTISAN",
    buon: "Buôn Đôn",
  });

  // ── Listings (Travel.jsx LISTINGS) ───────────────────────────────────
  const stay = await prisma.listing.create({
    data: {
      providerId: amiHBia.id,
      category: "STAY",
      title: "Two nights in Amí H'Bia's longhouse",
      blurb:
        "A working family home, not a guesthouse. You sleep in the long room, eat what the household eats, and help with the morning chores if you want to.",
      priceVnd: 500000,
      unit: "per night",
      carbonRating: "Low",
      customs: "Remove shoes at the ladder. Ask before photographing the ancestor shelf.",
      published: true,
    },
  });
  const walk = await prisma.listing.create({
    data: {
      providerId: yWik.id,
      category: "GUIDED_WALK",
      title: "Forest edge walk with Y Wik",
      blurb:
        "Y Wik has foraged this stretch since he was seven. He names what is edible, what is medicine, and what the village leaves alone.",
      priceVnd: 700000,
      unit: "per person",
      carbonRating: "Low",
      customs: "Stay on the path near the spirit trees. Y Wik will point them out.",
      published: true,
    },
  });
  const loom = await prisma.listing.create({
    data: {
      providerId: amiLan.id,
      category: "CRAFT_SESSION",
      title: "Backstrap loom, one full panel",
      blurb: "A full day at the loom, from warping the threads to the finished panel.",
      priceVnd: 850000,
      unit: "per person",
      carbonRating: "Very low",
      published: true,
    },
  });

  // ── Products (Marketplace.jsx PRODUCTS) ──────────────────────────────
  await prisma.product.create({
    data: {
      providerId: amiLan.id,
      category: "Textile",
      title: "Ceremonial skirt panel, indigo and madder",
      note: "Woven on a backstrap loom in the pattern of her mother's clan.",
      priceVnd: 4200000,
      stock: 1,
      published: true,
    },
  });
  const basket = await prisma.product.create({
    data: {
      providerId: yBla.id,
      category: "Basketry",
      title: "Gùi carrying basket, rattan and bamboo",
      note: "The everyday shape, still made the everyday way.",
      priceVnd: 950000,
      stock: 6,
      published: true,
    },
  });

  // ── A guest, so there's something to book with ───────────────────────
  const guestPasswordHash = await bcrypt.hash("changeme123", 10);
  const guest = await prisma.user.upsert({
    where: { email: "guest@example.kna" },
    update: {},
    create: { email: "guest@example.kna", passwordHash: guestPasswordHash, fullName: "Demo Traveler", role: "GUEST" },
  });

  // ── A couple of settled bookings/orders, to populate the public ledger ──
  const bookingTotal = stay.priceVnd * 2;
  const bookingSplit = splitBooking(bookingTotal);
  await prisma.booking.create({
    data: {
      listingId: stay.id,
      guestId: guest.id,
      status: "CONFIRMED",
      guests: 2,
      totalVnd: bookingTotal,
      ...bookingSplit,
      ledgerEntry: {
        create: {
          fromLabel: "Traveler #4821",
          toLabel: amiHBia.displayName,
          totalVnd: bookingTotal,
          platformFeeVnd: bookingSplit.platformFeeVnd,
          communityFundVnd: bookingSplit.communityFundVnd,
        },
      },
    },
  });

  const orderTotal = basket.priceVnd;
  const orderSplit = splitOrder(orderTotal);
  await prisma.order.create({
    data: {
      buyerId: guest.id,
      status: "PAID",
      totalVnd: orderTotal,
      marketplaceFeeVnd: orderSplit.marketplaceFeeVnd,
      items: { create: [{ productId: basket.id, quantity: 1, unitPriceVnd: basket.priceVnd }] },
      ledgerEntry: {
        create: {
          fromLabel: "Traveler #4818",
          toLabel: yBla.displayName,
          totalVnd: orderTotal,
          platformFeeVnd: orderSplit.marketplaceFeeVnd,
          communityFundVnd: 0,
        },
      },
    },
  });

  // ── Governance (Community.jsx COMMITTEE / QUARTERS / DECISIONS) ─────
  const chairHash = await bcrypt.hash("changeme123", 10);
  const chairUser = await prisma.user.upsert({
    where: { email: "amihbia.chair@example.kna" },
    update: {},
    create: { email: "amihbia.chair@example.kna", passwordHash: chairHash, fullName: "Amí H'Bia", role: "COMMITTEE" },
  });
  await prisma.committeeMember.upsert({
    where: { userId: chairUser.id },
    update: {},
    create: { userId: chairUser.id, role: "Chair · elder", buon: "Buôn Akô Dhông", since: "2026" },
  });

  await prisma.communityFundEntry.createMany({
    data: [
      { quarter: "Q2 2026", what: "Recording equipment for the cultural archive", toBuon: "Buôn Kli A", amountVnd: 7400000 },
      { quarter: "Q2 2026", what: "Weaving apprenticeship stipends, three places", toBuon: "Buôn Akô Dhông", amountVnd: 6000000 },
      { quarter: "Q1 2026", what: "Gong set restoration, two sets", toBuon: "Buôn Đôn", amountVnd: 8100000 },
    ],
  });

  await prisma.committeeDecision.createMany({
    data: [
      {
        status: "declined",
        title: "Request to film a funeral ceremony for the archive",
        fromLabel: "External documentary producer",
        date: new Date("2026-05-14"),
        note: "Declined unanimously. Funeral practice is not published material.",
      },
    ],
  });

  console.log("Seed complete:", { providers: 4, listings: 3, products: 2, bookings: 1, orders: 1 });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
