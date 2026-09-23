import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

const mocks = vi.hoisted(() => ({
  onchainPaymentWallet: vi.fn(),
  preparePaymentWallet: vi.fn(),
  confirmSignature: vi.fn(),
}));
vi.mock("../src/chain/gateway", () => ({
  getChainGateway: () => ({
    isEnabled: () => true,
    connection: () => ({
      getAccountInfo: async () => null,
      getSignaturesForAddress: async () => [],
    }),
  }),
  resetChainGatewayForTests: vi.fn(),
}));
vi.mock("../src/chain/accounts-onchain", async (orig) => ({
  ...(await orig<typeof import("../src/chain/accounts-onchain")>()),
  onchainPaymentWallet: mocks.onchainPaymentWallet,
  preparePaymentWallet: mocks.preparePaymentWallet,
}));
vi.mock("@kna/chain-client", async (orig) => ({
  ...(await orig<typeof import("@kna/chain-client")>()),
  confirmSignature: mocks.confirmSignature,
}));

const PAY_SIG = "5".repeat(88);
const PHANTOM = "3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42";

describe("public traceability", () => {
  let guestToken: string;
  let bookingId: string;

  beforeAll(async () => {
    await resetDb();
    await makeUser("guest@trace.kna", "GUEST");
    const host = await makeProvider("host@trace.kna");
    const listingId = (await makeListing(host.provider.id, 500_000)).id;
    guestToken = (
      await request(app).post("/auth/login").send({ email: "guest@trace.kna", password: PASSWORD })
    ).body.token;
    const b = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon(10) });
    bookingId = b.body.id;
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "COMPLETED", payTx: PAY_SIG, onchainTx: `mock_${"A".repeat(80)}` },
    });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("shows a booking's split and its real transactions, and nobody's name or email", async () => {
    const res = await request(app).get(`/trace/booking/${bookingId}`);
    expect(res.status).toBe(200);
    expect(res.body.split).toEqual({
      totalVnd: 500_000,
      providerVnd: 450_000,
      communityFundVnd: 15_000,
      platformVnd: 35_000,
    });
    expect(res.body.transactions.paid.explorer).toContain(PAY_SIG);
    expect(res.body.transactions.recorded).toBeNull(); // a mock signature is never linked
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("guest@trace.kna");
    expect(body).not.toContain("host@trace.kna");
    expect((await request(app).get("/trace/booking/nope")).status).toBe(404);
  });

  it("refuses something that is not a Solana address", async () => {
    expect((await request(app).get("/trace/wallet/not-an-address")).status).toBe(400);
    const res = await request(app).get(`/trace/wallet/${PHANTOM}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ address: PHANTOM, registered: false, transactions: [] });
  });

  it("only lets a linked Phantom become the paying wallet, and only once the chain agrees", async () => {
    const prepare = () =>
      request(app).post("/wallet/payment-wallet/prepare").set("Authorization", `Bearer ${guestToken}`);
    expect((await prepare()).status).toBe(409);

    const guest = await prisma.user.findUniqueOrThrow({ where: { email: "guest@trace.kna" } });
    await prisma.walletLink.create({ data: { userId: guest.id, pubkey: PHANTOM } });
    mocks.preparePaymentWallet.mockResolvedValue("dHg=");
    expect((await prepare()).body).toEqual({ wallet: PHANTOM, transactionBase64: "dHg=" });

    const confirm = () =>
      request(app)
        .post("/wallet/payment-wallet/confirm")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ signature: PAY_SIG });
    mocks.confirmSignature.mockResolvedValue(undefined);
    mocks.onchainPaymentWallet.mockResolvedValue("SomeOtherWallet1111111111111111111111111111");
    expect((await confirm()).status).toBe(400);
    expect((await prisma.walletLink.findUniqueOrThrow({ where: { userId: guest.id } })).isDefault).toBe(false);

    mocks.onchainPaymentWallet.mockResolvedValue(PHANTOM);
    expect((await confirm()).status).toBe(200);
    expect((await prisma.walletLink.findUniqueOrThrow({ where: { userId: guest.id } })).isDefault).toBe(true);
  });
});
