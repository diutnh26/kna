import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

/**
 * The public ledger, which is the artifact this platform's whole argument
 * rests on — and which had no endpoint test at all while it was wrong.
 *
 * The rule under test: a row appears publicly only once the money it
 * describes has actually moved. A booking waiting on a coordinator is a
 * promise; publishing it as a distribution overstates what reached the
 * community, and does so in exactly the place a reader is being asked to
 * take the platform at its word.
 */
describe("public ledger", () => {
  let guestToken: string;
  let coordinatorToken: string;
  let listingId: string;
  let productId: string;

  beforeAll(async () => {
    await resetDb();
    await makeUser("guest@ledger.kna", "GUEST");
    await makeUser("coord@ledger.kna", "COORDINATOR");
    const host = await makeProvider("host@ledger.kna");
    listingId = (await makeListing(host.provider.id, 500_000)).id;

    productId = (
      await prisma.product.create({
        data: {
          providerId: host.provider.id,
          category: "Textile",
          title: "Indigo cloth",
          note: "n",
          priceVnd: 400_000,
          stock: 10,
          published: true,
        },
      })
    ).id;

    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;
    guestToken = await login("guest@ledger.kna");
    coordinatorToken = await login("coord@ledger.kna");
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  const ledger = async () => (await request(app).get("/community/ledger")).body;
  const stats = async () => (await request(app).get("/community/stats")).body;

  it("starts empty", async () => {
    expect(await ledger()).toEqual([]);
  });

  it("does NOT publish a booking that is still awaiting confirmation", async () => {
    const booking = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 2, nights: 1, checkIn: soon() });
    expect(booking.status).toBe(201);

    // The row exists — it is the record of what the guest was shown.
    expect(await prisma.ledgerEntry.count()).toBe(1);
    // It is simply not public yet.
    expect(await ledger()).toEqual([]);

    const s = await stats();
    expect(s.ledgerEntriesToday).toBe(0);
    expect(s.ledgerEntriesAwaiting).toBe(1);
  });

  it("publishes it once a coordinator confirms", async () => {
    const pending = await request(app)
      .get("/bookings/pending")
      .set("Authorization", `Bearer ${coordinatorToken}`);
    const id = pending.body[0].id;

    await request(app)
      .post(`/bookings/${id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "confirm" })
      .expect(200);

    // 500,000/night × 1 night. The 7/3 split of the booking fee schedule.
    const rows = await ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0].totalVnd).toBe(500_000);
    expect(rows[0].platformFeeVnd).toBe(35_000);
    expect(rows[0].communityFundVnd).toBe(15_000);

    const s = await stats();
    expect(s.ledgerEntriesToday).toBe(1);
    expect(s.ledgerEntriesAwaiting).toBe(0);
  });

  it("never publishes a declined booking", async () => {
    const booking = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon() });

    await request(app)
      .post(`/bookings/${booking.body.id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "decline" })
      .expect(200);

    expect(await ledger()).toHaveLength(1); // still just the confirmed one

    // Append-only: the row the guest was shown survives, voided, with who
    // declined it and why.
    const row = await prisma.ledgerEntry.findFirstOrThrow({ where: { bookingId: booking.body.id } });
    expect(row.voidedAt).not.toBeNull();
    expect(row.voidReason).toBe("booking declined");
    const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "coord@ledger.kna" } });
    expect(row.voidedById).toBe(coordinator.id);
    expect((await stats()).ledgerEntriesAwaiting).toBe(0);
  });

  it("holds marketplace orders to the same rule", async () => {
    const order = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ items: [{ productId, quantity: 1 }] });
    expect(order.status).toBe(201);

    expect(await ledger()).toHaveLength(1); // not yet — order is PENDING

    await request(app)
      .post(`/orders/${order.body.id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "settle" })
      .expect(200);

    const rows = await ledger();
    expect(rows).toHaveLength(2);
    expect(rows[0].totalVnd).toBe(400_000);
    expect(rows[0].platformFeeVnd).toBe(20_000); // 5%
    expect(rows[0].communityFundVnd).toBe(0);
  });

  it("returns stock and voids the ledger row when an order is cancelled", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

    const order = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ items: [{ productId, quantity: 3 }] });

    const during = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(during.stock).toBe(before.stock - 3);

    await request(app)
      .post(`/orders/${order.body.id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "cancel" })
      .expect(200);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(after.stock).toBe(before.stock);
    expect(await ledger()).toHaveLength(2);

    const row = await prisma.ledgerEntry.findFirstOrThrow({ where: { orderId: order.body.id } });
    expect(row.voidedAt).not.toBeNull();
    expect(row.voidReason).toBe("order cancelled");
  });

  it("refuses order settlement to a guest and to an anonymous caller", async () => {
    expect((await request(app).get("/orders/pending")).status).toBe(401);
    expect(
      (await request(app).get("/orders/pending").set("Authorization", `Bearer ${guestToken}`)).status
    ).toBe(403);
  });

  it("caps the limit a caller can ask for", async () => {
    const res = await request(app).get("/community/ledger?limit=9999");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(100);
  });
});
