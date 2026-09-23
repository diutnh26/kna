import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Keypair } from "@solana/web3.js";
import { prisma } from "../src/lib/prisma";
import { decryptSecret, encryptSecret } from "../src/lib/walletCrypto";
import { app, makeUser, resetDb } from "./helpers";

const { registerAccountOnChain } = vi.hoisted(() => ({ registerAccountOnChain: vi.fn() }));
vi.mock("../src/chain/accounts-onchain", () => ({ registerAccountOnChain }));
vi.mock("../src/chain/demo-token", () => ({
  loadMint: () => null,
  readAtaBalance: vi.fn(),
  fetchDemoTokenBalances: vi.fn().mockResolvedValue(null),
}));
vi.mock("../src/chain/gateway", () => ({
  getChainGateway: () => ({ isEnabled: () => true }),
  resetChainGatewayForTests: vi.fn(),
}));

/**
 * Every account gets exactly one wallet, made at sign-up, whose secret key
 * is stored encrypted and never leaves the server; registering it on-chain
 * goes through the outbox and worker.
 */
describe("platform-held wallets", () => {
  beforeAll(async () => {
    await resetDb();
    process.env.SOLANA_ENABLED = "true";
  });

  afterAll(async () => {
    delete process.env.SOLANA_ENABLED;
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(() => registerAccountOnChain.mockReset());

  it("encrypts wallet keys so only this server can read them back", () => {
    const kp = Keypair.generate();
    const stored = encryptSecret(kp.secretKey);
    expect(stored).not.toContain(Buffer.from(kp.secretKey).toString("base64"));
    expect(Keypair.fromSecretKey(decryptSecret(stored)).publicKey.equals(kp.publicKey)).toBe(true);

    const tampered = stored.slice(0, -4) + (stored.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("gives a new account its wallet at sign-up and queues its on-chain registration", async () => {
    const agent = request.agent(app);
    const signup = await agent
      .post("/auth/signup")
      .send({ email: "new@wallet.kna", password: "a-long-password-1", fullName: "New Guest" });
    expect(signup.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "new@wallet.kna" } });
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    const keypair = Keypair.fromSecretKey(decryptSecret(wallet.encryptedSecret));
    expect(keypair.publicKey.toBase58()).toBe(wallet.pubkey);

    const outbox = await prisma.chainOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `account:${user.id}:register` },
    });
    expect(outbox.eventType).toBe("ACCOUNT_REGISTER");

    // The Account screen sees the address, never the key.
    const account = await agent.get("/wallet/account").set("Authorization", `Bearer ${signup.body.token}`);
    expect(account.status).toBe(200);
    expect(account.body.address).toBe(wallet.pubkey);
    expect(account.body.paymentWallet).toBe(wallet.pubkey);
    expect(account.body.registered).toBe(false);
    const body = JSON.stringify(account.body);
    expect(body).not.toContain(wallet.encryptedSecret);
    expect(body).not.toMatch(/secret/i);
  });

  it("never gives an account a second wallet", async () => {
    const { provisionWallet } = await import("../src/chain/wallets");
    const user = await makeUser("once@wallet.kna");
    const first = await provisionWallet(prisma, user.id);
    const second = await provisionWallet(prisma, user.id);
    expect(second.id).toBe(first.id);
    expect(await prisma.wallet.count({ where: { userId: user.id } })).toBe(1);
  });

  it("backfills accounts made before wallets existed", async () => {
    const { backfillWallets } = await import("../src/chain/wallets");
    const a = await makeUser("old-a@wallet.kna");
    const b = await makeUser("old-b@wallet.kna");
    expect(await backfillWallets()).toBeGreaterThanOrEqual(2);
    for (const u of [a, b]) {
      expect(await prisma.wallet.count({ where: { userId: u.id } })).toBe(1);
      expect(
        await prisma.chainOutbox.count({ where: { idempotencyKey: `account:${u.id}:register` } })
      ).toBe(1);
    }
    expect(await backfillWallets()).toBe(0);
  });

  it("the worker registers the account on-chain, and retries a failure", async () => {
    const { processOutboxRow } = await import("../src/chain/worker");
    const user = await makeUser("worker@wallet.kna");
    const { provisionAndRegister } = await import("../src/chain/wallets");
    await provisionAndRegister(user.id);
    const row = await prisma.chainOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `account:${user.id}:register` },
    });

    registerAccountOnChain.mockRejectedValueOnce(new Error("RPC down"));
    await processOutboxRow(row.id);
    expect((await prisma.chainOutbox.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("RETRYABLE");
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).registerError).toBe("RPC down");

    registerAccountOnChain.mockResolvedValueOnce(undefined);
    await processOutboxRow(row.id);
    expect(registerAccountOnChain).toHaveBeenLastCalledWith(user.id);
    expect((await prisma.chainOutbox.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("DONE");
  });
});
