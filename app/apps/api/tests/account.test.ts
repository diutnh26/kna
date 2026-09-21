import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

/**
 * A person's own account, and the money figures on it.
 *
 * The rule under test is the same one the public ledger had to learn:
 * nothing counts until it has actually moved. Here the error would run the
 * other way — inflating what a visitor believes they have contributed —
 * which is no better for being flattering.
 */
describe("account", () => {
  let guestToken: string;
  let coordinatorToken: string;
  let listingId: string;
  let productId: string;

  beforeAll(async () => {
    await resetDb();
    await makeUser("guest@account.kna", "GUEST");
    await makeUser("coord@account.kna", "COORDINATOR");
    const host = await makeProvider("host@account.kna");
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
    guestToken = await login("guest@account.kna");
    coordinatorToken = await login("coord@account.kna");
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  const account = async (token = guestToken) =>
    (await request(app).get("/account").set("Authorization", `Bearer ${token}`)).body;

  it("refuses an anonymous caller", async () => {
    expect((await request(app).get("/account")).status).toBe(401);
    expect((await request(app).get("/account/activity")).status).toBe(401);
  });

  it("describes a new account with nothing on it", async () => {
    const { user, totals } = await account();
    expect(user.email).toBe("guest@account.kna");
    expect(user.provider).toBeNull();
    expect(user.isCommitteeMember).toBe(false);
    expect(totals).toMatchObject({
      bookings: 0,
      orders: 0,
      contributions: 0,
      spentVnd: 0,
      toProvidersVnd: 0,
      toCommunityFundVnd: 0,
    });
  });

  it("never returns the password hash", async () => {
    const body = await account();
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it("counts a pending booking without counting its money", async () => {
    await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 2, nights: 1, checkIn: soon() })
      .expect(201);

    const { totals } = await account();
    expect(totals.bookings).toBe(1);
    expect(totals.bookingsAwaiting).toBe(1);
    // Nothing has moved yet.
    expect(totals.spentVnd).toBe(0);
    expect(totals.toProvidersVnd).toBe(0);
    expect(totals.toCommunityFundVnd).toBe(0);
  });

  it("counts the money once a coordinator confirms", async () => {
    const pending = await request(app)
      .get("/bookings/pending")
      .set("Authorization", `Bearer ${coordinatorToken}`);

    await request(app)
      .post(`/bookings/${pending.body[0].id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "confirm" })
      .expect(200);

    const { totals } = await account();
    expect(totals.spentVnd).toBe(500_000);
    expect(totals.toProvidersVnd).toBe(450_000); // 90%
    expect(totals.toCommunityFundVnd).toBe(15_000); // 3%
    expect(totals.bookingsAwaiting).toBe(0);
  });

  it("labels a guest account as the guest money view", async () => {
    const body = await account();
    expect(body.moneyView).toBe("guest");
    expect(body.providerMoney).toBeNull();
    expect(body.staffMoney).toBeNull();
  });

  it("shows the provider what their confirmed bookings earned", async () => {
    const hostToken = (
      await request(app).post("/auth/login").send({ email: "host@account.kna", password: PASSWORD })
    ).body.token as string;

    const body = await account(hostToken);
    expect(body.moneyView).toBe("provider");
    expect(body.providerMoney.earnedVnd).toBe(450_000);
    expect(body.providerMoney.fundVnd).toBe(15_000);
    expect(body.staffMoney).toBeNull();
  });

  it("shows the coordinator platform totals, including demo mints", async () => {
    const before = await account(coordinatorToken);
    expect(before.moneyView).toBe("staff");
    expect(before.staffMoney.settledBookingsVnd).toBe(500_000);
    expect(before.staffMoney.toProvidersVnd).toBe(450_000);
    expect(before.staffMoney.paidWithDemo).toBe(0);

    await prisma.booking.updateMany({
      data: {
        paymentStatus: "PAID",
        demoTxSigs: JSON.stringify(["sigA", "sigB"]),
      },
    });

    const after = await account(coordinatorToken);
    expect(after.staffMoney.paidWithDemo).toBe(1);
  });

  it("lets a provider see stays on their listings, and staff see every booking", async () => {
    const otherHost = await makeProvider("otherhost@account.kna");
    const otherListing = await makeListing(otherHost.provider.id, 200_000);
    await prisma.listing.update({
      where: { id: otherListing.id },
      data: { title: "Other household stay" },
    });
    const stranger = await makeUser("stranger@account.kna", "GUEST");
    await prisma.booking.create({
      data: {
        listingId: otherListing.id,
        guestId: stranger.id,
        guests: 1,
        checkIn: new Date(`${soon(40)}T00:00:00Z`),
        nights: 1,
        totalVnd: 200_000,
        platformFeeVnd: 14_000,
        communityFundVnd: 6_000,
        providerPayoutVnd: 180_000,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        demoTxSigs: JSON.stringify(["onlyStaff"]),
      },
    });

    const hostToken = (
      await request(app).post("/auth/login").send({ email: "host@account.kna", password: PASSWORD })
    ).body.token as string;

    const providerActivity = await request(app)
      .get("/account/activity")
      .set("Authorization", `Bearer ${hostToken}`);
    const providerTitles = providerActivity.body
      .filter((row: { kind: string }) => row.kind === "booking")
      .map((row: { title: string }) => row.title);
    expect(providerTitles).toContain("Test longhouse");
    expect(providerTitles).not.toContain("Other household stay");

    const hostBooking = providerActivity.body.find(
      (row: { kind: string; title: string }) => row.kind === "booking" && row.title === "Test longhouse"
    );
    expect(hostBooking.demoTxSigs).toEqual(["sigA", "sigB"]);

    const staffActivity = await request(app)
      .get("/account/activity")
      .set("Authorization", `Bearer ${coordinatorToken}`);
    const staffTitles = staffActivity.body
      .filter((row: { kind: string }) => row.kind === "booking")
      .map((row: { title: string }) => row.title);
    expect(staffTitles).toContain("Test longhouse");
    expect(staffTitles).toContain("Other household stay");
  });

  it("adds a settled marketplace order at the artisan's 95%", async () => {
    const order = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ items: [{ productId, quantity: 1 }] });
    expect(order.status).toBe(201);

    // Still pending: counted as an order, not as money.
    let totals = (await account()).totals;
    expect(totals.orders).toBe(1);
    expect(totals.ordersAwaiting).toBe(1);
    expect(totals.spentVnd).toBe(500_000);

    await request(app)
      .post(`/orders/${order.body.id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "settle" })
      .expect(200);

    totals = (await account()).totals;
    expect(totals.spentVnd).toBe(900_000);
    expect(totals.toProvidersVnd).toBe(450_000 + 380_000); // 95% of 400,000
    expect(totals.toCommunityFundVnd).toBe(15_000); // marketplace pays no Fund share
  });

  it("returns one timeline, newest first, across all three kinds", async () => {
    const res = await request(app)
      .get("/account/activity")
      .set("Authorization", `Bearer ${guestToken}`);

    expect(res.status).toBe(200);
    const kinds = res.body.map((r: { kind: string }) => r.kind);
    expect(kinds).toContain("booking");
    expect(kinds).toContain("order");

    const dates = res.body.map((r: { at: string }) => new Date(r.at).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));

    const booking = res.body.find((r: { kind: string }) => r.kind === "booking");
    expect(booking.title).toBeTruthy();
    expect(booking.checkIn).toBeTruthy();
    expect(booking.toProviderVnd).toBe(450_000);
  });

  it("shows only this person's activity", async () => {
    await makeUser("other@account.kna", "GUEST");
    const otherToken = (
      await request(app).post("/auth/login").send({ email: "other@account.kna", password: PASSWORD })
    ).body.token;

    const res = await request(app)
      .get("/account/activity")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.body).toEqual([]);

    const { totals } = await account(otherToken);
    expect(totals.bookings).toBe(0);
    expect(totals.spentVnd).toBe(0);
  });

  // ── Profile ────────────────────────────────────────────────────────

  it("updates a name and a language", async () => {
    const res = await request(app)
      .patch("/account")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ fullName: "H'Linh Êban", locale: "vi" });

    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe("H'Linh Êban");
    expect(res.body.user.locale).toBe("vi");
  });

  it("rejects an empty name and an unknown language", async () => {
    for (const payload of [{ fullName: "   " }, { locale: "fr" }, {}]) {
      const res = await request(app)
        .patch("/account")
        .set("Authorization", `Bearer ${guestToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    }
  });

  it("will not let the account change its own role or email here", async () => {
    await request(app)
      .patch("/account")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ role: "ADMIN", email: "elsewhere@account.kna" });

    const { user } = await account();
    expect(user.role).toBe("GUEST");
    expect(user.email).toBe("guest@account.kna");
  });

  // ── Password ───────────────────────────────────────────────────────

  it("refuses a password change without the current password", async () => {
    const res = await request(app)
      .post("/account/password")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ currentPassword: "not-it", newPassword: "a-much-better-password1" });
    expect(res.status).toBe(403);
  });

  it("refuses a new password that is too short, or unchanged", async () => {
    const short = await request(app)
      .post("/account/password")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ currentPassword: PASSWORD, newPassword: "short" });
    expect(short.status).toBe(400);

    const same = await request(app)
      .post("/account/password")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(same.status).toBe(400);
  });

  it("changes the password, ends other sessions, and keeps this one usable", async () => {
    // A second device, signed in before the change.
    const otherDevice = (
      await request(app).post("/auth/login").send({ email: "guest@account.kna", password: PASSWORD })
    ).body.token;

    const res = await request(app)
      .post("/account/password")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ currentPassword: PASSWORD, newPassword: "a-much-better-password1" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    // The other device is out.
    expect(
      (await request(app).get("/account").set("Authorization", `Bearer ${otherDevice}`)).status
    ).toBe(401);

    // The returned token works, so changing your password does not sign you
    // out of the tab you changed it in.
    expect(
      (await request(app).get("/account").set("Authorization", `Bearer ${res.body.token}`)).status
    ).toBe(200);

    // And the new password is the one that works.
    const relogin = await request(app)
      .post("/auth/login")
      .send({ email: "guest@account.kna", password: "a-much-better-password1" });
    expect(relogin.status).toBe(200);
  });

  it("returns the archive photograph on the public list", async () => {
    // Regression: imageUrl was added to the schema, written to every row
    // and rendered by the client, but this endpoint uses an explicit
    // select and silently omitted it. Nothing failed — the field was just
    // undefined, and every card fell back to its placeholder.
    const entry = await prisma.archiveEntry.create({
      data: {
        type: "Recording",
        title: "Gong set, harvest",
        meta: "m",
        keeperBuon: "Buôn Đôn",
        moderationStatus: "PUBLISHED",
        imageUrl: "/images/archive/harvest-gong-set.jpg",
      },
    });

    const res = await request(app).get("/archive");
    const found = res.body.find((e: { id: string }) => e.id === entry.id);
    expect(found?.imageUrl).toBe("/images/archive/harvest-gong-set.jpg");
  });

});
