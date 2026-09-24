import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { RESOURCES } from "../src/admin/resources";
import { PASSWORD, app, giveSeat, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

const login = async (email: string, password = PASSWORD) =>
  (await request(app).post("/auth/login").send({ email, password })).body.token as string;
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * The admin console: ADMIN only, every change audited, money and chain
 * records changed only through the platform's own rules, and publishing
 * to the archive and phrasebook left to the Committee.
 */
describe("admin console", () => {
  let admin: string;
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    adminId = (await makeUser("admin@adm.kna", "ADMIN")).id;
    admin = await login("admin@adm.kna");
  });

  describe("access", () => {
    it("is closed to everyone but admins, for every resource", async () => {
      await makeUser("guest@adm.kna", "GUEST");
      await makeUser("coord@adm.kna", "COORDINATOR");
      await makeProvider("host@adm.kna");
      const seat = await makeUser("seat@adm.kna", "COMMITTEE");
      await giveSeat(seat.id);

      expect((await request(app).get("/admin/meta")).status).toBe(401);
      for (const email of ["guest@adm.kna", "coord@adm.kna", "host@adm.kna", "seat@adm.kna"]) {
        const token = await login(email);
        expect((await request(app).get("/admin/meta").set(as(token))).status).toBe(403);
        for (const r of RESOURCES) {
          const res = await request(app).get(`/admin/${r.name}`).set(as(token));
          expect(res.status, `${email} → ${r.name}`).toBe(403);
        }
      }
    });

    it("describes every resource and lists each of them", async () => {
      const meta = await request(app).get("/admin/meta").set(as(admin));
      expect(meta.status).toBe(200);
      expect(meta.body.resources.map((r: { name: string }) => r.name)).toEqual(RESOURCES.map((r) => r.name));
      for (const r of RESOURCES) {
        const res = await request(app).get(`/admin/${r.name}`).set(as(admin));
        expect(res.status, r.name).toBe(200);
        expect(res.body).toMatchObject({ page: 1, pageSize: 25 });
      }
    });

    it("never sends password hashes or wallet keys", async () => {
      await prisma.wallet.create({ data: { userId: adminId, pubkey: "PubKey111", encryptedSecret: "v1:secret" } });
      const users = await request(app).get("/admin/users").set(as(admin));
      expect(users.body.rows[0]).not.toHaveProperty("passwordHash");
      expect(users.body.rows[0]).not.toHaveProperty("tokenVersion");
      const wallets = await request(app).get("/admin/wallets").set(as(admin));
      expect(wallets.body.rows[0].pubkey).toBe("PubKey111");
      expect(JSON.stringify(wallets.body)).not.toContain("v1:secret");
    });

    it("accepts changes only as JSON", async () => {
      const res = await request(app)
        .post("/admin/fund")
        .set(as(admin))
        .set("Content-Type", "text/plain")
        .send("quarter=Q3 2026");
      expect(res.status).toBe(415);
    });
  });

  describe("users", () => {
    it("creates an account that can sign in, and audits it without the password", async () => {
      const res = await request(app)
        .post("/admin/users")
        .set(as(admin))
        .send({ email: "New@Adm.kna", fullName: "New Person", role: "PROVIDER", password: "temporary1" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ email: "new@adm.kna", role: "PROVIDER" });
      expect(res.body).not.toHaveProperty("passwordHash");
      expect(await login("new@adm.kna", "temporary1")).toBeTruthy();

      const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { resource: "users", action: "create" } });
      expect(audit.actorUserId).toBe(adminId);
      expect(JSON.stringify(audit.changes)).not.toMatch(/temporary1|passwordHash/);

      const dup = await request(app)
        .post("/admin/users")
        .set(as(admin))
        .send({ email: "new@adm.kna", fullName: "Again", role: "GUEST", password: "temporary1" });
      expect(dup.status).toBe(409);
    });

    it("changing a role ends that person's sessions", async () => {
      const user = await makeUser("coord2@adm.kna", "COORDINATOR");
      const token = await login("coord2@adm.kna");
      const res = await request(app).patch(`/admin/users/${user.id}`).set(as(admin)).send({ role: "GUEST" });
      expect(res.status).toBe(200);
      expect((await request(app).get("/auth/me").set(as(token))).status).toBe(401);
      const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { recordId: user.id, action: "update" } });
      expect(audit.changes).toMatchObject({ role: { before: "COORDINATOR", after: "GUEST" } });
    });

    it("keeps at least one admin, and no admin can lock themselves out", async () => {
      const self = await request(app).patch(`/admin/users/${adminId}`).set(as(admin)).send({ role: "GUEST" });
      expect(self.status).toBe(409);
      const disableSelf = await request(app)
        .post(`/admin/users/${adminId}/actions/disable`)
        .set(as(admin))
        .send({ reason: "testing" });
      expect(disableSelf.status).toBe(409);

      const other = await makeUser("admin2@adm.kna", "ADMIN");
      const demote = await request(app).patch(`/admin/users/${other.id}`).set(as(admin)).send({ role: "GUEST" });
      expect(demote.status).toBe(200);
    });

    it("disabling blocks sign-in and live sessions; enabling restores it", async () => {
      const user = await makeUser("off@adm.kna", "GUEST");
      const token = await login("off@adm.kna");
      const noReason = await request(app).post(`/admin/users/${user.id}/actions/disable`).set(as(admin)).send({});
      expect(noReason.status).toBe(400);
      const res = await request(app)
        .post(`/admin/users/${user.id}/actions/disable`)
        .set(as(admin))
        .send({ reason: "fraud report" });
      expect(res.status).toBe(200);
      expect((await request(app).get("/auth/me").set(as(token))).status).toBe(403);
      const again = await request(app).post("/auth/login").send({ email: "off@adm.kna", password: PASSWORD });
      expect(again.status).toBe(403);

      await request(app).post(`/admin/users/${user.id}/actions/enable`).set(as(admin)).send({});
      expect(await login("off@adm.kna")).toBeTruthy();
      const trail = await request(app).get(`/admin/users/${user.id}/history`).set(as(admin));
      expect(trail.body.map((a: { action: string }) => a.action)).toEqual(["enable", "disable"]);
      expect(trail.body[1]).toMatchObject({ reason: "fraud report", actorEmail: "admin@adm.kna" });
    });

    it("deletes an account nothing depends on, and disables one that has history", async () => {
      const lone = await makeUser("lone@adm.kna", "GUEST");
      const gone = await request(app).delete(`/admin/users/${lone.id}`).set(as(admin)).send({ reason: "duplicate" });
      expect(gone.body).toMatchObject({ outcome: "deleted" });
      expect(await prisma.user.findUnique({ where: { id: lone.id } })).toBeNull();

      const { user: host } = await makeProvider("kept@adm.kna");
      const kept = await request(app).delete(`/admin/users/${host.id}`).set(as(admin)).send({ reason: "left" });
      expect(kept.body.outcome).toBe("disabled");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: host.id } })).disabledAt).not.toBeNull();

      const noReason = await request(app).delete(`/admin/users/${host.id}`).set(as(admin)).send({});
      expect(noReason.status).toBe(400);
    });
  });

  describe("catalogue", () => {
    it("creates, edits, opens days on and removes a listing for any provider", async () => {
      const { provider } = await makeProvider("host@cat.kna");
      const created = await request(app)
        .post("/admin/listings")
        .set(as(admin))
        .send({
          providerId: provider.id,
          category: "STAY",
          title: "Riverside longhouse",
          blurb: "Two rooms by the river.",
          priceVnd: 600_000,
          unit: "per night",
          duration: "1 night minimum",
          groupSize: "Up to 4 guests",
          carbonRating: "Low",
          inventory: 2,
          maxGuestsPerRoom: 2,
          imageUrl: "https://api.example/images/abc",
          published: true,
        });
      expect(created.status).toBe(201);
      const id = created.body.id;

      const open = await request(app)
        .post(`/admin/listings/${id}/actions/openDays`)
        .set(as(admin))
        .send({ from: soon(10), to: soon(12) });
      expect(open.body.result).toEqual({ days: 3 });
      expect(await prisma.availabilitySlot.count({ where: { listingId: id, capacity: 2 } })).toBe(3);

      const edit = await request(app).patch(`/admin/listings/${id}`).set(as(admin)).send({ inventory: 3 });
      expect(edit.status).toBe(200);
      expect(await prisma.availabilitySlot.count({ where: { listingId: id, capacity: 3 } })).toBe(3);

      const bad = await request(app).patch(`/admin/listings/${id}`).set(as(admin)).send({ priceVnd: -5 });
      expect(bad.status).toBe(400);

      const removed = await request(app).delete(`/admin/listings/${id}`).set(as(admin)).send({ reason: "test" });
      expect(removed.body).toEqual({ outcome: "deleted" });
    });

    it("unpublishes rather than deletes a listing that has bookings", async () => {
      const { provider } = await makeProvider("host2@cat.kna");
      const listing = await makeListing(provider.id);
      await makeUser("g@cat.kna");
      const booked = await request(app)
        .post("/bookings")
        .set(as(await login("g@cat.kna")))
        .send({ listingId: listing.id, guests: 1, nights: 1, checkIn: soon(20) });
      expect(booked.status).toBe(201);
      const res = await request(app).delete(`/admin/listings/${listing.id}`).set(as(admin)).send({ reason: "closing" });
      expect(res.body.outcome).toBe("unpublished");
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).published).toBe(false);
    });
  });

  describe("money: actions only", () => {
    it("has no create, edit or delete for bookings, and cancels one by the booking rules", async () => {
      const { provider } = await makeProvider("host@money.kna");
      const listing = await makeListing(provider.id);
      await makeUser("g@money.kna");
      const booking = (
        await request(app)
          .post("/bookings")
          .set(as(await login("g@money.kna")))
          .send({ listingId: listing.id, guests: 1, nights: 2, checkIn: soon(15) })
      ).body;

      expect((await request(app).patch(`/admin/bookings/${booking.id}`).set(as(admin)).send({ totalVnd: 1 })).status).toBe(405);
      expect((await request(app).delete(`/admin/bookings/${booking.id}`).set(as(admin)).send({ reason: "x x x" })).status).toBe(405);
      expect((await request(app).post("/admin/bookings").set(as(admin)).send({})).status).toBe(405);

      const detail = await request(app).get(`/admin/bookings/${booking.id}`).set(as(admin));
      expect(detail.body.actions).toContain("cancel");

      const res = await request(app)
        .post(`/admin/bookings/${booking.id}/actions/cancel`)
        .set(as(admin))
        .send({ reason: "host emergency" });
      expect(res.status).toBe(200);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { ledgerEntries: true } });
      expect(after).toMatchObject({ status: "CANCELLED", decidedVia: "ADMIN", decidedById: adminId });
      expect(after.ledgerEntries[0].voidedAt).not.toBeNull();
      expect(after.ledgerEntries[0].voidReason).toContain("host emergency");
      const slots = await prisma.availabilitySlot.findMany({ where: { listingId: listing.id, booked: { gt: 0 } } });
      expect(slots).toHaveLength(0);

      const twice = await request(app)
        .post(`/admin/bookings/${booking.id}/actions/cancel`)
        .set(as(admin))
        .send({ reason: "again" });
      expect(twice.status).toBe(409);
    });

    it("retries a chain job that gave up", async () => {
      const job = await prisma.chainOutbox.create({
        data: { eventType: "ACCOUNT_REGISTER", idempotencyKey: "account:x:register", payload: {}, status: "DEAD", attempts: 8 },
      });
      const res = await request(app).post(`/admin/outbox/${job.id}/actions/retry`).set(as(admin)).send({});
      expect(res.status).toBe(200);
      expect(await prisma.chainOutbox.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
        status: "PENDING",
        attempts: 0,
      });
    });

    it("records Community Fund disbursements with a full audit trail", async () => {
      const res = await request(app)
        .post("/admin/fund")
        .set(as(admin))
        .send({ quarter: "Q3 2026", what: "Gong repairs", toBuon: "Buôn Test", amountVnd: 4_000_000 });
      expect(res.status).toBe(201);
      await request(app).patch(`/admin/fund/${res.body.id}`).set(as(admin)).send({ amountVnd: 4_500_000 });
      const trail = await request(app).get(`/admin/fund/${res.body.id}/history`).set(as(admin));
      expect(trail.body[0].changes).toEqual({ amountVnd: { before: 4_000_000, after: 4_500_000 } });
      expect((await request(app).post("/admin/fund").set(as(admin)).send({ quarter: "third" })).status).toBe(400);
    });
  });

  describe("governance: only the Committee publishes", () => {
    it("an admin's archive entry waits for the Committee, and the admin cannot publish it", async () => {
      const created = await request(app)
        .post("/admin/archive")
        .set(as(admin))
        .send({ type: "Oral history", title: "The gong cycle", meta: "Recorded 2026", keeperBuon: "Buôn Test" });
      expect(created.body.moderationStatus).toBe("IN_REVIEW");

      const adminReview = await request(app)
        .post(`/archive/${created.body.id}/review`)
        .set(as(admin))
        .send({ decision: "publish" });
      expect(adminReview.status).toBe(403);
      expect((await request(app).get("/archive/queue").set(as(admin))).status).toBe(403);

      const seat = await makeUser("chair@gov.kna", "COMMITTEE");
      await giveSeat(seat.id);
      const chair = await login("chair@gov.kna");
      const published = await request(app)
        .post(`/archive/${created.body.id}/review`)
        .set(as(chair))
        .send({ decision: "publish" });
      expect(published.body.moderationStatus).toBe("PUBLISHED");

      // Editing a published entry sends it back to the Committee.
      const edited = await request(app)
        .patch(`/admin/archive/${created.body.id}`)
        .set(as(admin))
        .send({ title: "The gong cycle (revised)" });
      expect(edited.body.moderationStatus).toBe("IN_REVIEW");
      const note = await prisma.notification.findFirst({ where: { userId: seat.id, type: "ARCHIVE_AWAITING_REVIEW" } });
      expect(note).not.toBeNull();
    });

    it("phrases are reviewed by the Committee", async () => {
      const created = await request(app)
        .post("/admin/phrases")
        .set(as(admin))
        .send({ ede: "Kơ jăk", en: "Thank you", note: "Everyday." });
      expect(created.body.moderationStatus).toBe("IN_REVIEW");
      expect((await request(app).get("/archive/phrases")).body).toHaveLength(0);

      expect(
        (await request(app).post(`/archive/phrases/${created.body.id}/review`).set(as(admin)).send({ decision: "publish" }))
          .status
      ).toBe(403);

      const seat = await makeUser("chair2@gov.kna", "COMMITTEE");
      await giveSeat(seat.id);
      const chair = await login("chair2@gov.kna");
      expect((await request(app).get("/archive/phrases/queue").set(as(chair))).body).toHaveLength(1);
      const rejected = await request(app)
        .post(`/archive/phrases/${created.body.id}/review`)
        .set(as(chair))
        .send({ decision: "reject" });
      expect(rejected.status).toBe(400); // a refusal needs a reason
      const published = await request(app)
        .post(`/archive/phrases/${created.body.id}/review`)
        .set(as(chair))
        .send({ decision: "publish" });
      expect(published.body).toMatchObject({ moderationStatus: "PUBLISHED", moderatedById: seat.id });
      expect((await request(app).get("/archive/phrases")).body).toHaveLength(1);
    });
  });

  describe("system", () => {
    it("reports which keys are configured, never the keys", async () => {
      const res = await request(app).get("/admin/system").set(as(admin));
      expect(res.status).toBe(200);
      expect(res.body.configured).toHaveProperty("registrarKey");
      expect(typeof res.body.configured.walletEncryptionKey).toBe("boolean");
    });

    it("sends a notice to an audience", async () => {
      await makeUser("a@sys.kna", "GUEST");
      await makeUser("b@sys.kna", "GUEST");
      const res = await request(app)
        .post("/admin/notifications")
        .set(as(admin))
        .send({ audience: "GUEST", message: "Maintenance tonight." });
      expect(res.body).toEqual({ sent: 2 });
      expect(await prisma.notification.count({ where: { type: "ADMIN_NOTICE" } })).toBe(2);
    });
  });
});

beforeAll(() => {
  delete process.env.SOLANA_ENABLED;
});
