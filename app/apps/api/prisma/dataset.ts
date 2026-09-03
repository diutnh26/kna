// The KNĂ demonstration dataset — the households, listings, products and
// governance records the frontend's mock arrays used to hard-code.
//
// Extracted from seed.ts so the same data can be loaded two ways:
//
//   npm run db:seed   wipes the database first (development only, guarded)
//   npm run db:demo   adds it without deleting anything (safe against Neon)
//
// One copy, so the demo environment and a developer's machine cannot drift
// into showing different things.
//
// Every account here uses @example.kna — a reserved name under a TLD that
// does not exist, so these can never collide with a real address and are
// recognisable as demonstration records at a glance. /community/stats keys
// its "demonstration data" banner off exactly that.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { splitBooking, splitOrder } from "../src/lib/fees";

export const DEMO_PASSWORD = "changeme123";

/** Marks every account this dataset creates. Also the banner's trigger. */
export const DEMO_EMAIL_DOMAIN = "@example.kna";


export async function populate(prisma: PrismaClient) {
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
    buon: "Buôn Trấp",
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
        imageUrl: "/images/listings/hbia-longhouse.jpg",
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
        imageUrl: "/images/listings/forest-edge-walk.jpg",
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
        imageUrl: "/images/listings/backstrap-loom.jpg",
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
        imageUrl: "/images/listings/harvest-gong-evening.jpg",
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
        imageUrl: "/images/listings/lakeside-longhouse.jpg",
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
        imageUrl: "/images/listings/coffee-cherry-to-cup.jpg",
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
        imageUrl: "/images/products/ceremonial-skirt-panel.jpg",
        published: true,
      },
      {
        providerId: yBla.id,
        category: "Basketry",
        title: "Gùi carrying basket, rattan and bamboo",
        note: "The everyday shape, still made the everyday way. Rattan cut at the end of the dry season, when the fibre holds its tension longest.",
        priceVnd: 950000,
        stock: 6,
        imageUrl: "/images/products/gui-carrying-basket.jpg",
        published: true,
      },
      {
        providerId: yThamNie.id,
        category: "Woodwork",
        title: "Carved stool, single block of jackfruit",
        note: "Cut from a jackfruit tree that came down in a storm. Y Thăm works only fallen wood and will tell you which tree each piece came from.",
        priceVnd: 2800000,
        stock: 2,
        imageUrl: "/images/products/carved-stool-jackfruit.jpg",
        published: true,
      },
      {
        providerId: hNiBya.id,
        category: "Textile",
        title: "Shoulder cloth, narrow loom",
        note: "H'Ni is twenty-three and one of six weavers under thirty still working in the buôn. Buying her work is the argument for the seventh.",
        priceVnd: 1650000,
        stock: 4,
        imageUrl: "/images/products/shoulder-cloth.jpg",
        published: true,
      },
      {
        providerId: ySun.id,
        category: "Jewellery",
        title: "Brass wrist ring, hand-forged pair",
        note: "Worn in pairs, traditionally given at a wedding. Y Sun forges them over charcoal in the same yard his father used.",
        priceVnd: 780000,
        stock: 9,
        imageUrl: "/images/products/brass-wrist-ring.jpg",
        published: true,
      },
      {
        providerId: coffeeCoop.id,
        category: "Coffee",
        title: "Robusta, wood-fired roast, 500g",
        note: "Grown, picked, and roasted by the twelve households of the co-op. Dark, low acid, and roasted over wood rather than gas.",
        priceVnd: 320000,
        stock: 40,
        imageUrl: "/images/products/robusta-wood-fired.jpg",
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

  // The community coordinator who confirms bookings with households by
  // hand — the human step the Phase 1 concierge MVP is built around.
  await prisma.user.create({
    data: {
      email: "coordinator@example.kna",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      fullName: "H'Linh Niê",
      role: "COORDINATOR",
    },
  });

  // ── Transactions ─────────────────────────────────────────────────────
  // Both halves of the lifecycle, because both are worth demonstrating:
  // settled rows are what the public ledger shows, and pending ones are
  // what a coordinator actually works through. A dataset with only settled
  // records makes the confirmation queue look broken.

  /** A date `days` from now, as a date-only value. */
  const day = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  };

  // Confirmed: appears on the public ledger and in the household's earnings.
  const bookingNights = 2;
  const bookingTotal = longhouseStay.priceVnd * bookingNights;
  const bookingSplit = splitBooking(bookingTotal);
  await prisma.booking.create({
    data: {
      listingId: longhouseStay.id,
      guestId: guest.id,
      status: "CONFIRMED",
      guests: 2,
      checkIn: day(12),
      nights: bookingNights,
      totalVnd: bookingTotal,
      ...bookingSplit,
      ledgerEntries: {
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

  // Pending: sits in the coordinator's queue, counted as "awaiting" and
  // deliberately absent from the public ledger until someone confirms it.
  for (const [listing, guests, nights, inDays] of [
    [listings[1], 4, 1, 5],   // forest edge walk — per person
    [listings[2], 2, 1, 26],  // backstrap loom session
  ] as const) {
    const total = listing.priceVnd * (listing.unit === "per night" ? nights : guests);
    const split = splitBooking(total);
    await prisma.booking.create({
      data: {
        listingId: listing.id,
        guestId: guest.id,
        status: "PENDING",
        guests,
        checkIn: day(inDays),
        nights,
        totalVnd: total,
        ...split,
        ledgerEntries: {
          create: {
            fromLabel: `Traveler #${4820 + inDays}`,
            toLabel: listing.title,
            totalVnd: total,
            platformFeeVnd: split.platformFeeVnd,
            communityFundVnd: split.communityFundVnd,
          },
        },
      },
    });
  }

  const orderTotal = basket.priceVnd;
  const orderSplit = splitOrder(orderTotal);
  await prisma.order.create({
    data: {
      buyerId: guest.id,
      status: "PAID",
      totalVnd: orderTotal,
      marketplaceFeeVnd: orderSplit.marketplaceFeeVnd,
      items: { create: [{ productId: basket.id, quantity: 1, unitPriceVnd: basket.priceVnd }] },
      ledgerEntries: {
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

  // An order still awaiting its payment record, so the settlement queue has
  // something in it too.
  const pendingProduct = products[0];
  const pendingTotal = pendingProduct.priceVnd;
  const pendingSplit = splitOrder(pendingTotal);
  await prisma.order.create({
    data: {
      buyerId: guest.id,
      status: "PENDING",
      totalVnd: pendingTotal,
      marketplaceFeeVnd: pendingSplit.marketplaceFeeVnd,
      items: {
        create: [{ productId: pendingProduct.id, quantity: 1, unitPriceVnd: pendingProduct.priceVnd }],
      },
      ledgerEntries: {
        create: {
          fromLabel: "Traveler #4830",
          toLabel: pendingProduct.title,
          totalVnd: pendingTotal,
          platformFeeVnd: pendingSplit.marketplaceFeeVnd,
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
    [amiLan, "Craft and archive", "Buôn Trấp", 3],
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
      { quarter: "Q2 2026", what: "Recording equipment for the cultural archive", toBuon: "Buôn Trấp", amountVnd: 7400000 },
      { quarter: "Q2 2026", what: "Weaving apprenticeship stipends, three places", toBuon: "Buôn Akô Dhông", amountVnd: 6000000 },
      { quarter: "Q2 2026", what: "Yok Đôn buffer replanting, co-funded", toBuon: "Buôn Đôn", amountVnd: 5200000 },
      { quarter: "Q2 2026", what: "Longhouse roof repair, communal section", toBuon: "Buôn Trấp", amountVnd: 4200000 },
      { quarter: "Q2 2026", what: "Digital skills training, two sessions", toBuon: "All three buôn", amountVnd: 1800000 },
      { quarter: "Q1 2026", what: "Gong set restoration, two sets", toBuon: "Buôn Đôn", amountVnd: 8100000 },
      { quarter: "Q1 2026", what: "Oral history recording, eleven sessions", toBuon: "All three buôn", amountVnd: 5300000 },
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

  // ── Cultural archive ─────────────────────────────────────────────────
  // Published entries are the ones the Committee has already cleared.
  const chair = await prisma.user.findUniqueOrThrow({ where: { email: "ami.hbia@example.kna" } });
  await prisma.archiveEntry.createMany({
    data: [
      {
        type: "Oral history",
        title: "How the Ê Đê came to Đắk Lắk",
        meta: "Narrated by Amí H'Bia · 14 min",
        keeperBuon: "Buôn Akô Dhông",
        pillar: "The Long House",
        imageUrl: "/images/archive/origins.jpg",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-03-02"),
      },
      {
        type: "360° tour",
        title: "Inside a working longhouse",
        meta: "Six rooms · walkthrough",
        keeperBuon: "Buôn Trấp",
        pillar: "The Long House",
        imageUrl: "/images/archive/longhouse-interior.jpg",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-03-11"),
      },
      {
        type: "Recording",
        title: "Gong set for the harvest ceremony",
        meta: "Six players · 22 min",
        keeperBuon: "Buôn Đôn",
        pillar: "Cồng Chiêng",
        imageUrl: "/images/archive/harvest-gong-set.jpg",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-03-18"),
      },
      {
        type: "Craft record",
        title: "Backstrap loom, start to finish",
        meta: "Photo essay · 40 frames",
        keeperBuon: "Buôn Trấp",
        pillar: "Weaving",
        imageUrl: "/images/archive/backstrap-loom-record.jpg",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-04-04"),
      },
      {
        type: "Oral history",
        title: "Why the mother's line holds the house",
        meta: "Narrated by Aduôn Sun · 19 min",
        keeperBuon: "Buôn Akô Dhông",
        pillar: "The Long House",
        imageUrl: "/images/archive/mothers-line.jpg",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-04-15"),
      },
      {
        type: "Language",
        title: "Greetings and forms of address",
        meta: "Audio · 12 phrases",
        keeperBuon: "Community Council",
        imageUrl: "/images/archive/greetings.jpg",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-04-19"),
      },
      // Waiting on the Committee — these are what the review queue shows.
      {
        type: "Craft record",
        title: "Dyeing indigo, three vats",
        meta: "Photo essay · 26 frames",
        keeperBuon: "Buôn Trấp",
        pillar: "Weaving",
        imageUrl: "/images/archive/indigo-dyeing.jpg",
        moderationStatus: "IN_REVIEW",
        contributedById: (await prisma.user.findUniqueOrThrow({ where: { email: "ami.lan@example.kna" } })).id,
      },
      {
        type: "Recording",
        title: "Teaching session, players under fifteen",
        meta: "Four players · 31 min",
        keeperBuon: "Buôn Trấp",
        pillar: "Cồng Chiêng",
        imageUrl: "/images/archive/teaching-session.jpg",
        moderationStatus: "IN_REVIEW",
        contributedById: (await prisma.user.findUniqueOrThrow({ where: { email: "y.wik@example.kna" } })).id,
      },
      // Already refused, with the reason on the record.
      {
        type: "Recording",
        title: "Funeral gongs, slow cycle",
        meta: "Six players · 17 min",
        keeperBuon: "Buôn Trấp",
        pillar: "Cồng Chiêng",
        moderationStatus: "REJECTED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-05-14"),
        moderationNote:
          "Funeral practice is not published material. Recording stays with the household.",
      },
    ],
  });

  await prisma.phrase.createMany({
    data: [
      { ede: "Hê drei", en: "Hello", note: "Used at any hour", sortOrder: 0, moderationStatus: "PUBLISHED" },
      { ede: "Bơni", en: "Thank you", note: "Said with a slight bow of the head", sortOrder: 1, moderationStatus: "PUBLISHED" },
      { ede: "Kâo bi mơak", en: "I am glad to be here", note: "Offered when entering a house", sortOrder: 2, moderationStatus: "PUBLISHED" },
      { ede: "Ơ ami", en: "Elder mother — a respectful address", note: "Used for the senior woman of a longhouse", sortOrder: 3, moderationStatus: "PUBLISHED" },
      { ede: "Kâo lui", en: "I am leaving now", note: "Said at the ladder, not at the gate", sortOrder: 4, moderationStatus: "PUBLISHED" },
    ],
  });

  console.log("Dataset loaded:", {
    providers: 10,
    listings: listings.length,
    products: products.length,
    committee: seats.length,
    fundEntries: 9,
    decisions: 4,
    archiveEntries: "6 published, 2 in review, 1 refused",
    phrases: 5,
  });
}
