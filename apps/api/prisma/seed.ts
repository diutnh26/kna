// Seeds the local dev DB with the same households, listings, products, and
// governance records the frontend's mock arrays used to hard-code — so a
// screen switching from its mock array to a fetch() doesn't change what's
// on screen.
//
// This resets the demo tables first, so `npm run db:seed` is reproducible.
// Fine for local development; it is not something to point at a real database.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { splitBooking, splitOrder } from "../src/lib/fees";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "changeme123";

async function reset() {
  // Delete in foreign-key-safe order (children before parents).
  await prisma.ledgerEntry.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.order.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.product.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.committeeDecision.deleteMany();
  await prisma.communityFundEntry.deleteMany();
  await prisma.archiveEntry.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.user.deleteMany();
}

async function createProvider(opts: {
  email: string;
  fullName: string;
  type: "HOMESTAY" | "GUIDE" | "ARTISAN";
  buon: string;
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: opts.email, passwordHash, fullName: opts.fullName, role: "PROVIDER" },
  });
  return prisma.provider.create({
    data: {
      userId: user.id,
      type: opts.type,
      displayName: opts.fullName,
      buon: opts.buon,
      verified: true,
    },
  });
}

async function main() {
  console.log("Seeding KNĂ dev database…");
  await reset();

  // ── Providers ────────────────────────────────────────────────────────
  const amiHBia = await createProvider({
    email: "ami.hbia@example.kna",
    fullName: "Amí H'Bia",
    type: "HOMESTAY",
    buon: "Buôn Akô Dhông",
  });
  const yWik = await createProvider({
    email: "y.wik@example.kna",
    fullName: "Y Wik Niê",
    type: "GUIDE",
    buon: "Buôn Đôn",
  });
  const amiLan = await createProvider({
    email: "ami.lan@example.kna",
    fullName: "Amí Lan",
    type: "ARTISAN",
    buon: "Buôn Kli A",
  });
  const yBla = await createProvider({
    email: "y.bla@example.kna",
    fullName: "Y Blă Êban",
    type: "ARTISAN",
    buon: "Buôn Đôn",
  });
  const aduonSun = await createProvider({
    email: "aduon.sun@example.kna",
    fullName: "Aduôn Sun",
    type: "HOMESTAY",
    buon: "Buôn Trấp",
  });
  const yThamNie = await createProvider({
    email: "y.tham@example.kna",
    fullName: "Y Thăm Niê",
    type: "ARTISAN",
    buon: "Buôn Trấp",
  });
  const hNiBya = await createProvider({
    email: "hni.bya@example.kna",
    fullName: "H'Ni Byă",
    type: "ARTISAN",
    buon: "Buôn Akô Dhông",
  });
  const ySun = await createProvider({
    email: "y.sun@example.kna",
    fullName: "Y Sun Adrơng",
    type: "ARTISAN",
    buon: "Buôn Đôn",
  });
  const gongEnsemble = await createProvider({
    email: "gong.ensemble@example.kna",
    fullName: "Buôn Đôn gong ensemble",
    type: "GUIDE",
    buon: "Buôn Đôn",
  });
  const coffeeCoop = await createProvider({
    email: "coffee.coop@example.kna",
    fullName: "Y Wik Coffee Co-op",
    type: "GUIDE",
    buon: "Buôn Đôn",
  });

  // ── Listings ─────────────────────────────────────────────────────────
  const listings = await Promise.all(
    [
      {
        providerId: amiHBia.id,
        category: "STAY" as const,
        title: "Two nights in Amí H'Bia's longhouse",
        blurb:
          "A working family home, not a guesthouse. You sleep in the long room, eat what the household eats, and help with the morning chores if you want to.",
        priceVnd: 500000,
        unit: "per night",
        duration: "2 nights",
        groupSize: "Up to 4 guests",
        carbonRating: "Low",
        customs: "Remove shoes at the ladder. Ask before photographing the ancestor shelf.",
        published: true,
      },
      {
        providerId: yWik.id,
        category: "GUIDED_WALK" as const,
        title: "Forest edge walk with Y Wik",
        blurb:
          "Y Wik has foraged this stretch since he was seven. He names what is edible, what is medicine, and what the village leaves alone, and explains why the third list matters most.",
        priceVnd: 700000,
        unit: "per person",
        duration: "4 hours",
        groupSize: "Up to 6 guests",
        carbonRating: "Low",
        customs: "Stay on the path near the spirit trees. Y Wik will point them out.",
        published: true,
      },
      {
        providerId: amiLan.id,
        category: "CRAFT_SESSION" as const,
        title: "Backstrap loom, one full panel",
        blurb:
          "You will not finish a cloth in a day. You will finish one panel, badly, and understand why a full skirt takes three months and costs what it costs.",
        priceVnd: 850000,
        unit: "per person",
        duration: "6 hours",
        groupSize: "Up to 3 guests",
        carbonRating: "Very low",
        customs: "Bring nothing. Amí Lan supplies thread and loom.",
        published: true,
      },
      {
        providerId: gongEnsemble.id,
        category: "CEREMONY" as const,
        title: "Harvest gong evening",
        blurb:
          "A real ceremony that the village holds anyway, opened to a small number of visitors. Held only when the harvest calendar calls for it, so dates are limited.",
        priceVnd: 700000,
        unit: "per person",
        duration: "3 hours",
        groupSize: "Up to 12 guests",
        carbonRating: "Low",
        customs: "Guests are seated, not standing. Do not join the circle unless invited.",
        published: true,
      },
      {
        providerId: aduonSun.id,
        category: "STAY" as const,
        title: "Lakeside longhouse, Buôn Trấp",
        blurb:
          "Twenty minutes from Lắk Lake, run by a household of four generations. Aduôn Sun cooks; her granddaughter handles the bookings and speaks English.",
        priceVnd: 500000,
        unit: "per night",
        duration: "1 night minimum",
        groupSize: "Up to 6 guests",
        carbonRating: "Low",
        customs: "The elder greets guests first. A short reply is enough.",
        published: true,
      },
      {
        providerId: coffeeCoop.id,
        category: "CRAFT_SESSION" as const,
        title: "Coffee, from cherry to cup",
        blurb:
          "Picking, pulping, drying, roasting on a wood fire. Run by the co-op that farms the plot, so the price stays with the growers rather than a plantation tour desk.",
        priceVnd: 600000,
        unit: "per person",
        duration: "5 hours",
        groupSize: "Up to 8 guests",
        carbonRating: "Low",
        customs: "Long sleeves recommended. The drying yard has no shade.",
        published: true,
      },
    ].map((data) => prisma.listing.create({ data }))
  );
  const longhouseStay = listings[0];

  // ── Products ─────────────────────────────────────────────────────────
  const products = await Promise.all(
    [
      {
        providerId: amiLan.id,
        category: "Textile",
        title: "Ceremonial skirt panel, indigo and madder",
        note: "Woven on a backstrap loom in the pattern of her mother's clan. The border motif marks it as a piece for ceremony rather than daily wear.",
        priceVnd: 4200000,
        stock: 1,
        published: true,
      },
      {
        providerId: yBla.id,
        category: "Basketry",
        title: "Gùi carrying basket, rattan and bamboo",
        note: "The everyday shape, still made the everyday way. Rattan cut at the end of the dry season, when the fibre holds its tension longest.",
        priceVnd: 950000,
        stock: 6,
        published: true,
      },
      {
        providerId: yThamNie.id,
        category: "Woodwork",
        title: "Carved stool, single block of jackfruit",
        note: "Cut from a jackfruit tree that came down in a storm. Y Thăm works only fallen wood and will tell you which tree each piece came from.",
        priceVnd: 2800000,
        stock: 2,
        published: true,
      },
      {
        providerId: hNiBya.id,
        category: "Textile",
        title: "Shoulder cloth, narrow loom",
        note: "H'Ni is twenty-three and one of six weavers under thirty still working in the buôn. Buying her work is the argument for the seventh.",
        priceVnd: 1650000,
        stock: 4,
        published: true,
      },
      {
        providerId: ySun.id,
        category: "Jewellery",
        title: "Brass wrist ring, hand-forged pair",
        note: "Worn in pairs, traditionally given at a wedding. Y Sun forges them over charcoal in the same yard his father used.",
        priceVnd: 780000,
        stock: 9,
        published: true,
      },
      {
        providerId: coffeeCoop.id,
        category: "Coffee",
        title: "Robusta, wood-fired roast, 500g",
        note: "Grown, picked, and roasted by the twelve households of the co-op. Dark, low acid, and roasted over wood rather than gas.",
        priceVnd: 320000,
        stock: 40,
        published: true,
      },
    ].map((data) => prisma.product.create({ data }))
  );
  const basket = products[1];

  // ── A guest, so there's something to book with ───────────────────────
  const guestPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const guest = await prisma.user.create({
    data: {
      email: "guest@example.kna",
      passwordHash: guestPasswordHash,
      fullName: "Demo Traveler",
      role: "GUEST",
    },
  });

  // ── Settled transactions, so the public ledger isn't empty ───────────
  const bookingTotal = longhouseStay.priceVnd * 2;
  const bookingSplit = splitBooking(bookingTotal);
  await prisma.booking.create({
    data: {
      listingId: longhouseStay.id,
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

  // ── Community Governance Committee ───────────────────────────────────
  // Committee seats belong to people who are already hosts, guides, and
  // makers on the platform — the same User can hold both records.
  const seats: Array<[{ userId: string }, string, string, number]> = [
    [amiHBia, "Chair · elder", "Buôn Akô Dhông", 0],
    [yWik, "Guides and land use", "Buôn Đôn", 1],
    [aduonSun, "Homestays", "Buôn Trấp", 2],
    [amiLan, "Craft and archive", "Buôn Kli A", 3],
    [yThamNie, "Fund treasurer", "Buôn Trấp", 4],
    [hNiBya, "Youth representative", "Buôn Akô Dhông", 5],
  ];
  for (const [provider, role, buon, sortOrder] of seats) {
    await prisma.committeeMember.create({
      data: { userId: provider.userId, role, buon, since: "2026", sortOrder },
    });
  }

  // ── Community Fund allocations ───────────────────────────────────────
  await prisma.communityFundEntry.createMany({
    data: [
      { quarter: "Q2 2026", what: "Recording equipment for the cultural archive", toBuon: "Buôn Kli A", amountVnd: 7400000 },
      { quarter: "Q2 2026", what: "Weaving apprenticeship stipends, three places", toBuon: "Buôn Akô Dhông", amountVnd: 6000000 },
      { quarter: "Q2 2026", what: "Yok Đôn buffer replanting, co-funded", toBuon: "Buôn Đôn", amountVnd: 5200000 },
      { quarter: "Q2 2026", what: "Longhouse roof repair, communal section", toBuon: "Buôn Trấp", amountVnd: 4200000 },
      { quarter: "Q2 2026", what: "Digital skills training, two sessions", toBuon: "All four buôn", amountVnd: 1800000 },
      { quarter: "Q1 2026", what: "Gong set restoration, two sets", toBuon: "Buôn Đôn", amountVnd: 8100000 },
      { quarter: "Q1 2026", what: "Oral history recording, eleven sessions", toBuon: "All four buôn", amountVnd: 5300000 },
      { quarter: "Q1 2026", what: "Shoreline planting, wet season batch", toBuon: "Buôn Trấp", amountVnd: 3500000 },
      { quarter: "Q1 2026", what: "Committee travel and meeting costs", toBuon: "Committee", amountVnd: 2000000 },
    ],
  });

  // ── Minutes — including the refusals ─────────────────────────────────
  await prisma.committeeDecision.createMany({
    data: [
      {
        status: "declined",
        title: "Request to film a funeral ceremony for the archive",
        fromLabel: "External documentary producer",
        date: new Date("2026-05-14"),
        note: "Declined unanimously. Funeral practice is not published material. The Committee offered an interview about mourning customs instead, which the producer accepted.",
      },
      {
        status: "passed",
        title: "Raise the homestay floor price to 500,000 ₫ per night",
        fromLabel: "Aduôn Sun, on behalf of hosts",
        date: new Date("2026-05-02"),
        note: "Passed 5 to 1. Applies to all listings from 1 June. Hosts may price above the floor; none may price below it.",
      },
      {
        status: "open",
        title: "Whether to onboard a fifth buôn this year",
        fromLabel: "KNĂ platform team",
        date: new Date("2026-05-28"),
        note: "Under discussion. Concerns raised about onboarding capacity before existing hosts are steady. Decision deferred to the July meeting.",
      },
      {
        status: "passed",
        title: "Publish the phrasebook audio without restriction",
        fromLabel: "H'Ni Byă, youth representative",
        date: new Date("2026-04-19"),
        note: "Passed unanimously. Everyday language is open. Ceremonial and clan-specific speech remains unpublished.",
      },
    ],
  });

  console.log("Seed complete:", {
    providers: 10,
    listings: listings.length,
    products: products.length,
    committee: seats.length,
    fundEntries: 9,
    decisions: 4,
  });
  console.log(`Every demo account uses the password "${DEMO_PASSWORD}" — e.g. guest@example.kna`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
