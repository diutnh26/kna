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
    request(app)
      .post("/offsets")
      .set("Authorization", `Bearer ${token}`)
      // Every call needs a mode and an origin now; individual tests
      // override whichever they are about.
      .send({ mode: "DONATE", origin: "hcmc", ...body });

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
    // Yok Đôn is 1,100₫/kg, and Ho Chi Minh City is domestic, so the
    // full rate applies. A client that could name its own price could
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

  it("refuses to work a project that runs no sessions", async () => {
    for (const mode of ["IN_PERSON", "LEAVE_FORWARD"]) {
      const res = await attach({ bookingId: bookingB, projectId: "corridor", kgCo2e: 200, mode });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/year-round/i);
    }
  });

  it("rejects an unknown project and an absurd footprint", async () => {
    for (const body of [
      { bookingId: bookingB, projectId: "mars", kgCo2e: 100 },
      { bookingId: bookingB, projectId: "yokdon", kgCo2e: 0 },
      { bookingId: bookingB, projectId: "yokdon", kgCo2e: 999_999 },
      { bookingId: bookingB, projectId: "yokdon", kgCo2e: 100, mode: "SOMEDAY" },
      { bookingId: bookingB, projectId: "yokdon", kgCo2e: 100, origin: "mars" },
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

  // ── Two ways to take part ──────────────────────────────────────────
  //
  // Only yokdon and lak run sessions. Whether a guest can work one is a
  // fact about the calendar, so the server decides it: a client that could
  // assert its own eligibility could claim a free offset on any dates.

  describe("choosing how to take part", () => {
    /** A stay that certainly meets a session, and one that certainly does not. */
    async function bookAround(activityIso: string, offsetDays: number, nights: number) {
      const d = new Date(`${activityIso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + offsetDays);
      const checkIn = d.toISOString().slice(0, 10);
      const res = await request(app)
        .post("/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ listingId, guests: 1, nights, checkIn });
      return res.body.id as string;
    }

    /** The first Yok Đôn session comfortably in the future. */
    function nextYokDon(): string {
      const anchor = Date.UTC(2026, 0, 10);
      const day = 86_400_000;
      const soon = Date.now() + 60 * day;
      const periods = Math.ceil((soon - anchor) / (14 * day));
      return new Date(anchor + periods * 14 * day).toISOString().slice(0, 10);
    }

    it("reports the next session and whether the stay meets it", async () => {
      const activity = nextYokDon();
      const meets = await bookAround(activity, 0, 3); // arrives on the day

      const res = await request(app)
        .get("/offsets/bookings")
        .set("Authorization", `Bearer ${guestToken}`);
      const row = res.body.find((b: { id: string }) => b.id === meets);

      expect(row.activity.yokdon.nextActivityDate).toBe(activity);
      expect(row.activity.yokdon.eligible).toBe(true);
      // The corridor runs no sessions at all.
      expect(row.activity.corridor.nextActivityDate).toBeNull();
      expect(row.activity.corridor.eligible).toBe(false);
    });

    it("accepts working a session that falls inside the stay, for nothing", async () => {
      const activity = nextYokDon();
      const meets = await bookAround(activity, 0, 3);

      const res = await attach({
        bookingId: meets,
        projectId: "yokdon",
        kgCo2e: 400,
        mode: "IN_PERSON",
      });

      expect(res.status).toBe(201);
      expect(res.body.amountVnd).toBe(0);
      expect(res.body.eligible).toBe(true);
      // Work is not money, so it writes no ledger row.
      const rows = await prisma.ledgerEntry.findMany({ where: { offsetId: res.body.id } });
      expect(rows).toHaveLength(0);
    });

    it("refuses IN_PERSON when no session falls in the dates", async () => {
      const activity = nextYokDon();
      const misses = await bookAround(activity, 3, 1); // three days after, one night

      const res = await attach({
        bookingId: misses,
        projectId: "yokdon",
        kgCo2e: 400,
        mode: "IN_PERSON",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no planting day/i);
    });

    it("accepts LEAVE_FORWARD only when the guest genuinely cannot attend", async () => {
      const activity = nextYokDon();

      const misses = await bookAround(activity, 3, 1);
      const left = await attach({
        bookingId: misses,
        projectId: "yokdon",
        kgCo2e: 400,
        mode: "LEAVE_FORWARD",
      });
      expect(left.status).toBe(201);
      expect(left.body.amountVnd).toBe(0);

      // Somebody who *can* attend is told to attend rather than stand aside.
      const meets = await bookAround(activity, 0, 3);
      const refused = await attach({
        bookingId: meets,
        projectId: "yokdon",
        kgCo2e: 400,
        mode: "LEAVE_FORWARD",
      });
      expect(refused.status).toBe(400);
      expect(refused.body.error).toMatch(/join it yourself/i);
    });
  });

  // ── What a donation costs ──────────────────────────────────────────

  describe("donation rates", () => {
    it("charges a long-haul guest the adjusted share on a session project", async () => {
      // The Community Fund already pays for the saplings, so a guest who
      // has flown in covers the cost of running the session, not the trees.
      for (const origin of ["asia", "europe"]) {
        const res = await attach({
          bookingId: bookingA,
          projectId: "yokdon",
          kgCo2e: 600,
          mode: "DONATE",
          origin,
        });
        expect(res.status).toBe(201);
        expect(res.body.amountVnd).toBe(Math.round(600 * 1100 * 0.35));
        expect(res.body.origin).toBe(origin);
      }
    });

    it("charges a domestic guest the full rate, unadjusted", async () => {
      for (const origin of ["hcmc", "hanoi", "danang"]) {
        const res = await attach({
          bookingId: bookingA,
          projectId: "lak",
          kgCo2e: 600,
          mode: "DONATE",
          origin,
        });
        expect(res.status).toBe(201);
        expect(res.body.amountVnd).toBe(600 * 950);
      }
    });

    it("charges the corridor at full rate from anywhere", async () => {
      // No sessions, no adjustment — this project is unchanged.
      for (const origin of ["hcmc", "hanoi", "danang", "asia", "europe"]) {
        const res = await attach({
          bookingId: bookingA,
          projectId: "corridor",
          kgCo2e: 200,
          mode: "DONATE",
          origin,
        });
        expect(res.status).toBe(201);
        expect(res.body.amountVnd).toBe(200 * 1350);
      }
    });

    it("says on the ledger what kind of contribution a long-haul donation is", async () => {
      const res = await attach({
        bookingId: bookingA,
        projectId: "yokdon",
        kgCo2e: 600,
        mode: "DONATE",
        origin: "europe",
      });
      const row = await prisma.ledgerEntry.findFirstOrThrow({ where: { offsetId: res.body.id } });
      expect(row.toLabel).toMatch(/towards running the session/i);

      const domestic = await attach({
        bookingId: bookingA,
        projectId: "yokdon",
        kgCo2e: 600,
        mode: "DONATE",
        origin: "hcmc",
      });
      const plain = await prisma.ledgerEntry.findFirstOrThrow({
        where: { offsetId: domestic.body.id },
      });
      expect(plain.toLabel).toBe("Yok Đôn buffer replanting");
    });
  });

});
