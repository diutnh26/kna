import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { app, PASSWORD, giveSeat, makeProvider, makeUser, resetDb } from "./helpers";

/**
 * The authorization rules here aren't generic RBAC — they encode the
 * governance model. Who may publish cultural content, and who may not, is
 * the project's central claim. These tests are the ones worth breaking the
 * build over.
 */
describe("archive moderation gate", () => {
  let guestToken: string;
  let providerToken: string;
  let seatHolderToken: string;
  let providerId: string;

  beforeAll(async () => {
    await resetDb();

    await makeUser("guest@test.kna", "GUEST");
    const maker = await makeProvider("maker@test.kna");
    providerId = maker.provider.id;

    // A host who ALSO holds a Committee seat — the case a single-valued
    // role enum cannot express, and the reason authorization reads records.
    const chair = await makeProvider("chair@test.kna");
    await giveSeat(chair.user.id);

    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;

    guestToken = await login("guest@test.kna");
    providerToken = await login("maker@test.kna");
    seatHolderToken = await login("chair@test.kna");
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("reports a seat-holder's authority even though their role is PROVIDER", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${seatHolderToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("PROVIDER");
    expect(res.body.user.isCommitteeMember).toBe(true);
  });

  it("refuses the review queue to a guest", async () => {
    const res = await request(app).get("/archive/queue").set("Authorization", `Bearer ${guestToken}`);
    expect(res.status).toBe(403);
  });

  it("refuses the review queue to a provider without a seat", async () => {
    const res = await request(app)
      .get("/archive/queue")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(403);
  });

  it("allows the review queue to a provider who holds a seat", async () => {
    const res = await request(app)
      .get("/archive/queue")
      .set("Authorization", `Bearer ${seatHolderToken}`);
    expect(res.status).toBe(200);
  });

  it("refuses anonymous access outright", async () => {
    expect((await request(app).get("/archive/queue")).status).toBe(401);
  });

  it("refuses contributions from guests", async () => {
    const res = await request(app)
      .post("/archive")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ type: "Oral history", title: "t", meta: "m", keeperBuon: "Buôn Test" });
    expect(res.status).toBe(403);
  });

  it("never lets a submission publish itself, and keeps it out of the public archive", async () => {
    const created = await request(app)
      .post("/archive")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        type: "Craft record",
        title: "Unreviewed submission",
        meta: "m",
        keeperBuon: "Buôn Test",
        // Even asked directly, the endpoint must not honour this.
        moderationStatus: "PUBLISHED",
      });

    expect(created.status).toBe(201);
    expect(created.body.moderationStatus).toBe("IN_REVIEW");

    const publicList = await request(app).get("/archive");
    expect(publicList.body.map((e: { title: string }) => e.title)).not.toContain(
      "Unreviewed submission"
    );
  });

  it("requires a reason to refuse, but not to publish", async () => {
    const created = await request(app)
      .post("/archive")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ type: "Recording", title: "Needs a reason", meta: "m", keeperBuon: "Buôn Test" });

    const noReason = await request(app)
      .post(`/archive/${created.body.id}/review`)
      .set("Authorization", `Bearer ${seatHolderToken}`)
      .send({ decision: "reject" });
    expect(noReason.status).toBe(400);

    const withReason = await request(app)
      .post(`/archive/${created.body.id}/review`)
      .set("Authorization", `Bearer ${seatHolderToken}`)
      .send({ decision: "reject", note: "Ceremonial content." });
    expect(withReason.status).toBe(200);
    expect(withReason.body.moderationStatus).toBe("REJECTED");
    expect(withReason.body.moderationNote).toBe("Ceremonial content.");
  });

  it("refuses to re-decide an entry that has already been reviewed", async () => {
    const created = await request(app)
      .post("/archive")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ type: "Recording", title: "Decided once", meta: "m", keeperBuon: "Buôn Test" });

    await request(app)
      .post(`/archive/${created.body.id}/review`)
      .set("Authorization", `Bearer ${seatHolderToken}`)
      .send({ decision: "publish" });

    const again = await request(app)
      .post(`/archive/${created.body.id}/review`)
      .set("Authorization", `Bearer ${seatHolderToken}`)
      .send({ decision: "reject", note: "changed my mind" });
    expect(again.status).toBe(409);
  });

  it("publishes only after review, and then it is public", async () => {
    const created = await request(app)
      .post("/archive")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ type: "Oral history", title: "Cleared entry", meta: "m", keeperBuon: "Buôn Test" });

    await request(app)
      .post(`/archive/${created.body.id}/review`)
      .set("Authorization", `Bearer ${seatHolderToken}`)
      .send({ decision: "publish" });

    const publicList = await request(app).get("/archive");
    expect(publicList.body.map((e: { title: string }) => e.title)).toContain("Cleared entry");
  });

  it("does not let a signup grant itself a privileged role", async () => {
    const res = await request(app).post("/auth/signup").send({
      email: "sneaky@test.kna",
      password: "password123",
      fullName: "Sneaky",
      role: "ADMIN",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("GUEST");
    expect(res.body.user.isCommitteeMember).toBe(false);
  });

  it("keeps unpublished work out of the derived public counts", async () => {
    const stats = await request(app).get("/archive/stats");
    const publicList = await request(app).get("/archive");
    expect(stats.body.publishedEntries).toBe(publicList.body.length);

    const total = await prisma.archiveEntry.count();
    expect(total).toBeGreaterThan(stats.body.publishedEntries);
  });

  it("keeps a provider's dashboard scoped to their own business", async () => {
    const other = await makeProvider("other@test.kna");
    await prisma.listing.create({
      data: {
        providerId: other.provider.id,
        category: "STAY",
        title: "Someone else's listing",
        blurb: "b",
        priceVnd: 1,
        unit: "per night",
        duration: "1 night",
        groupSize: "1",
        carbonRating: "Low",
        published: true,
      },
    });

    const res = await request(app)
      .get("/providers/me")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.provider.id).toBe(providerId);
    expect(res.body.listings.map((l: { title: string }) => l.title)).not.toContain(
      "Someone else's listing"
    );
  });

  // ── Revocation ─────────────────────────────────────────────────────
  // The JWT used to carry `role` and be trusted for it, for seven days.
  // Demoting someone left their token working; a leaked token could not be
  // invalidated at all.

  describe("withdrawing authority", () => {
    it("stops honouring a role the account no longer has", async () => {
      const email = "demote@authz.kna";
      await makeUser(email, "COORDINATOR");
      const token = (
        await request(app).post("/auth/login").send({ email, password: PASSWORD })
      ).body.token;

      // The token works while the role holds.
      expect(
        (await request(app).get("/bookings/pending").set("Authorization", `Bearer ${token}`)).status
      ).toBe(200);

      await prisma.user.update({ where: { email }, data: { role: "GUEST" } });

      // Same token, same seven-day expiry — but the role is re-read.
      expect(
        (await request(app).get("/bookings/pending").set("Authorization", `Bearer ${token}`)).status
      ).toBe(403);
    });

    it("invalidates every existing token on sign-out-everywhere", async () => {
      const email = "revoke@authz.kna";
      await makeUser(email, "GUEST");
      const login = async () =>
        (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;

      const phone = await login();
      const laptop = await login();

      expect((await request(app).get("/auth/me").set("Authorization", `Bearer ${phone}`)).status).toBe(200);

      await request(app)
        .post("/auth/sign-out-everywhere")
        .set("Authorization", `Bearer ${laptop}`)
        .expect(200);

      // Both devices, not just the one that asked.
      for (const token of [phone, laptop]) {
        const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(401);
      }

      // And a fresh sign-in still works.
      expect((await request(app).get("/auth/me").set("Authorization", `Bearer ${await login()}`)).status).toBe(200);
    });

    it("rejects a token for an account that has been deleted", async () => {
      const email = "ghost@authz.kna";
      await makeUser(email, "GUEST");
      const token = (
        await request(app).post("/auth/login").send({ email, password: PASSWORD })
      ).body.token;

      await prisma.user.delete({ where: { email } });

      const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

});
