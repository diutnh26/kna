import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { app, PASSWORD, makeProvider, makeUser, resetDb } from "./helpers";

/**
 * Overselling, which is the failure this marketplace can least afford.
 *
 * Most of what is sold here is one-of-a-kind: a single woven basket, one
 * brass piece. Selling it twice does not mean a refund and an apology, it
 * means telling a household to produce something that took a month, or
 * telling a buyer the object they were promised does not exist.
 *
 * money.test.ts covers the sequential case and always passed, because the
 * second request reads stock the first has already written. The bug lived
 * in the interleaving it could not produce: the old route checked stock
 * before opening its transaction, then decremented unconditionally inside
 * it, so buyers arriving together all read the same pre-sale number. Eight
 * simultaneous buyers for one basket produced five orders and left stock at
 * -4.
 *
 * A single pair of concurrent requests is not enough to catch this — the
 * first attempt at this test used two and passed, because Node happened to
 * run one handler to completion before the other began. Concurrency bugs
 * are not reproduced by asking once.
 */
describe("concurrent checkout", () => {
  let tokens: string[];
  let productId: string;

  beforeAll(async () => {
    await resetDb();
    const maker = await makeProvider("maker@concurrency.kna");

    const emails = Array.from({ length: 8 }, (_, i) => `buyer${i}@concurrency.kna`);
    for (const email of emails) await makeUser(email, "GUEST");

    productId = (
      await prisma.product.create({
        data: {
          providerId: maker.provider.id,
          category: "Basketry",
          title: "The last basket",
          note: "One of one.",
          priceVnd: 950_000,
          stock: 1,
          published: true,
        },
      })
    ).id;

    tokens = await Promise.all(
      emails.map(async (email) =>
        (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token
      )
    );
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("sells the only basket to exactly one of eight simultaneous buyers", async () => {
    const results = await Promise.all(
      tokens.map((token) =>
        request(app)
          .post("/orders")
          .set("Authorization", `Bearer ${token}`)
          .send({ items: [{ productId, quantity: 1 }] })
      )
    );

    const sold = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status === 409);

    expect(sold).toHaveLength(1);
    expect(refused).toHaveLength(7);

    // Every refusal must say something a buyer can act on, not a 500.
    for (const r of refused) expect(r.body.error).toMatch(/last basket/i);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stock).toBe(0);

    // The order and the ledger row must not survive a lost race.
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.orderItem.count()).toBe(1);
    expect(await prisma.ledgerEntry.count()).toBe(1);
  });

  it("keeps stock and orders consistent when quantities overlap", async () => {
    await prisma.product.update({ where: { id: productId }, data: { stock: 5 } });

    // 6 buyers wanting 2 each = 12 against a stock of 5. At most two can win.
    const results = await Promise.all(
      tokens.slice(0, 6).map((token) =>
        request(app)
          .post("/orders")
          .set("Authorization", `Bearer ${token}`)
          .send({ items: [{ productId, quantity: 2 }] })
      )
    );

    const sold = results.filter((r) => r.status === 201).length;
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

    expect(product.stock).toBe(5 - sold * 2);
    expect(product.stock).toBeGreaterThanOrEqual(0);
    expect(sold).toBeLessThanOrEqual(2);
  });
});
