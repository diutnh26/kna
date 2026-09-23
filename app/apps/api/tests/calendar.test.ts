import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { PASSWORD, app, makeListing, makeProvider, makeUser, resetDb, soon } from "./helpers";

const { recordBookingOnChain } = vi.hoisted(() => ({ recordBookingOnChain: vi.fn() }));
vi.mock("../src/chain/bookings-onchain", async (orig) => ({
  ...(await orig<typeof import("../src/chain/bookings-onchain")>()),
  recordBookingOnChain,
}));
vi.mock("../src/chain/gateway", () => ({
  getChainGateway: () => ({ isEnabled: () => true }),
  resetChainGatewayForTests: vi.fn(),
}));

/**
 * The provider's calendar is the only approval there is: they open days,
 * guests book open days instantly, and each booking is then recorded
 * on-chain by the worker.
 */
describe("provider calendar and instant booking", () => {
  let hostToken: string;
  let otherHostToken: string;
  let guestToken: string;
  let listingId: string;

  beforeAll(async () => {
    await resetDb();
    process.env.SOLANA_ENABLED = "true";
    const host = await makeProvider("host@cal.kna");
    await makeProvider("other@cal.kna");
    await makeUser("guest@cal.kna", "GUEST");
    const listing = await makeListing(host.provider.id, 400_000);
    listingId = listing.id;
    // Start from a closed calendar with two rooms.
    await prisma.availabilitySlot.deleteMany({ where: { listingId } });
    await prisma.listing.update({ where: { id: listingId }, data: { inventory: 2 } });
    const login = async (email: string) =>
      (await request(app).post("/auth/login").send({ email, password: PASSWORD })).body.token;
    hostToken = await login("host@cal.kna");
    otherHostToken = await login("other@cal.kna");
    guestToken = await login("guest@cal.kna");
  });

  afterAll(async () => {
    delete process.env.SOLANA_ENABLED;
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(() => recordBookingOnChain.mockReset());

  const setDays = (from: string, to: string, open: boolean, token = hostToken) =>
    request(app)
      .put(`/providers/me/listings/${listingId}/availability`)
      .set("Authorization", `Bearer ${token}`)
      .send({ from, to, open });
  const calendar = async (from: string, to: string) =>
    (await request(app).get(`/listings/${listingId}/availability?from=${from}&to=${to}`)).body;

  it("lets only the listing's own provider open days", async () => {
    expect((await setDays(soon(5), soon(9), true, otherHostToken)).status).toBe(404);
    expect((await setDays(soon(5), soon(9), true, guestToken)).status).toBe(404);
    const res = await setDays(soon(5), soon(9), true);
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(5);

    const cal = await calendar(soon(4), soon(10));
    expect(cal.days.map((d: { date: string }) => d.date)).toEqual([soon(5), soon(6), soon(7), soon(8), soon(9)]);
    expect(cal.days.every((d: { available: number }) => d.available === 2)).toBe(true);
  });

  it("shows what is left once a guest books, and records the booking on-chain via the worker", async () => {
    const booking = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 2, nights: 2, checkIn: soon(6) });
    expect(booking.status).toBe(201);
    expect(booking.body.checkOut.slice(0, 10)).toBe(soon(8));

    const cal = await calendar(soon(5), soon(9));
    const left = Object.fromEntries(cal.days.map((d: { date: string; available: number }) => [d.date, d.available]));
    expect(left).toEqual({ [soon(5)]: 2, [soon(6)]: 1, [soon(7)]: 1, [soon(8)]: 2, [soon(9)]: 2 });

    const row = await prisma.chainOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `booking:${booking.body.id}:record` },
    });
    expect(row.eventType).toBe("BOOKING_RECORD");
    const { processOutboxRow } = await import("../src/chain/worker");
    recordBookingOnChain.mockResolvedValueOnce(undefined);
    await processOutboxRow(row.id);
    expect(recordBookingOnChain).toHaveBeenCalledWith(booking.body.id);
    expect((await prisma.chainOutbox.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("DONE");
  });

  it("keeps waiting, not failing, while the accounts are still being registered", async () => {
    const { NotReadyError } = await import("../src/chain/bookings-onchain");
    const booking = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({ listingId, guests: 1, nights: 1, checkIn: soon(9) });
    const row = await prisma.chainOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `booking:${booking.body.id}:record` },
    });
    await prisma.chainOutbox.update({ where: { id: row.id }, data: { attempts: 20 } });
    recordBookingOnChain.mockRejectedValueOnce(new NotReadyError("accounts pending"));
    const { processOutboxRow } = await import("../src/chain/worker");
    await processOutboxRow(row.id);
    // Past the ordinary retry limit, still retryable while it is only waiting.
    expect((await prisma.chainOutbox.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("RETRYABLE");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.body.id } })).onchainError).toBe(
      "accounts pending"
    );
  });

  it("closing days never takes back rooms that are already booked", async () => {
    const res = await setDays(soon(5), soon(9), false);
    expect(res.status).toBe(200);
    const cal = await calendar(soon(5), soon(9));
    // Free days are gone; booked days stay, with nothing left to sell.
    const days = Object.fromEntries(
      cal.days.map((d: { date: string; booked: number; available: number }) => [d.date, [d.booked, d.available]])
    );
    expect(days).toEqual({ [soon(6)]: [1, 0], [soon(7)]: [1, 0], [soon(9)]: [1, 0] });
  });
});
