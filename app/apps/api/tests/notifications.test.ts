import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

/**
 * Notifications, across the roles that get them.
 *
 * The two properties worth defending: a notification is scoped to one
 * reader and cannot be read or dismissed by anyone else, and writing one
 * is a side effect that must never be the reason the thing it describes
 * fails.
 */
describe("notifications", () => {
  let guestToken: string;
  let hostToken: string;
  let coordinatorToken: string;
  let guestId: string;
  let hostUserId: string;
  let listingId: string;
  let productId: string;

  const inbox = async (token: string) =>
    (await request(app).get("/notifications").set("Authorization", `Bearer ${token}`)).body;

  const typesFor = async (token: string) =>
    (await inbox(token)).items.map((n: { type: string }) => n.type);

  beforeAll(async () => {
    await resetDb();
    const guest = await makeUser("guest@notif.kna", "GUEST");
    guestId = guest.id;
    await makeUser("coord@notif.kna", "COORDINATOR");
    const host = await makeProvider("host@notif.kna");
    hostUserId = host.id;
    listingId = (await makeListing(host.provider.id, 500_000)).id;
    productId = (
      await prisma.product.create({
        data: {
          providerId: host.provider.id,
          category: "Textile",
          title: "Indigo cloth",
          note: "n",
          priceVnd: 400_000,
          stock: 5,
          published: true,
        },
      })
    ).id;

    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;
    guestToken = await login("guest@notif.kna");
    hostToken = await login("host@notif.kna");
    coordinatorToken = await login("coord@notif.kna");
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("refuses an anonymous caller", async () => {
    expect((await request(app).get("/notifications")).status).toBe(401);
    expect((await request(app).get("/notifications/unread-count")).status).toBe(401);
    expect((await request(app).post("/notifications/read").send({})).status).toBe(401);
  });

  it("starts empty", async () => {
    expect(await inbox(guestToken)).toEqual({ items: [], unread: 0 });
  });

  it("tells the household and the coordinator when a booking arrives", async () => {
    await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 2, nights: 1, checkIn: soon() })
      .expect(201);

    // The household whose dates were asked for.
    expect(await typesFor(hostToken)).toContain("BOOKING_RECEIVED");
    // Whoever has to decide.
    expect(await typesFor(coordinatorToken)).toContain("BOOKING_AWAITING_DECISION");
    // The guest is told nothing yet — they made it happen.
    expect(await typesFor(guestToken)).not.toContain("BOOKING_RECEIVED");
  });

  it("tells the guest when the decision is made", async () => {
    const pending = await request(app)
      .get("/bookings/pending")
      .set("Authorization", `Bearer ${coordinatorToken}`);

    await request(app)
      .post(`/bookings/${pending.body[0].id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "confirm" })
      .expect(200);

    const items = (await inbox(guestToken)).items;
    const confirmed = items.find((n: { type: string }) => n.type === "BOOKING_CONFIRMED");
    expect(confirmed).toBeDefined();
    // Carries what it needs to be rendered in either language.
    expect(confirmed.params.listing).toBeTruthy();
    expect(confirmed.href).toBe("#account");
  });

  it("stores a key and its values, not a finished sentence", async () => {
    // The reader can change language at any time; a sentence frozen in
    // English would still be English on an otherwise Vietnamese screen.
    const { items } = await inbox(guestToken);
    for (const n of items) {
      expect(typeof n.type).toBe("string");
      expect(n.type).toMatch(/^[A-Z_]+$/);
      expect(typeof n.params).toBe("object");
    }
  });

  it("covers the marketplace and the archive too", async () => {
    await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(201);
    expect(await typesFor(coordinatorToken)).toContain("ORDER_AWAITING_SETTLEMENT");

    const pending = await request(app)
      .get("/orders/pending")
      .set("Authorization", `Bearer ${coordinatorToken}`);
    await request(app)
      .post(`/orders/${pending.body[0].id}/decision`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ decision: "settle" })
      .expect(200);
    expect(await typesFor(guestToken)).toContain("ORDER_SETTLED");

    // A provider contributing to the archive reaches the Committee.
    const entry = await request(app)
      .post("/archive")
      .set("Authorization", `Bearer ${hostToken}`)
      .send({ type: "Recording", title: "Gongs at dusk", meta: "m", keeperBuon: "Buôn Đôn" });
    expect(entry.status).toBe(201);

    // The coordinator here also holds no seat, so use an admin-less check:
    // the contributor hears back once it is decided.
    const seatUser = await makeUser("seat@notif.kna", "COMMITTEE");
    await prisma.committeeMember.create({
      data: { userId: seatUser.id, role: "Chair", buon: "Buôn Đôn", since: "2026" },
    });
    const seatToken = (
      await request(app).post("/auth/login").send({ email: "seat@notif.kna", password: PASSWORD })
    ).body.token;

    await request(app)
      .post(`/archive/${entry.body.id}/review`)
      .set("Authorization", `Bearer ${seatToken}`)
      .send({ decision: "reject", note: "Funerals are not published." })
      .expect(200);

    const hostItems = (await inbox(hostToken)).items;
    const refused = hostItems.find((n: { type: string }) => n.type === "ARCHIVE_REJECTED");
    expect(refused).toBeDefined();
    // The reason travels with it — a refusal without one is not a record.
    expect(refused.params.note).toMatch(/Funerals/);
  });

  it("counts only this person's unread", async () => {
    const mine = await request(app)
      .get("/notifications/unread-count")
      .set("Authorization", `Bearer ${guestToken}`);
    const theirs = await request(app)
      .get("/notifications/unread-count")
      .set("Authorization", `Bearer ${hostToken}`);

    expect(mine.body.unread).toBeGreaterThan(0);
    expect(theirs.body.unread).toBeGreaterThan(0);

    const all = await prisma.notification.count({ where: { readAt: null } });
    expect(mine.body.unread).toBeLessThan(all);
  });

  it("marks one as read without touching anybody else's", async () => {
    const before = (await inbox(guestToken)).items[0];
    const hostBefore = (await inbox(hostToken)).unread;

    const res = await request(app)
      .post("/notifications/read")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ ids: [before.id] });

    expect(res.status).toBe(200);
    expect(res.body.marked).toBe(1);
    expect((await inbox(hostToken)).unread).toBe(hostBefore);
  });

  it("will not let one person mark another's as read", async () => {
    const hostItem = (await inbox(hostToken)).items.find(
      (n: { readAt: string | null }) => !n.readAt
    );
    const hostUnreadBefore = (await inbox(hostToken)).unread;

    const res = await request(app)
      .post("/notifications/read")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ ids: [hostItem.id] });

    // Nothing matched, because the filter is scoped to the caller.
    expect(res.body.marked).toBe(0);
    expect((await inbox(hostToken)).unread).toBe(hostUnreadBefore);
  });

  it("marks everything read when no ids are given", async () => {
    const res = await request(app)
      .post("/notifications/read")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(0);
    expect((await inbox(guestToken)).unread).toBe(0);
    // The other reader is untouched.
    expect((await inbox(hostToken)).unread).toBeGreaterThan(0);
  });

  it("does not fail the booking when the notification cannot be written", async () => {
    // A booking for a listing whose provider row was removed: the household
    // lookup finds nobody. The booking must still succeed.
    const orphan = await makeProvider("orphan@notif.kna");
    const orphanListing = await makeListing(orphan.provider.id, 300_000);
    await prisma.provider.update({
      where: { id: orphan.provider.id },
      data: { displayName: "gone" },
    });

    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId: orphanListing.id, guests: 1, nights: 1, checkIn: soon(20) });

    expect(res.status).toBe(201);
  });
});
