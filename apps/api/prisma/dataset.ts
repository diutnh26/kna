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
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-04-15"),
      },
      {
        type: "Language",
        title: "Greetings and forms of address",
        meta: "Audio · 12 phrases",
        keeperBuon: "Community Council",
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
        moderationStatus: "IN_REVIEW",
        contributedById: (await prisma.user.findUniqueOrThrow({ where: { email: "ami.lan@example.kna" } })).id,
      },
      {
        type: "Recording",
        title: "Teaching session, players under fifteen",
        meta: "Four players · 31 min",
        keeperBuon: "Buôn Trấp",
        pillar: "Cồng Chiêng",
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

  // ── Knowledge cards ──────────────────────────────────────────────────
  // The assistant's corpus. The first four are the scripted replies the
  // Assistant screen shipped with, promoted word-for-word from the locale
  // files into moderated content — they were already elder-checked prose,
  // just stored in the wrong place for anything but a fixed script. The
  // rest restate platform facts recorded elsewhere in this repo (fee
  // split, booking flow, moderation). Nothing here says anything about Ê
  // Đê culture that the reviewed script did not already say.
  await prisma.knowledgeCard.createMany({
    data: [
      {
        topic: "etiquette",
        sortOrder: 0,
        question: "How do I greet an elder?",
        questionVi: "Tôi nên chào người lớn tuổi thế nào?",
        answer:
          "Let the elder speak first. A short reply and a slight bow of the head is enough — Ê Đê greeting is not effusive, and a long enthusiastic introduction can read as pushy.\n\nIf you want a phrase, “Hê drei” works at any hour. “Bơni” is thank you.\n\nOne thing visitors often get wrong: in a matrilineal household the eldest woman is usually the person to address, even when a man greets you at the ladder.",
        answerVi:
          "Hãy để người lớn tuổi lên tiếng trước. Một câu đáp ngắn và hơi cúi đầu là đủ — cách chào của người Ê Đê không ồn ào, và một màn tự giới thiệu dài dòng, hào hứng có thể bị xem là suồng sã.\n\nNếu bạn muốn một câu cụ thể, “Hê drei” dùng được vào bất cứ giờ nào. “Bơni” là cảm ơn.\n\nMột điều du khách hay nhầm: trong gia đình mẫu hệ, người cần chào thường là người phụ nữ lớn tuổi nhất, kể cả khi ra đón bạn ở cầu thang là một người đàn ông.",
        href: "#explore",
        attributedTo: "Reviewed script · community archive",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "etiquette",
        sortOrder: 1,
        question: "What can I photograph?",
        questionVi: "Tôi được chụp ảnh những gì?",
        answer:
          "Most of daily life is fine to photograph if you ask first. Three things to avoid:\n\n• The ancestor shelf inside a longhouse. Not photographed, generally not discussed with visitors either.\n• Funeral gongs or a funeral in progress.\n• Children, without a parent present.\n\nCeremonies vary by household. If you booked through KNĂ, the house rule on your booking card tells you what that particular family has agreed to.",
        answerVi:
          "Phần lớn sinh hoạt thường ngày đều có thể chụp, miễn là bạn xin phép trước. Có ba điều nên tránh:\n\n• Bàn thờ tổ tiên bên trong nhà dài. Không chụp, và thường cũng không bàn tới với khách.\n• Cồng chiêng tang lễ hoặc một đám tang đang diễn ra.\n• Trẻ em, khi không có cha mẹ ở đó.\n\nNghi lễ mỗi nhà mỗi khác. Nếu bạn đặt qua KNĂ, phần nếp nhà ghi trên phiếu đặt chỗ sẽ cho biết gia đình đó đã đồng ý những gì.",
        href: "#explore",
        attributedTo: "Reviewed script · community archive",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "logistics",
        sortOrder: 2,
        question: "Plan me three days",
        questionVi: "Lên giúp tôi lịch trình ba ngày",
        answer:
          "Here is a shape that works for a first visit, low travel, one buôn per day:\n\nDay 1 — Arrive Buôn Ma Thuột, afternoon at Buôn Akô Dhông. Short walk, meet your host, eat with the household. Stay the night.\n\nDay 2 — Morning loom session with Amí Lan in Buôn Trấp. Afternoon free. Evening gong ensemble in Buôn Đôn if the harvest calendar has a date open.\n\nDay 3 — Forest edge walk with Y Wik, then the coffee co-op in the afternoon. Depart evening.\n\nWant me to check which dates actually have availability?",
        answerVi:
          "Đây là một khung phù hợp cho lần đầu ghé thăm, ít di chuyển, mỗi ngày một buôn:\n\nNgày 1 — Đến Buôn Ma Thuột, chiều ghé Buôn Akô Dhông. Đi bộ một quãng ngắn, gặp chủ nhà, ăn cùng gia đình. Nghỉ lại qua đêm.\n\nNgày 2 — Sáng học dệt cùng Amí Lan ở Buôn Trấp. Chiều tự do. Tối xem đội cồng chiêng ở Buôn Đôn nếu lịch mùa vụ còn ngày trống.\n\nNgày 3 — Đi bộ ven rừng cùng Y Wik, chiều ghé hợp tác xã cà phê. Tối khởi hành về.\n\nBạn có muốn tôi kiểm tra xem những ngày nào thực sự còn chỗ không?",
        href: "#travel",
        attributedTo: "Reviewed script · community archive",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "culture",
        sortOrder: 3,
        question: "What is Cồng Chiêng?",
        questionVi: "Cồng Chiêng là gì?",
        answer:
          "A set of tuned gongs, and the practice around them. UNESCO recognised the Space of Gong Culture in the Central Highlands in 2005.\n\nWhat matters more than the recognition: the gongs are not performed for an audience in the ordinary sense. A set is tuned to a family and played at births, harvests, and funerals. Listeners in the buôn can hear which occasion is being marked.\n\nThat is why KNĂ lists ceremony evenings only when the village is holding one anyway, rather than scheduling them for visitors.",
        answerVi:
          "Là một bộ cồng chiêng đã được chỉnh âm, và toàn bộ tập tục xoay quanh nó. UNESCO đã công nhận Không gian Văn hoá Cồng chiêng Tây Nguyên vào năm 2005.\n\nĐiều quan trọng hơn cả sự công nhận ấy: cồng chiêng không được tấu lên để biểu diễn cho khán giả theo nghĩa thông thường. Mỗi bộ được chỉnh riêng cho một gia đình và được đánh trong lễ sinh, mùa gặt và tang lễ. Người trong buôn nghe là biết đang đánh cho dịp nào.\n\nĐó là lý do KNĂ chỉ đăng các buổi lễ khi làng vốn đã tổ chức, chứ không sắp lịch riêng cho du khách.",
        href: "#explore",
        attributedTo: "Reviewed script · community archive",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "language",
        sortOrder: 4,
        question: "How do I say thank you in Ê Đê?",
        questionVi: "Cảm ơn bằng tiếng Ê Đê nói thế nào?",
        answer:
          "“Bơni” is thank you, said with a slight bow of the head.\n\nA few more from the phrasebook: “Hê drei” is hello, used at any hour. “Kâo bi mơak” — I am glad to be here — is offered when entering a house. “Kâo lui” — I am leaving now — is said at the ladder, not at the gate.",
        answerVi:
          "“Bơni” là cảm ơn, nói kèm một cái cúi đầu nhẹ.\n\nThêm vài câu từ sổ tay: “Hê drei” là xin chào, dùng vào bất cứ giờ nào. “Kâo bi mơak” — tôi rất vui được ở đây — nói khi bước vào nhà. “Kâo lui” — tôi xin phép về — nói ở chân cầu thang, không phải ở cổng.",
        href: "#explore",
        attributedTo: "Phrasebook · Committee decision of April 2026",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "platform",
        sortOrder: 5,
        question: "Where does my money actually go?",
        questionVi: "Tiền của tôi thực sự đi về đâu?",
        answer:
          "Of every booking, 90% goes to the household that hosts you, 3% to the Community Fund, and 7% runs the platform. Marketplace orders split 95% to the artisan and 5% to the marketplace.\n\nEvery split is published, per transaction, on the public ledger in the Community space — you can check your own booking there.",
        answerVi:
          "Trong mỗi lượt đặt chỗ, 90% về thẳng hộ gia đình đón bạn, 3% vào Quỹ Cộng đồng, và 7% vận hành nền tảng. Đơn hàng thủ công chia 95% cho nghệ nhân và 5% cho chợ.\n\nTừng khoản chia đều được công khai, theo từng giao dịch, trên sổ cái minh bạch ở mục Cộng đồng — bạn có thể tự kiểm tra lượt đặt của mình ở đó.",
        href: "#community",
        attributedTo: "Platform records · public ledger",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "platform",
        sortOrder: 6,
        question: "How does my booking get confirmed?",
        questionVi: "Lượt đặt chỗ của tôi được xác nhận thế nào?",
        answer:
          "A booking stays pending until a KNĂ coordinator has confirmed the dates with the household — a person checks, not an algorithm.\n\nDuring the pilot nothing is charged online: payment is arranged with the household directly and the coordinator records it. You will see the booking move from pending to confirmed in your account.",
        answerVi:
          "Lượt đặt chỗ ở trạng thái chờ cho đến khi điều phối viên KNĂ xác nhận ngày với hộ gia đình — một con người kiểm tra, không phải thuật toán.\n\nTrong giai đoạn thí điểm, không khoản nào bị trừ trực tuyến: tiền được thu xếp trực tiếp với gia đình và điều phối viên ghi nhận lại. Bạn sẽ thấy lượt đặt chuyển từ chờ sang đã xác nhận trong tài khoản.",
        href: "#travel",
        attributedTo: "Platform records",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "platform",
        sortOrder: 7,
        question: "Who decides what appears in the cultural archive?",
        questionVi: "Ai quyết định nội dung nào được đưa vào kho lưu trữ văn hoá?",
        answer:
          "The Community Governance Committee. Nothing reaches the public archive until a Committee member reviews it and moves it to published, and refusals are recorded with their reason.\n\nThe Committee decided in April 2026 that everyday language is open to publish, while ceremonial and clan-specific speech stays with the households it belongs to.",
        answerVi:
          "Hội đồng Quản trị Cộng đồng. Không nội dung nào ra kho lưu trữ công khai trước khi một thành viên Hội đồng xem xét và duyệt đăng, và mỗi lần từ chối đều được ghi lại kèm lý do.\n\nTháng 4/2026, Hội đồng quyết định: ngôn ngữ đời thường được phép công bố, còn lời nói nghi lễ và riêng của dòng họ thì ở lại với các gia đình sở hữu chúng.",
        href: "#community",
        attributedTo: "Committee minutes · April 2026",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "platform",
        sortOrder: 8,
        question: "What is the KNĂ project (Business Model)?",
        questionVi: "Dự án KNĂ cung cấp những gì?",
        answer:
          "KNĂ is a digital platform offering 5 features: Digital Cultural Heritage Archive, Travel booking (verified local experiences directly with no middlemen), Community Marketplace (authentic handmade products), Community Forum, and an AI Travel Assistant.",
        answerVi:
          "KNĂ là nền tảng kỹ thuật số cung cấp 5 tính năng: Lưu trữ di sản văn hóa, Đặt tour du lịch trực tiếp, Chợ cộng đồng mua bán đồ thủ công, Diễn đàn chia sẻ kinh nghiệm, và Trợ lý du lịch AI.",
        href: "#about",
        attributedTo: "NEXUS Project Report",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "platform",
        sortOrder: 9,
        question: "What are the innovations of the KNĂ platform?",
        questionVi: "Những điểm đổi mới (Innovation) của KNĂ là gì?",
        answer:
          "KNĂ uses a Regenerative Circular Model with four mechanisms: Community Ownership (giving the Ê Đê community decision-making power), Blockchain Revenue Tracking (transparent transaction tracking via 'Proof of Impact'), an AI-personalized Carbon Footprint Tracker, and a virtuous loop where booking revenue funds community initiatives.",
        answerVi:
          "KNĂ sử dụng Mô hình Tuần hoàn Tái tạo với 4 cơ chế: Quyền làm chủ của cộng đồng Ê Đê, Theo dõi doanh thu minh bạch qua Blockchain (Proof of Impact), Theo dõi dấu chân carbon bằng AI, và tạo ra một vòng lặp có ích (doanh thu quay lại phục vụ cộng đồng).",
        href: "#about",
        attributedTo: "NEXUS Project Report",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "platform",
        sortOrder: 10,
        question: "What is the market size of KNĂ?",
        questionVi: "Quy mô thị trường (Market Size) của KNĂ?",
        answer:
          "Our Total Addressable Market (TAM) in Dak Lak is about 2.1 to 2.4 trillion VND per year. Our Serviceable Available Market (SAM) for eco and cultural tourism is 210 to 360 billion VND. Our Serviceable Obtainable Market (SOM) for our first year in 3 pilot villages is estimated at 3 to 5 billion VND in transaction value.",
        answerVi:
          "Tổng thị trường (TAM) tại Đắk Lắk đạt 2.1 - 2.4 nghìn tỷ VNĐ/năm. Thị trường khả dụng (SAM) khoảng 210 - 360 tỷ VNĐ. Mục tiêu thực tế trong năm đầu (SOM) cho 3 làng thí điểm dự kiến đạt giá trị giao dịch 3 - 5 tỷ VNĐ.",
        href: "#about",
        attributedTo: "NEXUS Project Report",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "culture",
        sortOrder: 11,
        question: "How does the Ê Đê matrilineal system work?",
        questionVi: "Chế độ mẫu hệ của người Ê Đê có đặc điểm gì?",
        answer:
          "The Ê Đê follow a matrilineal system where the mother is the head of the family, and children take their mother's surname. Daughters inherit the property and the longhouse. In marriage, it is the young woman's family who initiates the proposal to the young man's family, and the groom's family sets the bride price.",
        answerVi:
          "Người Ê Đê theo chế độ mẫu hệ, người mẹ làm chủ gia đình, của cải và nhà cửa truyền cho con gái. Con gái mang họ mẹ. Trong hôn nhân, nhà gái chủ động đi 'hỏi chồng' và nhà trai đưa ra yêu cầu thách cưới.",
        href: "#explore",
        attributedTo: "Community archive · Cultural guide",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "culture",
        sortOrder: 12,
        question: "What is Ê Đê epic literature (Khan)?",
        questionVi: "Sử thi (Khan) của người Ê Đê là gì?",
        answer:
          "Ê Đê literature features 'Klei duê' (rhyming speech) and 'Khan' (epics) such as the epic of Đam San and Xinh Nhã. These epics are typically sung or chanted in the longhouses, reflecting the community's desire for freedom and human beauty.",
        answerVi:
          "Lời nói vần (Klei duê) là nghệ thuật ngôn từ độc đáo. Đặc biệt, Sử thi (Khan) như Đam San, Xinh Nhã thường được hát kể (diễn xướng) trong nhà dài, phản ánh khát vọng tự do và vẻ đẹp con người Ê Đê.",
        href: "#explore",
        attributedTo: "Community archive · Cultural guide",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "culture",
        sortOrder: 13,
        question: "What are the features of an Ê Đê longhouse?",
        questionVi: "Kiến trúc nhà dài của người Ê Đê có gì đặc biệt?",
        answer:
          "The longhouse is a stilt house shaped like a long boat, accommodating an extended matrilineal family. A key feature is the carved wooden staircase, often depicting a crescent moon and breasts, symbolizing prosperity and the matriarch's authority.",
        answerVi:
          "Nhà dài là nhà sàn mang hình dáng con thuyền, nơi sinh sống của đại gia đình mẫu hệ. Cầu thang thường được đẽo gọt chạm khắc hình vầng trăng khuyết và bầu ngực, thể hiện sự no ấm và quyền uy của người phụ nữ.",
        href: "#explore",
        attributedTo: "Community archive · Cultural guide",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "culture",
        sortOrder: 14,
        question: "What is the Pthi atau (grave-abandonment) ceremony?",
        questionVi: "Lễ Bỏ mả (Pthi atau) là gì?",
        answer:
          "Unlike the Kinh people who hold annual death anniversaries, the Ê Đê bid a final farewell to the deceased in the 'Pthi atau' (grave-abandonment ceremony). It is a major festival with gong music and dancing, after which there are no more yearly anniversaries.",
        answerVi:
          "Khác với người Kinh có đám giỗ hàng năm, người Ê Đê tiễn biệt người chết một lần duy nhất vào Lễ Bỏ mả (Pthi atau). Đây là một ngày hội lớn của cả buôn với tiếng cồng chiêng và múa hát. Sau lễ này, gia đình sẽ không còn tổ chức cúng giỗ nữa.",
        href: "#explore",
        attributedTo: "Community archive · Cultural guide",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      },
      {
        topic: "culture",
        sortOrder: 15,
        question: "What is unique about Ê Đê cuisine?",
        questionVi: "Văn hóa ẩm thực Ê Đê có gì đặc trưng?",
        answer:
          "Ê Đê cuisine blends spicy, sour, and bitter flavors using natural herbs and spices. Signature ingredients include bitter eggplant, sour bamboo shoots, and papaya. Meals are seen as a time for close family connection.",
        answerVi:
          "Ẩm thực Ê Đê kết hợp tinh tế giữa vị cay, chua và đắng từ các loại lá và gia vị tự nhiên. Đặc trưng với các món như cà đắng, măng chua, đu đủ xào. Người Ê Đê coi bữa ăn là nơi giao tiếp thân mật của gia đình.",
        href: "#explore",
        attributedTo: "Community archive · Cultural guide",
        moderationStatus: "PUBLISHED",
        moderatedById: chair.id,
        moderatedAt: new Date("2026-06-10"),
      }
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
    knowledgeCards: 16,
  });
}
