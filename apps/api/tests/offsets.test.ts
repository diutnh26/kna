import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

/**
 * Carbon offsets attached to a booking.
 *
 * The screen has always said offsets sit on the same public ledger as
 * bookings and purchases. Until this existed, nothing on it reached the
 * database and the sentence described an intention. What is asserted here
 * is that it is now true — and true under the same rule as everything
 * else: a promise is not money until the stay is confirmed.
 */
describe("offsets", () => {
  let guestToken: string;
  let otherToken: string;
  let coordinatorToken: string;
  let listingId: string;
  let bookingA: string;
  let bookingB: string;

  beforeAll(async () => {
    await resetDb();
    await makeUser("guest@offset.kna", "GUEST");
    await makeUser("other@offset.kna", "GUEST");
    await makeUser("coord@offset.kna", "COORDINATOR");
    const host = await makeProvider("host@offset.kna");
    listingId = (await makeListing(host.provider.id, 500_000)).id;

    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;
    guestToken = await login("guest@offset.kna");
    otherToken = await login("other@offset.kna");
    coordinatorToken = await login("coord@offset.kna");

    const book = async (days: number) =>
      (
        await request(app)
          .post("/bookings")
          .set("Authorization", `Bearer ${guestToken}`)
          .send({ listingId, guests: 2, nights: 1, checkIn: soon(days) })
      ).body.id;
    bookingA = await book(10);
    bookingB = await book(40);
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  const attach = (body: object, token = guestToken) =>
    request(app).post("/offsets").set("Authorization", `Bearer ${token}`).send(body);

  it("refuses an anonymous caller", async () => {
    expect((await request(app).post("/offsets").send({})).status).toBe(401);
    expect((await request(app).get("/offsets/bookings")).status).toBe(401);
  });

  it("lists the caller's bookings, soonest arrival first", async () => {
    const res = await request(app)
      .get("/offsets/bookings")
      .set("Authorization", `Bearer ${guestToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(bookingA); // arrives sooner
    expect(res.body[0].offset).toBeNull();
    expect(res.body[0].listingTitle).toBeTruthy();
  });

  it("prices the offset on the server, not from the request", async () => {
    // Yok Đôn is 1,100₫/kg. A client that could name its own price could
    // donate 1₫ and have the public ledger say so.
    const res = await attach({ bookingId: bookingA, projectId: "yokdon", kgCo2e: 600 });

    expect(res.status).toBe(201);
    expect(res.body.amountVnd).toBe(600 * 1100);
    expect(res.body.kgCo2e).toBe(600);
  });

  it("writes one ledger row, with nothing retained", async () => {
    const rows = await prisma.ledgerEntry.findMany({ where: { offsetId: { not: null } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].totalVnd).toBe(660_000);
    // An offset is not a sale: no commission, no Fund share.
    expect(rows[0].platformFeeVnd).toBe(0);
    expect(rows[0].communityFundVnd).toBe(0);
    expect(rows[0].toLabel).toMatch(/Yok Đôn/);
  });

  it("keeps it off the public ledger until the booking is confirmed", async () => {
    const before = await request(app).get("/community/ledger");
    expect(before.body.filter((r: { offsetId: string | null }) => r.offsetId)).toHaveLength(0);

    const pending = await request(app)
      .get("/bookings/pending")
      .set("Authorization", `Bearer ${coordinatorToken}`);
    const target = pending.body.find((b: { id: string }) => b.id === bookingA);

    await request(app)
      .post(`/bookings/${target.id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "confirm" })
      .expect(200);

    const after = await request(app).get("/community/ledger");
    const offsetRows = after.body.filter((r: { offsetId: string | null }) => r.offsetId);
    expect(offsetRows).toHaveLength(1);
    expect(offsetRows[0].totalVnd).toBe(660_000);
  });

  it("changes the guest's mind rather than charging them twice", async () => {
    const res = await attach({ bookingId: bookingA, projectId: "lak", kgCo2e: 600 });
    expect(res.status).toBe(201);
    expect(res.body.amountVnd).toBe(600 * 950); // Lắk Lake rate

    // Still one offset and one ledger row for this booking.
    expect(await prisma.offsetContribution.count({ where: { bookingId: bookingA } })).toBe(1);
    const rows = await prisma.ledgerEntry.findMany({ where: { offsetId: { not: null } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].totalVnd).toBe(570_000);
  });

  it("lets a guest with two bookings offset each one separately", async () => {
    await attach({ bookingId: bookingB, projectId: "corridor", kgCo2e: 200 }).expect(201);

    const res = await request(app)
      .get("/offsets/bookings")
      .set("Authorization", `Bearer ${guestToken}`);

    const byId = Object.fromEntries(res.body.map((b: { id: string }) => [b.id, b]));
    expect(byId[bookingA].offset.projectId).toBe("lak");
    expect(byId[bookingB].offset.projectId).toBe("corridor");
  });

  it("will not attach an offset to somebody else's booking", async () => {
    const res = await attach({ bookingId: bookingA, projectId: "yokdon", kgCo2e: 100 }, otherToken);
    // Same answer as a missing booking, so ids cannot be probed.
    expect(res.status).toBe(404);
  });

  it("refuses to join a project that does not take visiting help", async () => {
    const res = await attach({
      bookingId: bookingB,
      projectId: "corridor",
      kgCo2e: 200,
      joining: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/year-round/i);
  });

  it("accepts joining on a project that does", async () => {
    const res = await attach({
      bookingId: bookingB,
      projectId: "yokdon",
      kgCo2e: 200,
      joining: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.joining).toBe(true);
  });

  it("rejects an unknown project and an absurd footprint", async () => {
    for (const body of [
      { bookingId: bookingB, projectId: "mars", kgCo2e: 100 },
      { bookingId: bookingB, projectId: "yokdon", kgCo2e: 0 },
      { bookingId: bookingB, projectId: "yokdon", kgCo2e: 999_999 },
    ]) {
      expect((await attach(body)).status).toBe(400);
    }
  });

  it("removes an offset and its ledger row together", async () => {
    await request(app)
      .delete(`/offsets/${bookingB}`)
      .set("Authorization", `Bearer ${guestToken}`)
      .expect(200);

    expect(await prisma.offsetContribution.count({ where: { bookingId: bookingB } })).toBe(0);
    const rows = await prisma.ledgerEntry.findMany({ where: { offsetId: { not: null } } });
    expect(rows).toHaveLength(1); // only bookingA's remains
  });

  it("shows the offset on its booking in the account timeline", async () => {
    const res = await request(app)
      .get("/account/activity")
      .set("Authorization", `Bearer ${guestToken}`);

    const booking = res.body.find((r: { id: string }) => r.id === bookingA);
    expect(booking.offset).toMatchObject({ projectId: "lak", kgCo2e: 600, amountVnd: 570_000 });
  });
});
