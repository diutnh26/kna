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
  let coordinatorToken: string;
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
    coordinatorToken = await login("coord@money.kna");
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

  it("starts a booking PENDING and keeps it out of the host's earnings", async () => {
    const created = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon() });
    expect(created.body.status).toBe("PENDING");

    const before = await request(app)
      .get("/providers/me")
      .set("Authorization", `Bearer ${hostToken}`);
    const earnedBefore = before.body.totals.bookingEarnedVnd;

    await request(app)
      .post(`/bookings/${created.body.id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "confirm" });

    const after = await request(app)
      .get("/providers/me")
      .set("Authorization", `Bearer ${hostToken}`);
    expect(after.body.totals.bookingEarnedVnd).toBe(earnedBefore + 450_000);
  });

  it("voids the ledger entry when a booking is declined, because no money moved", async () => {
    const created = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon() });

    const live = () => prisma.ledgerEntry.count({ where: { voidedAt: null } });
    const before = await live();
    const total = await prisma.ledgerEntry.count();

    const declined = await request(app)
      .post(`/bookings/${created.body.id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "decline" });
    expect(declined.body.status).toBe("CANCELLED");

    // One fewer live row, and none gone: the ledger is append-only.
    expect(await live()).toBe(before - 1);
    expect(await prisma.ledgerEntry.count()).toBe(total);
  });

  it("refuses coordination to a guest and to an anonymous caller", async () => {
    expect((await request(app).get("/bookings/pending")).status).toBe(401);
    const asGuest = await request(app)
      .get("/bookings/pending")
      .set("Authorization", `Bearer ${guestToken}`);
    expect(asGuest.status).toBe(403);
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

  it("puts the soonest arrival at the top of the coordinator queue", async () => {
    const far = soon(90);
    const near = soon(2);
    for (const checkIn of [far, near]) {
      await request(app)
        .post("/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ listingId, guests: 1, nights: 1, checkIn });
    }

    const queue = await request(app)
      .get("/bookings/pending")
      .set("Authorization", `Bearer ${coordinatorToken}`);

    const dates = queue.body.map((b: { checkIn: string }) => b.checkIn.slice(0, 10));
    expect(dates).toEqual([...dates].sort());
    expect(dates[0]).toBe(near);
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
