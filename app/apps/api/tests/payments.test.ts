import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ManualSettlementGateway } from "../src/payments/gateway";
import { VietQRGateway, buildPaymentRef } from "../src/payments/vietqr-gateway";
import { prisma } from "../src/lib/prisma";
import { app, makeListing, makeProvider, makeUser, PASSWORD, resetDb, soon } from "./helpers";

const { demoDisburse } = vi.hoisted(() => ({
  demoDisburse: vi.fn(),
}));

vi.mock("../src/chain/demo-token", () => ({
  demoDisburse,
  fetchDemoTokenBalances: vi.fn().mockResolvedValue(null),
}));

describe("payment gateway seam", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  async function loadGetter() {
    vi.resetModules();
    return (await import("../src/payments/gateway")).getPaymentGateway;
  }

  it("defaults to manual settlement, which is how the pilot actually runs", async () => {
    delete process.env.PAYMENT_PROVIDER;
    const get = await loadGetter();
    const gateway = get();
    expect(gateway.name).toBe("manual");
    expect(gateway.settlesAutomatically).toBe(false);
  });

  it("fails loudly on an unknown provider rather than silently falling back", async () => {
    process.env.PAYMENT_PROVIDER = "vnpay";
    const get = await loadGetter();
    expect(() => get()).toThrow(/Unknown PAYMENT_PROVIDER/);
  });

  it("tells the guest the truth: nothing is charged through the site", async () => {
    const instruction = await new ManualSettlementGateway().createIntent({
      reference: "booking-1",
      amountVnd: 500_000,
      description: "test",
    });
    expect(instruction.status).toBe("AWAITING_PAYMENT");
    expect(instruction.instructions).toMatch(/nothing is charged/i);
  });

  it("refuses to pretend it can verify a callback", async () => {
    await expect(new ManualSettlementGateway().verifyCallback({})).rejects.toThrow(
      /no gateway callback/i
    );
  });
});

describe("VietQR gateway (Approach A)", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("builds a unique-enough paymentRef from the booking id", () => {
    process.env.ORDER_ID_PREFIX = "TWRTCK";
    const a = buildPaymentRef("clxyzabcdefghijklmnop");
    const b = buildPaymentRef("clxyzabcdefghijklmnop");
    expect(a).toMatch(/^TWRTCK/);
    expect(a.length).toBeGreaterThan("TWRTCK".length + 6);
    expect(a).toBe(b);
  });

  it("returns qrUrl + paymentRef + demo disclaimer", async () => {
    process.env.PAYMENT_BANK_ACCOUNT = "8798311204";
    process.env.PAYMENT_BANK_ID = "TCB";
    process.env.ORDER_ID_PREFIX = "TWRTCK";
    const gw = new VietQRGateway();
    const intent = await gw.createIntent({
      reference: "clbookingid1234567890",
      amountVnd: 1_000_000,
      description: "test",
    });
    expect(intent.provider).toBe("vietqr");
    expect(intent.qrUrl).toMatch(/img\.vietqr\.io/);
    expect(intent.paymentRef).toMatch(/^TWRTCK/);
    expect(intent.amountVnd).toBe(1_000_000);
    expect(intent.instructions).toMatch(/not real money/i);
  });

  it("rejects webhook without auth when secret/token configured", async () => {
    process.env.PAYMENT_WEBHOOK_TOKEN = "secret-token";
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    const gw = new VietQRGateway();
    await expect(
      gw.verifyCallback({ paymentRef: "TWRTCKABC", status: "PAID" }, {})
    ).rejects.toThrow(/authentication/i);
  });

  it("accepts Bearer-authenticated PAID webhook and echoes amount", async () => {
    process.env.PAYMENT_WEBHOOK_TOKEN = "secret-token";
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    const gw = new VietQRGateway();
    const verified = await gw.verifyCallback(
      { paymentRef: "TWRTCKABC123", status: "PAID", amountVnd: 500_000 },
      { authorization: "Bearer secret-token" }
    );
    expect(verified.status).toBe("PAID");
    expect(verified.paymentRef).toBe("TWRTCKABC123");
    expect(verified.amountVnd).toBe(500_000);
  });
});

const WEBHOOK_SECRET = "test-webhook-hmac-secret";

function signedBody(body: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return { raw, sig };
}

