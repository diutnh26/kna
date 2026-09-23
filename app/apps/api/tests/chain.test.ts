import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { finalPdaFromLedgerId } from "@kna/chain-client";
import { prisma } from "../src/lib/prisma";
import { giveSeat, makeListing, makeUser, resetDb, PASSWORD } from "./helpers";

const REAL_SIG = `${"4".repeat(88)}`;
const FAKE_SUBMIT = `mock_${"A".repeat(80)}`;
const FAKE_FINALIZE = `devnet_${"B".repeat(80)}`;

// vi.hoisted runs before any imports, so these vi.fn() refs are available
// inside the vi.mock factory below (which is also hoisted).
const { verifyPendingSubmission, verifyFinalize, fetchDemoTokenBalances } = vi.hoisted(() => ({
  verifyPendingSubmission: vi.fn(),
  verifyFinalize: vi.fn(),
  fetchDemoTokenBalances: vi.fn(),
}));

// Module-level mock: Vitest hoists this before any import of the gateway
// module, so the route's local binding receives the mock from the start.
vi.mock("../src/chain/gateway", () => ({
  getChainGateway: () => ({
    isEnabled: () => true,
    status: () => ({
      enabled: true,
      cluster: "devnet",
      programId: "2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f",
      committeeVault: "3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42",
      rpcUrl: "https://api.devnet.solana.com",
    }),
    connection: () => ({
      getAccountInfo: async () => ({ executable: true }),
    }),
    verifyPendingSubmission,
    verifyFinalize,
  }),
  resetChainGatewayForTests: vi.fn(),
  ChainGateway: class {},
}));

vi.mock("../src/chain/demo-token", () => ({
  demoDisburse: vi.fn(),
  fetchDemoTokenBalances,
}));

