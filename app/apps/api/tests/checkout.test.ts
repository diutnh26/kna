import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

const chain = vi.hoisted(() => ({
  payFromPlatformWallet: vi.fn(),
  preparePhantomPayment: vi.fn(),
  confirmPhantomPayment: vi.fn(),
  markUnpaidOnChain: vi.fn(),
  payingBalanceVnd: vi.fn(),
  mintDknaTo: vi.fn(),
}));

vi.mock("../src/chain/payments-onchain", async (orig) => ({
  ...(await orig<typeof import("../src/chain/payments-onchain")>()),
  payFromPlatformWallet: chain.payFromPlatformWallet,
  preparePhantomPayment: chain.preparePhantomPayment,
  confirmPhantomPayment: chain.confirmPhantomPayment,
  markUnpaidOnChain: chain.markUnpaidOnChain,
  payingBalanceVnd: chain.payingBalanceVnd,
}));
vi.mock("../src/chain/demo-token", () => ({
  mintDknaTo: chain.mintDknaTo,
  loadMint: () => new PublicKey("6yASZNZd9qTwfBv5Ay61RsGvcTzftZkPxZCHgJ97bf7N"),
  loadFunder: () => null,
  assertDemoNetwork: vi.fn(),
  readAtaBalance: vi.fn(),
  fetchDemoTokenBalances: vi.fn().mockResolvedValue(null),
}));

const SIG = "5".repeat(88);
const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Payment at check-out: the guest pays the booked split from their wallet on
 * the check-out date; unpaid stays are reminded, charged automatically from
 * the platform-held wallet, or marked UNPAID. The on-chain calls are mocked
 * here — the program itself is tested against LiteSVM.
 */
