import { Keypair } from "@solana/web3.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret } from "../lib/walletCrypto";

/**
 * Every KNĂ account gets one fixed wallet, made by the platform at sign-up.
 * The secret key is encrypted at rest and only ever decrypted in-process to
 * sign; no route returns it. Registration on-chain (register_account) runs
 * through the chain outbox so a slow or unavailable devnet never blocks
 * signing up.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Idempotent: returns the user's wallet, creating it on first call. */
export async function provisionWallet(db: Db, userId: string) {
  const existing = await db.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  const keypair = Keypair.generate();
  return db.wallet.create({
    data: {
      userId,
      pubkey: keypair.publicKey.toBase58(),
      encryptedSecret: encryptSecret(keypair.secretKey),
    },
  });
}

/** The user's fixed wallet as a signer. Server-side only. */
export async function loadWalletKeypair(userId: string): Promise<Keypair> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("This account has no wallet yet.");
  const keypair = Keypair.fromSecretKey(decryptSecret(wallet.encryptedSecret));
  if (keypair.publicKey.toBase58() !== wallet.pubkey) {
    throw new Error("Wallet key does not match its public address.");
  }
  return keypair;
}

/** Queue register_account for this user (no-op while Solana is disabled). */
export async function enqueueAccountRegistration(db: Db, userId: string) {
  if (process.env.SOLANA_ENABLED !== "true") return;
  await db.chainOutbox.upsert({
    where: { idempotencyKey: `account:${userId}:register` },
    create: {
      eventType: "ACCOUNT_REGISTER",
      idempotencyKey: `account:${userId}:register`,
      payload: { userId },
      status: "PENDING",
    },
    update: {},
  });
}

/** Sign-up: the wallet exists before the response goes out. */
export async function provisionAndRegister(userId: string) {
  const wallet = await provisionWallet(prisma, userId);
  await enqueueAccountRegistration(prisma, userId);
  return wallet;
}

/**
 * Accounts that predate automatic wallets (and the seeded demo accounts)
 * get one too. Runs at startup; cheap once everyone has a wallet.
 */
export async function backfillWallets(batch = 200) {
  let created = 0;
  for (;;) {
    const users = await prisma.user.findMany({
      where: { wallet: null },
      select: { id: true },
      take: batch,
    });
    if (users.length === 0) break;
    for (const u of users) {
      await provisionAndRegister(u.id);
      created++;
    }
  }
  // Registered-or-queued: re-queue anyone whose registration never landed.
  const unregistered = await prisma.wallet.findMany({
    where: { registeredTx: null },
    select: { userId: true },
  });
  for (const w of unregistered) await enqueueAccountRegistration(prisma, w.userId);
  return created;
}