describe("POST /payments/webhook integration", () => {
  let guestToken: string;
  let guestId: string;
  let listingId: string;
  const envBackup = {
    secret: process.env.PAYMENT_WEBHOOK_SECRET,
    token: process.env.PAYMENT_WEBHOOK_TOKEN,
  };

  beforeAll(async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    delete process.env.PAYMENT_WEBHOOK_TOKEN;
    await resetDb();
    const guest = await makeUser("guest@pay.kna", "GUEST");
    guestId = guest.id;
    const host = await makeProvider("host@pay.kna");
    listingId = (await makeListing(host.provider.id, 500_000)).id;
    guestToken = (
      await request(app).post("/auth/login").send({ email: "guest@pay.kna", password: PASSWORD })
    ).body.token as string;
  });

  afterAll(async () => {
    if (envBackup.secret === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
    else process.env.PAYMENT_WEBHOOK_SECRET = envBackup.secret;
    if (envBackup.token === undefined) delete process.env.PAYMENT_WEBHOOK_TOKEN;
    else process.env.PAYMENT_WEBHOOK_TOKEN = envBackup.token;
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    demoDisburse.mockReset();
    demoDisburse.mockResolvedValue(["sig1", "sig2", "sig3"]);
  });

  async function seedBooking(paymentRef: string, totalVnd = 500_000) {
    return prisma.booking.create({
      data: {
        listingId,
        guestId,
        guests: 1,
        checkIn: new Date(`${soon()}T00:00:00Z`),
        nights: 1,
        totalVnd,
        platformFeeVnd: 35_000,
        communityFundVnd: 15_000,
        providerPayoutVnd: 450_000,
        paymentRef,
        paymentStatus: "AWAITING_PAYMENT",
        status: "PENDING",
      },
    });
  }

  function postWebhook(body: Record<string, unknown>, sig?: string) {
    const signed = signedBody(body);
    return request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", sig ?? signed.sig)
      .send(signed.raw);
  }

  it("marks the booking PAID and returns demo tx signatures", async () => {
    const ref = "TWRTCKPAID0001";
    await seedBooking(ref);

    const res = await postWebhook({ paymentRef: ref, status: "PAID", amountVnd: 500_000 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.demoTxSigs).toEqual(["sig1", "sig2", "sig3"]);
    expect(demoDisburse).toHaveBeenCalledTimes(1);

    const row = await prisma.booking.findFirstOrThrow({ where: { paymentRef: ref } });
    expect(row.paymentStatus).toBe("PAID");
    expect(row.status).toBe("CONFIRMED");
    expect(JSON.parse(row.demoTxSigs!)).toEqual(["sig1", "sig2", "sig3"]);
    // Decided by the bank's webhook: a trace, with no person behind it.
    expect(row.decidedVia).toBe("PAYMENT_WEBHOOK");
    expect(row.decidedById).toBeNull();
    expect(row.decidedAt).not.toBeNull();
  });

  it("disburses only once when the same paymentRef is posted twice", async () => {
    const ref = "TWRTCKATOMIC01";
    await seedBooking(ref);
    const body = { paymentRef: ref, status: "PAID", amountVnd: 500_000 };

    const first = await postWebhook(body);
    const second = await postWebhook(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(demoDisburse).toHaveBeenCalledTimes(1);
    expect(second.body.demoTxSigs).toEqual(["sig1", "sig2", "sig3"]);
  });

  it("rejects a webhook whose amount does not match the booking", async () => {
    const ref = "TWRTCKMISMATCH1";
    await seedBooking(ref);

    const res = await postWebhook({ paymentRef: ref, status: "PAID", amountVnd: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not match/i);
    expect(demoDisburse).not.toHaveBeenCalled();
    const row = await prisma.booking.findFirstOrThrow({ where: { paymentRef: ref } });
    expect(row.paymentStatus).toBe("AWAITING_PAYMENT");
  });

  it("rejects a webhook with a bad HMAC signature", async () => {
    const ref = "TWRTCKBADHMAC01";
    await seedBooking(ref);

    const res = await postWebhook(
      { paymentRef: ref, status: "PAID", amountVnd: 500_000 },
      "0".repeat(64)
    );

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication/i);
    expect(demoDisburse).not.toHaveBeenCalled();
  });

  it("ignores a FAILED webhook without minting", async () => {
    const ref = "TWRTCKFAILED001";
    await seedBooking(ref);

    const res = await postWebhook({ paymentRef: ref, status: "FAILED", amountVnd: 500_000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, ignored: true, status: "FAILED" });
    expect(demoDisburse).not.toHaveBeenCalled();
    const row = await prisma.booking.findFirstOrThrow({ where: { paymentRef: ref } });
    expect(row.paymentStatus).toBe("AWAITING_PAYMENT");
  });

  it("lets the guest poll payment status after PAID", async () => {
    const ref = "TWRTCKSTATUS001";
    await seedBooking(ref);
    await postWebhook({ paymentRef: ref, status: "PAID", amountVnd: 500_000 });

    const res = await request(app)
      .get(`/payments/status/${ref}`)
      .set("Authorization", `Bearer ${guestToken}`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("PAID");
    expect(res.body.demoTxSigs).toEqual(["sig1", "sig2", "sig3"]);
  });

  it("serves demo history without auth and without a guest email", async () => {
    const res = await request(app).get("/payments/demo-history");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty("guestEmail");
    }
  });

  it("includes explorer links for a booking that was minted", async () => {
    const ref = "TWRTCKHISTORY01";
    await seedBooking(ref);
    await postWebhook({ paymentRef: ref, status: "PAID", amountVnd: 500_000 });

    const res = await request(app).get("/payments/demo-history");
    const item = res.body.items.find((row: { paymentRef: string }) => row.paymentRef === ref);
    expect(item).toBeTruthy();
    expect(item.demoTxSigs).toEqual(["sig1", "sig2", "sig3"]);
    expect(item.explorer[0]).toBe(
      "https://explorer.solana.com/tx/sig1?cluster=devnet"
    );
  });
});