describe("chain verifier routes", () => {
  let app: Express;
  let coordinatorToken: string;
  let committeeToken: string;
  let ledgerId: string;

  beforeAll(async () => {
    vi.resetModules();
    const { createApp } = await import("../src/app");
    app = createApp();

    process.env.SOLANA_ENABLED = "true";
    process.env.SOLANA_CLUSTER = "devnet";
    process.env.KNA_TRUST_PROGRAM_ID = "2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f";
    process.env.KNA_COMMITTEE_VAULT = "3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42";
    await resetDb();
    const guest = await makeUser("guest@chain.kna", "GUEST");
    await makeUser("coord@chain.kna", "COORDINATOR");
    const hostUser = await makeUser("host@chain.kna", "PROVIDER");
    await giveSeat(hostUser.id);
    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;
    coordinatorToken = await login("coord@chain.kna");
    committeeToken = await login("host@chain.kna");

    const host = await prisma.provider.create({
      data: {
        userId: hostUser.id,
        type: "HOMESTAY",
        displayName: "Ho Gia Demo",
        buon: "Buôn Test",
        verified: true,
      },
    });
    const listing = await makeListing(host.id, 1_000_000);
    const booking = await prisma.booking.create({
      data: {
        guestId: guest.id,
        listingId: listing.id,
        guests: 2,
        nights: 1,
        checkIn: new Date("2026-10-01"),
        status: "CONFIRMED",
        totalVnd: 1_000_000,
        platformFeeVnd: 70_000,
        communityFundVnd: 30_000,
        providerPayoutVnd: 900_000,
      },
    });
    const entry = await prisma.ledgerEntry.create({
      data: {
        bookingId: booking.id,
        fromLabel: "Guest",
        toLabel: "Ho Gia Demo",
        totalVnd: 1_000_000,
        platformFeeVnd: 70_000,
        communityFundVnd: 30_000,
      },
    });
    ledgerId = entry.id;
    await prisma.ledgerAttestation.create({
      data: {
        ledgerEntryId: ledgerId,
        payloadHash: "payload-hash-1",
        state: "AWAITING_COMMITTEE",
      },
    });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    verifyPendingSubmission.mockClear();
    verifyFinalize.mockClear();
    fetchDemoTokenBalances.mockReset();
  });

  it("GET /chain/status returns devnet config", async () => {
    const res = await request(app).get("/chain/status");
    expect(res.status).toBe(200);
    expect(res.body.cluster).toBe("devnet");
    expect(res.body.programId).toContain("2Ft67fV4");
  });

  it("POST submit rejects fake signatures before verifier work", async () => {
    const res = await request(app)
      .post(`/chain/ledger/${ledgerId}/submit`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ pendingTxSig: FAKE_SUBMIT });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Fake\/mock signatures/i);
    expect(verifyPendingSubmission).not.toHaveBeenCalled();
  });

  it("POST finalize rejects fake signatures before verifier work", async () => {
    const res = await request(app)
      .post(`/chain/ledger/${ledgerId}/finalize`)
      .set("Authorization", `Bearer ${committeeToken}`)
      .send({ finalizeTxSig: FAKE_FINALIZE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Fake\/mock signatures/i);
    expect(verifyFinalize).not.toHaveBeenCalled();
  });

  it("POST finalize updates DB only after verified final PDA matches", async () => {
    const expectedPda = finalPdaFromLedgerId(ledgerId).toBase58();
    verifyFinalize.mockResolvedValue({
      finalPda: expectedPda,
      finalizeTxSig: REAL_SIG,
      slot: 123,
      verifiedAt: "2026-08-24T00:00:00.000Z",
    });
    const res = await request(app)
      .post(`/chain/ledger/${ledgerId}/finalize`)
      .set("Authorization", `Bearer ${committeeToken}`)
      .send({ finalizeTxSig: REAL_SIG });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("FINALIZED");
    const row = await prisma.ledgerAttestation.findUnique({ where: { ledgerEntryId: ledgerId } });
    expect(row?.finalPda).toBe(expectedPda);
    expect(row?.finalizeTxSig).toBe(REAL_SIG);

    const audit = await prisma.chainAuditLog.findFirstOrThrow({
      where: { ledgerEntryId: ledgerId, action: "FINALIZE_ATTESTATION" },
    });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: "host@chain.kna" } });
    expect(audit.actorUserId).toBe(member.id);
    expect(audit.detail).toBe(REAL_SIG);
  });

  it("POST finalize rejects derived final PDA mismatch and does not keep a bad PDA", async () => {
    await prisma.ledgerAttestation.update({
      where: { ledgerEntryId: ledgerId },
      data: { state: "AWAITING_COMMITTEE", finalPda: null, finalizeTxSig: null },
    });
    verifyFinalize.mockResolvedValue({
      finalPda: "WrongFinalPda11111111111111111111111111111111",
      finalizeTxSig: REAL_SIG,
      slot: 123,
      verifiedAt: "2026-08-24T00:00:00.000Z",
    });
    const res = await request(app)
      .post(`/chain/ledger/${ledgerId}/finalize`)
      .set("Authorization", `Bearer ${committeeToken}`)
      .send({ finalizeTxSig: REAL_SIG });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Derived final PDA mismatch/i);
    const row = await prisma.ledgerAttestation.findUnique({ where: { ledgerEntryId: ledgerId } });
    expect(row?.state).not.toBe("FINALIZED");
    expect(row?.finalPda).toBeNull();
  });

  it("GET /chain/status includes demo token balances from the chain helper", async () => {
    process.env.DEMO_MINT = "6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N";
    fetchDemoTokenBalances.mockResolvedValue({
      mint: process.env.DEMO_MINT,
      symbol: "dKNA",
      decimals: 6,
      vndPerToken: 1000,
      guest: { uiAmount: 2, symbol: "dKNA", approxVnd: 2000 },
      provider: { uiAmount: 450, symbol: "dKNA", approxVnd: 450_000 },
      community: { uiAmount: 15, symbol: "dKNA", approxVnd: 15_000 },
    });

    const res = await request(app).get("/chain/status");
    expect(res.status).toBe(200);
    expect(res.body.demoToken.balances.guest.uiAmount).toBe(2);
    expect(fetchDemoTokenBalances).toHaveBeenCalled();
  });

  it("GET /chain/status still succeeds when demo balance lookup throws", async () => {
    process.env.DEMO_MINT = "6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N";
    fetchDemoTokenBalances.mockRejectedValue(new Error("rpc down"));

    const res = await request(app).get("/chain/status");
    expect(res.status).toBe(200);
    expect(res.body.demoToken.balances).toBeNull();
  });

  // The program's validate_split accepts only the booking split (7% / 3%).
  // A settled marketplace order (5% / 0%) must never reach the chain, where
  // it would fail with SplitMismatch.
  describe("attestation scope", () => {
    let orderLedgerId: string;

    beforeAll(async () => {
      const buyer = await makeUser("buyer@chain.kna", "GUEST");
      const order = await prisma.order.create({
        data: { buyerId: buyer.id, status: "PAID", totalVnd: 400_000, marketplaceFeeVnd: 20_000 },
      });
      orderLedgerId = (
        await prisma.ledgerEntry.create({
          data: {
            orderId: order.id,
            fromLabel: "Buyer",
            toLabel: "Ho Gia Demo",
            totalVnd: 400_000,
            platformFeeVnd: 20_000,
            communityFundVnd: 0,
          },
        })
      ).id;
    });

    it("POST prepare refuses a marketplace ledger entry with 409", async () => {
      const res = await request(app)
        .post(`/chain/ledger/${orderLedgerId}/prepare`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ coordinatorPubkey: "3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42" });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/only booking/i);
    });

    it("does not queue a marketplace ledger entry for attestation", async () => {
      const { enqueueLedgerSettledOutbox } = await import("../src/chain/outbox");
      await prisma.$transaction((tx) => enqueueLedgerSettledOutbox(tx, orderLedgerId));
      expect(
        await prisma.chainOutbox.count({ where: { idempotencyKey: `ledger:${orderLedgerId}:settled` } })
      ).toBe(0);
      expect(await prisma.ledgerAttestation.count({ where: { ledgerEntryId: orderLedgerId } })).toBe(0);
    });

    it("still queues a settled booking ledger entry", async () => {
      const { enqueueLedgerSettledOutbox } = await import("../src/chain/outbox");
      await prisma.$transaction((tx) => enqueueLedgerSettledOutbox(tx, ledgerId));
      expect(
        await prisma.chainOutbox.count({ where: { idempotencyKey: `ledger:${ledgerId}:settled` } })
      ).toBe(1);
    });
  });
});
