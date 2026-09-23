import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

/**
 * The booking money path, end to end. What is asserted here is the thing
 * the platform's whole argument rests on: what the guest is shown, what
 * the household is owed, and what appears on the public ledger are the
 * same numbers, always.
 */
describe("booking money path", () => {
  let guestToken: string;
  let hostToken: string;
  let listingId: string;

  beforeAll(async () => {
    await resetDb();
    await makeUser("guest@money.kna", "GUEST");
    await makeUser("coord@money.kna", "COORDINATOR");
    const host = await makeProvider("host@money.kna");
    listingId = (await makeListing(host.provider.id, 500_000)).id;

    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;
    guestToken = await login("guest@money.kna");
    hostToken = await login("host@money.kna");
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("refuses an unauthenticated booking", async () => {
    const res = await request(app).post("/bookings").send({ listingId, guests: 1, nights: 1, checkIn: soon() });
    expect(res.status).toBe(401);
  });

  it("computes the split on the server and writes a matching ledger row", async () => {
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 2, checkIn: soon() });

    expect(res.status).toBe(201);
    const b = res.body;

    expect(b.totalVnd).toBe(1_000_000);
    expect(b.platformFeeVnd).toBe(70_000);
    expect(b.communityFundVnd).toBe(30_000);
    expect(b.providerPayoutVnd).toBe(900_000);
    expect(b.platformFeeVnd + b.communityFundVnd + b.providerPayoutVnd).toBe(b.totalVnd);

    // The public ledger must agree with the booking, to the đồng.
    expect(b.ledgerEntry.totalVnd).toBe(b.totalVnd);
    expect(b.ledgerEntry.platformFeeVnd).toBe(b.platformFeeVnd);
    expect(b.ledgerEntry.communityFundVnd).toBe(b.communityFundVnd);
  });

  it("does not trust a client-supplied price", async () => {
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon(), totalVnd: 1, providerPayoutVnd: 999_999_999 });

    expect(res.status).toBe(201);
    expect(res.body.totalVnd).toBe(500_000);
    expect(res.body.providerPayoutVnd).toBe(450_000);
  });

  it("confirms a booking instantly, and counts it for the host only once it is paid", async () => {
    const created = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon() });
    expect(created.status).toBe(201);
    // No approval step: the provider opened these dates already.
    expect(created.body.status).toBe("CONFIRMED");
    expect(created.body.decidedVia).toBe("INSTANT");

    const earned = async () =>
      (await request(app).get("/providers/me").set("Authorization", `Bearer ${hostToken}`)).body
        .totals.bookingEarnedVnd;
    const before = await earned();

    // Booked is not paid: nothing has moved yet.
    expect(await earned()).toBe(before);

    // Paid at check-out (pay_booking) — the moment it counts.
    await prisma.booking.update({ where: { id: created.body.id }, data: { status: "COMPLETED" } });
    expect(await earned()).toBe(before + 450_000);
  });

  it("lets the guest cancel before check-in, voiding the ledger entry", async () => {
    const created = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon() });

    const live = () => prisma.ledgerEntry.count({ where: { voidedAt: null } });
    const before = await live();
    const total = await prisma.ledgerEntry.count();

    const cancelled = await request(app)
      .post(`/bookings/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${guestToken}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");

    // One fewer live row, and none gone: the ledger is append-only.
    expect(await live()).toBe(before - 1);
    expect(await prisma.ledgerEntry.count()).toBe(total);
  });

  it("refuses to cancel for an anonymous caller or another guest", async () => {
    const created = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon() });
    expect((await request(app).post(`/bookings/${created.body.id}/cancel`)).status).toBe(401);

    await makeUser("other@money.kna", "GUEST");
    const other = (
      await request(app).post("/auth/login").send({ email: "other@money.kna", password: PASSWORD })
    ).body.token;
    const res = await request(app)
      .post(`/bookings/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${other}`);
    expect(res.status).toBe(404);
  });

  it("keeps every ledger row internally consistent", async () => {
    const entries = await prisma.ledgerEntry.findMany();
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.platformFeeVnd + e.communityFundVnd).toBeLessThanOrEqual(e.totalVnd);
      expect(e.totalVnd).toBeGreaterThan(0);
    }
  });
  // ── Dates ──────────────────────────────────────────────────────────
  // `nights` used to be priced and then discarded, and there was no date
  // field at all: a coordinator could not tell the household which nights
  // to hold, and the total could not be reconciled against its inputs.

  it("stores the arrival date and the number of nights", async () => {
    const checkIn = soon(45);
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 3, checkIn });

    expect(res.status).toBe(201);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.nights).toBe(3);
    expect(stored.checkIn.toISOString().slice(0, 10)).toBe(checkIn);
    // …and the total is reconstructable from what was stored.
    expect(stored.totalVnd).toBe(500_000 * stored.nights);
  });

  it("refuses a booking with no date", async () => {
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1 });
    expect(res.status).toBe(400);
  });

  it("refuses a date in the past", async () => {
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon(-1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/past/i);
  });

  it("refuses quantities that would inflate the ledger", async () => {
    for (const payload of [
      { guests: 1, nights: 9_999 },
      { guests: 10_000, nights: 1 },
    ]) {
      const res = await request(app)
        .post("/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ listingId, checkIn: soon(), ...payload });
      expect(res.status).toBe(400);
    }
  });

  // ── Rooms and the calendar ─────────────────────────────────────────
  // The provider opens days at the listing's room count; a booking holds
  // its rooms on every night, all or nothing.

  async function singleRoomListing() {
    const host = await prisma.provider.findFirstOrThrow({ where: { user: { email: "host@money.kna" } } });
    const listing = await makeListing(host.id, 300_000);
    await prisma.listing.update({ where: { id: listing.id }, data: { inventory: 1 } });
    await prisma.availabilitySlot.updateMany({ where: { listingId: listing.id }, data: { capacity: 1 } });
    return listing.id;
  }

  const book = (id: string, checkIn: string, nights = 1, token = guestToken) =>
    request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ listingId: id, guests: 1, nights, checkIn });

  it("locks booked nights: the last room cannot be sold twice for overlapping dates", async () => {
    const id = await singleRoomListing();
    expect((await book(id, soon(10), 3)).status).toBe(201); // nights 10, 11, 12

    const overlap = await book(id, soon(12), 2); // 12 is taken
    expect(overlap.status).toBe(409);
    expect(overlap.body.error).toMatch(/fully booked/i);
    expect(overlap.body.date).toBe(soon(12));
    // All or nothing: night 13 was not left half-claimed by the failed booking.
    const night13 = await prisma.availabilitySlot.findFirstOrThrow({
      where: { listingId: id, date: new Date(`${soon(13)}T00:00:00Z`) },
    });
    expect(night13.booked).toBe(0);

    expect((await book(id, soon(13), 2)).status).toBe(201); // check-out day 13 is free again
  });

  it("gives the dates back when a booking is cancelled", async () => {
    const id = await singleRoomListing();
    const first = await book(id, soon(20));
    expect((await book(id, soon(20))).status).toBe(409);
    await request(app).post(`/bookings/${first.body.id}/cancel`).set("Authorization", `Bearer ${guestToken}`);
    expect((await book(id, soon(20))).status).toBe(201);
  });

  it("refuses dates the provider has not opened", async () => {
    const id = await singleRoomListing();
    const res = await book(id, soon(500));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/not open/i);
  });

  it("books as many rooms as the group needs, and prices per room", async () => {
    // Two guests per room: five guests need three rooms.
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 5, nights: 2, checkIn: soon(30) });
    expect(res.status).toBe(201);
    expect(res.body.rooms).toBe(3);
    expect(res.body.totalVnd).toBe(500_000 * 2 * 3);

    const tooFew = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 5, rooms: 2, nights: 1, checkIn: soon(30) });
    expect(tooFew.status).toBe(400);
  });

  it("sells the last room once when eight guests try at the same moment", async () => {
    const id = await singleRoomListing();
    const results = await Promise.all(Array.from({ length: 8 }, () => book(id, soon(40), 2)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    const slots = await prisma.availabilitySlot.findMany({
      where: { listingId: id, date: { in: [new Date(`${soon(40)}T00:00:00Z`), new Date(`${soon(41)}T00:00:00Z`)] } },
    });
    expect(slots.map((s) => s.booked)).toEqual([1, 1]);
  });

});

describe("marketplace money path", () => {
  let guestToken: string;
  let productId: string;

  beforeAll(async () => {
    await resetDb();
    await makeUser("buyer@money.kna", "GUEST");
    const maker = await makeProvider("maker@money.kna");
    productId = (
      await prisma.product.create({
        data: {
          providerId: maker.provider.id,
          category: "Basketry",
          title: "Test basket",
          note: "n",
          priceVnd: 950_000,
          stock: 2,
          published: true,
        },
      })
    ).id;

    guestToken = (
      await request(app).post("/auth/login").send({ email: "buyer@money.kna", password: PASSWORD })
    ).body.token;
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("applies the 5% fee and decrements stock", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ items: [{ productId, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.totalVnd).toBe(1_900_000);
    expect(res.body.marketplaceFeeVnd).toBe(95_000);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stock).toBe(0);
  });

  it("refuses to oversell, naming the piece", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ items: [{ productId, quantity: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Test basket");
  });

  it("keeps a sold-out piece on the public list, marked rather than hidden", async () => {
    // This test previously asserted the opposite. Filtering sold-out
    // pieces out made the card's own "Sold out" state unreachable, and
    // let a buyer see a purchase in their account that the marketplace
    // said did not exist.
    const res = await request(app).get("/products");
    const sold = res.body.find((p: { id: string }) => p.id === productId);

    expect(sold).toBeDefined();
    expect(sold.stock).toBe(0);
  });

  it("orders what can still be bought ahead of what cannot", async () => {
    // A second piece, in stock, created after the sold-out one — so
    // creation order alone would put it second.
    const maker = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    await prisma.product.create({
      data: {
        providerId: maker.providerId,
        category: "Textile",
        title: "Still available",
        note: "n",
        priceVnd: 100_000,
        stock: 3,
        published: true,
      },
    });

    const res = await request(app).get("/products");
    const stocks = res.body.map((p: { stock: number }) => p.stock > 0);
    // Every available piece precedes every sold-out one.
    expect(stocks).toEqual([...stocks].sort((a, b) => Number(b) - Number(a)));
    expect(res.body[res.body.length - 1].id).toBe(productId);
  });

  it("still refuses to sell a piece that has none left", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ items: [{ productId, quantity: 1 }] });

    // Visible is not buyable.
    expect(res.status).toBe(409);
  });

});