describe("payment at check-out", () => {
  let guestToken: string;
  let otherToken: string;
  let guestId: string;
  let hostUserId: string;
  let listingId: string;

  beforeAll(async () => {
    await resetDb();
    process.env.SOLANA_ENABLED = "true";
    guestId = (await makeUser("guest@pay.kna", "GUEST")).id;
    await makeUser("other@pay.kna", "GUEST");
    await makeUser("coord@pay.kna", "COORDINATOR");
    const host = await makeProvider("host@pay.kna");
    hostUserId = host.user.id;
    listingId = (await makeListing(host.provider.id, 500_000)).id;
    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;
    guestToken = await login("guest@pay.kna");
    otherToken = await login("other@pay.kna");
    const { provisionWallet } = await import("../src/chain/wallets");
    await provisionWallet(prisma, guestId);
  });

  afterAll(async () => {
    delete process.env.SOLANA_ENABLED;
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    for (const fn of Object.values(chain)) fn.mockReset();
    chain.payingBalanceVnd.mockResolvedValue(null);
    chain.markUnpaidOnChain.mockResolvedValue(null);
  });

  /** A confirmed stay whose check-out is `checkOutDaysAgo` days ago (VN time), recorded on-chain. */
  async function stayCheckedOut(checkOutDaysAgo = 0, onchain = true) {
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon(60) });
    expect(res.status).toBe(201);
    const { vnToday } = await import("../src/lib/checkout");
    const checkOut = new Date(vnToday().getTime() - checkOutDaysAgo * DAY);
    return prisma.booking.update({
      where: { id: res.body.id },
      data: {
        checkIn: new Date(checkOut.getTime() - DAY),
        checkOut,
        onchainTx: onchain ? "4".repeat(88) : null,
      },
    });
  }

  const pay = (id: string, token = guestToken) =>
    request(app).post(`/bookings/${id}/pay`).set("Authorization", `Bearer ${token}`);

  it("opens payment only on the check-out date", async () => {
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 2, checkIn: soon(5) });
    const early = await pay(res.body.id);
    expect(early.status).toBe(409);
    expect(early.body.error).toContain(`Payment opens on your check-out date, ${soon(7)}`);
    expect(chain.payFromPlatformWallet).not.toHaveBeenCalled();
  });

  it("waits until the booking is recorded on-chain", async () => {
    const b = await stayCheckedOut(0, false);
    const res = await pay(b.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/still being recorded/i);
  });

  it("pays from the platform-held wallet: completed, public, attested and announced", async () => {
    const b = await stayCheckedOut(0);
    chain.payFromPlatformWallet.mockResolvedValue(SIG);
    const res = await pay(b.id);
    expect(res.status).toBe(200);
    expect(chain.payFromPlatformWallet).toHaveBeenCalledWith(b.id, guestId);

    const paid = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
      include: { ledgerEntries: true },
    });
    expect(paid.status).toBe("COMPLETED");
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.payTx).toBe(SIG);

    // Now it is money: on the public ledger, and queued for attestation.
    const ledger = (await request(app).get("/community/ledger")).body;
    expect(ledger.some((r: { totalVnd: number }) => r.totalVnd === b.totalVnd)).toBe(true);
    const entryId = paid.ledgerEntries[0].id;
    expect(
      await prisma.chainOutbox.count({ where: { idempotencyKey: `ledger:${entryId}:settled` } })
    ).toBe(1);
    expect(
      await prisma.chainAuditLog.count({ where: { action: "PAY_BOOKING", ledgerEntryId: entryId } })
    ).toBe(1);
    const types = async (userId: string) =>
      (await prisma.notification.findMany({ where: { userId } })).map((n) => n.type);
    expect(await types(guestId)).toContain("BOOKING_PAID");
    expect(await types(hostUserId)).toContain("BOOKING_PAID");
  });

  it("cannot be paid twice, nor by another guest", async () => {
    const b = await stayCheckedOut(0);
    chain.payFromPlatformWallet.mockResolvedValue(SIG);
    expect((await pay(b.id)).status).toBe(200);
    const again = await pay(b.id);
    expect(again.status).toBe(409);
    expect(again.body.status).toBe("COMPLETED");
    expect((await pay(b.id, otherToken)).status).toBe(404);
  });

  it("hands a linked Phantom a transaction to sign, then verifies it", async () => {
    const b = await stayCheckedOut(0);
    const phantom = "3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42";
    await prisma.walletLink.create({ data: { userId: guestId, pubkey: phantom, isDefault: true } });
    chain.preparePhantomPayment.mockResolvedValue("dHg=");
    const prepared = await pay(b.id);
    expect(prepared.body).toMatchObject({ needsSignature: true, wallet: phantom, transactionBase64: "dHg=" });
    expect(chain.payFromPlatformWallet).not.toHaveBeenCalled();

    chain.confirmPhantomPayment.mockResolvedValue(SIG);
    const confirmed = await request(app)
      .post(`/bookings/${b.id}/pay/confirm`)
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ signature: SIG });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe("COMPLETED");
    expect(chain.confirmPhantomPayment.mock.calls[0][1].toBase58()).toBe(phantom);
    await prisma.walletLink.deleteMany({ where: { userId: guestId } });
  });

  it("says why when the wallet cannot cover the stay", async () => {
    const b = await stayCheckedOut(0);
    const { PaymentError } = await import("../src/chain/payments-onchain");
    chain.payFromPlatformWallet.mockRejectedValue(new PaymentError("Top up first.", 402));
    const res = await pay(b.id);
    expect(res.status).toBe(402);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
  });

  it("refuses a booking the wallet cannot cover", async () => {
    chain.payingBalanceVnd.mockResolvedValue(100_000);
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon(70) });
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ requiredVnd: 500_000, balanceVnd: 100_000 });
  });

  describe("the check-out job", () => {
    it("reminds on the day, reminds again, then charges the platform-held wallet", async () => {
      const { runCheckoutJobOnce } = await import("../src/lib/checkout");
      await prisma.booking.updateMany({ where: { status: "CONFIRMED" }, data: { status: "CANCELLED" } });
      const b = await stayCheckedOut(0);
      const day = (n: number) => new Date(Date.now() + n * DAY);

      await runCheckoutJobOnce(day(0));
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).reminderStage).toBe(1);
      await runCheckoutJobOnce(day(0)); // nothing new on the same day
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).reminderStage).toBe(1);

      await runCheckoutJobOnce(day(1));
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).reminderStage).toBe(2);
      const reminders = (await prisma.notification.findMany({ where: { userId: guestId } })).map((n) => n.type);
      expect(reminders).toEqual(expect.arrayContaining(["PAYMENT_DUE", "PAYMENT_OVERDUE"]));

      chain.payFromPlatformWallet.mockResolvedValue(SIG);
      await runCheckoutJobOnce(day(2));
      const charged = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      expect(charged.status).toBe("COMPLETED");
      expect(charged.payTx).toBe(SIG);
      const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { bookingId: b.id } });
      expect(
        await prisma.chainAuditLog.count({
          where: { action: "PAY_BOOKING", ledgerEntryId: entry.id, detail: { contains: "AUTO_CHARGE" } },
        })
      ).toBe(1);
    });

    it("marks a stay it cannot charge UNPAID, tells everyone, and blocks the next booking", async () => {
      const { runCheckoutJobOnce, vnToday } = await import("../src/lib/checkout");
      const b = await stayCheckedOut(2);
      await prisma.booking.update({ where: { id: b.id }, data: { reminderStage: 2 } });
      const { PaymentError } = await import("../src/chain/payments-onchain");
      chain.payFromPlatformWallet.mockRejectedValue(new PaymentError("Top up first.", 402));

      await runCheckoutJobOnce(new Date(vnToday().getTime() + 3_600_000));
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("UNPAID");
      expect(chain.markUnpaidOnChain).toHaveBeenCalledWith(b.id);
      const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "coord@pay.kna" } });
      for (const userId of [guestId, hostUserId, coordinator.id]) {
        expect(await prisma.notification.count({ where: { userId, type: "BOOKING_UNPAID" } })).toBeGreaterThan(0);
      }

      const next = await request(app)
        .post("/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ listingId, guests: 1, nights: 1, checkIn: soon(80) });
      expect(next.status).toBe(409);
      expect(next.body.error).toMatch(/unpaid stay/i);

      // Still payable: paying it clears the block.
      chain.payFromPlatformWallet.mockResolvedValue(SIG);
      expect((await pay(b.id)).status).toBe(200);
      expect(
        (
          await request(app)
            .post("/bookings")
            .set("Authorization", `Bearer ${guestToken}`)
            .send({ listingId, guests: 1, nights: 1, checkIn: soon(80) })
        ).status
      ).toBe(201);
    });
  });

  describe("funding the wallet", () => {
    it("credits a paid VietQR top-up to the fixed wallet, once", async () => {
      const { markTopUpPaid } = await import("../src/lib/topups");
      const topUp = await prisma.topUp.create({
        data: { userId: guestId, source: "VIETQR", amountVnd: 1_000_000, paymentRef: "TOPUPREF1" },
      });
      chain.mintDknaTo.mockResolvedValue(SIG);
      const credited = await markTopUpPaid(topUp.id, 1_000_000);
      expect(credited.status).toBe("CREDITED");
      expect(credited.mintTx).toBe(SIG);
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: guestId } });
      expect(chain.mintDknaTo.mock.calls[0][0].toBase58()).toBe(wallet.pubkey);
      expect(chain.mintDknaTo.mock.calls[0][1]).toBe(1_000_000);

      await markTopUpPaid(topUp.id, 1_000_000);
      expect(chain.mintDknaTo).toHaveBeenCalledTimes(1);
      await expect(markTopUpPaid(topUp.id, 5)).rejects.toThrow(/does not match/);
    });

    it("gives the demo faucet once a day", async () => {
      chain.mintDknaTo.mockResolvedValue(SIG);
      const first = await request(app).post("/wallet/faucet").set("Authorization", `Bearer ${guestToken}`);
      expect(first.status).toBe(201);
      expect(first.body.status).toBe("CREDITED");
      const second = await request(app).post("/wallet/faucet").set("Authorization", `Bearer ${guestToken}`);
      expect(second.status).toBe(429);
      expect(chain.mintDknaTo).toHaveBeenCalledTimes(1);

      const history = await request(app).get("/wallet/topups").set("Authorization", `Bearer ${guestToken}`);
      expect(history.body[0].source).toBe("FAUCET");
      expect(history.body[0].explorer).toContain(SIG);
    });
  });

  it("dates use the check-out day in Vietnam", async () => {
    const { vnToday, paymentOpen } = await import("../src/lib/checkout");
    // 23:30 UTC is already the next day in Vietnam (UTC+7).
    const lateUtc = new Date("2026-10-01T23:30:00Z");
    expect(isoDay(vnToday(lateUtc))).toBe("2026-10-02");
    expect(paymentOpen(new Date("2026-10-02T00:00:00Z"), lateUtc)).toBe(true);
    expect(paymentOpen(new Date("2026-10-03T00:00:00Z"), lateUtc)).toBe(false);
  });
});
