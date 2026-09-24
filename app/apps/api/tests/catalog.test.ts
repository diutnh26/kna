import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

const login = async (email: string) =>
  (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token as string;
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

const LISTING = {
  category: "STAY",
  title: "Hillside longhouse",
  blurb: "A quiet room.",
  priceVnd: 450_000,
  unit: "per night",
  duration: "1 night minimum",
  groupSize: "Up to 2 guests",
  carbonRating: "Low",
  inventory: 1,
  maxGuestsPerRoom: 2,
};
const PRODUCT = { category: "Textile", title: "Indigo scarf", note: "Hand woven.", priceVnd: 350_000, stock: 3 };

// Smallest valid PNG header plus padding: enough for the type check.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

/** Providers manage their own listings and products, photographs included. */
describe("provider catalogue", () => {
  let host: string;
  let providerId: string;

  beforeEach(async () => {
    await resetDb();
    providerId = (await makeProvider("host@own.kna")).provider.id;
    host = await login("host@own.kna");
  });

  it("creates a draft, publishes it, edits and deletes it", async () => {
    const created = await request(app).post("/providers/me/listings").set(as(host)).send(LISTING);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ providerId, published: false });

    const published = await request(app)
      .patch(`/providers/me/listings/${created.body.id}`)
      .set(as(host))
      .send({ published: true, priceVnd: 500_000 });
    expect(published.body).toMatchObject({ published: true, priceVnd: 500_000 });
    expect((await request(app).get(`/listings/${created.body.id}`)).status).toBe(200);

    const removed = await request(app).delete(`/providers/me/listings/${created.body.id}`).set(as(host));
    expect(removed.body).toEqual({ outcome: "deleted" });
  });

  it("an unverified household can prepare listings but not publish them", async () => {
    await prisma.provider.update({ where: { id: providerId }, data: { verified: false } });
    const draft = await request(app).post("/providers/me/listings").set(as(host)).send(LISTING);
    expect(draft.status).toBe(201);
    const publish = await request(app)
      .patch(`/providers/me/listings/${draft.body.id}`)
      .set(as(host))
      .send({ published: true });
    expect(publish.status).toBe(403);
  });

  it("cannot touch another provider's listing", async () => {
    const other = await makeProvider("other@own.kna");
    const theirs = await makeListing(other.provider.id);
    expect((await request(app).patch(`/providers/me/listings/${theirs.id}`).set(as(host)).send({ title: "x" })).status).toBe(404);
    expect((await request(app).delete(`/providers/me/listings/${theirs.id}`).set(as(host))).status).toBe(404);
  });

  it("unpublishes a booked listing instead of deleting it", async () => {
    const listing = await makeListing(providerId);
    await makeUser("guest@own.kna");
    await request(app)
      .post("/bookings")
      .set(as(await login("guest@own.kna")))
      .send({ listingId: listing.id, guests: 1, nights: 1, checkIn: soon(5) });
    const res = await request(app).delete(`/providers/me/listings/${listing.id}`).set(as(host));
    expect(res.body.outcome).toBe("unpublished");
  });

  it("manages products, and the household profile", async () => {
    const created = await request(app).post("/providers/me/products").set(as(host)).send(PRODUCT);
    expect(created.status).toBe(201);
    const bad = await request(app).post("/providers/me/products").set(as(host)).send({ ...PRODUCT, category: "Pottery" });
    expect(bad.status).toBe(400);
    const edited = await request(app).patch(`/providers/me/products/${created.body.id}`).set(as(host)).send({ stock: 0 });
    expect(edited.body.stock).toBe(0);
    expect((await request(app).delete(`/providers/me/products/${created.body.id}`).set(as(host))).body.outcome).toBe(
      "deleted"
    );

    const profile = await request(app).patch("/providers/me").set(as(host)).send({ bio: "We weave." });
    expect(profile.body.bio).toBe("We weave.");
    const cannot = await request(app).patch("/providers/me").set(as(host)).send({ verified: true });
    expect(cannot.body.verified).toBe(true); // unchanged: verified is not the provider's to set
    await prisma.provider.update({ where: { id: providerId }, data: { verified: false } });
    const stillNot = await request(app).patch("/providers/me").set(as(host)).send({ verified: true });
    expect(stillNot.body.verified).toBe(false);
  });

  it("is only for providers", async () => {
    await makeUser("guest2@own.kna");
    const guest = await login("guest2@own.kna");
    expect((await request(app).post("/providers/me/listings").set(as(guest)).send(LISTING)).status).toBe(404);
  });
});

describe("image uploads", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stores a provider's photograph and serves it back", async () => {
    await makeProvider("host@img.kna");
    const host = await login("host@img.kna");
    const up = await request(app).post("/images").set(as(host)).set("Content-Type", "image/png").send(PNG);
    expect(up.status).toBe(201);
    expect(up.body.url).toMatch(/\/images\/[a-z0-9]+$/);

    const got = await request(app).get(`/images/${up.body.id}`);
    expect(got.status).toBe(200);
    expect(got.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(got.body as Buffer, PNG)).toBe(0);
  });

  it("refuses guests, files that are not what they claim, and oversized files", async () => {
    await makeUser("guest@img.kna");
    const guest = await login("guest@img.kna");
    expect((await request(app).post("/images").set(as(guest)).set("Content-Type", "image/png").send(PNG)).status).toBe(403);

    await makeProvider("host2@img.kna");
    const host = await login("host2@img.kna");
    const lie = await request(app).post("/images").set(as(host)).set("Content-Type", "image/jpeg").send(PNG);
    expect(lie.status).toBe(415);
    const huge = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);
    const big = await request(app).post("/images").set(as(host)).set("Content-Type", "image/png").send(huge);
    expect(big.status).toBe(413);
  });
});
