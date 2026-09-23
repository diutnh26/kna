import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { loadChainConfig } from "../chain/config";
import { explorerAccountUrl, explorerTxUrl } from "@kna/chain-client";
import { Connection } from "@solana/web3.js";
import { provisionAndRegister } from "../chain/wallets";
import { loadMint, readAtaBalance } from "../chain/demo-token";
import { getPaymentGateway } from "../payments/gateway";
import { creditTopUp } from "../lib/topups";

export const walletRouter = Router();

function buildChallengeMessage(opts: {
  domain: string;
  userId: string;
  nonce: string;
  expiryIso: string;
}) {
  return [
    "KNĂ wallet link",
    `domain:${opts.domain}`,
    `user:${opts.userId}`,
    `nonce:${opts.nonce}`,
    `exp:${opts.expiryIso}`,
  ].join("\n");
}

function verifyEd25519(message: string, signatureBase64OrBs58: string, pubkeyBase58: string) {
  const pubkey = new PublicKey(pubkeyBase58);
  const msg = Buffer.from(message, "utf8");
  let sig: Uint8Array;
  try {
    sig = Buffer.from(signatureBase64OrBs58, "base64");
    if (sig.length !== 64) {
      sig = bs58.decode(signatureBase64OrBs58);
    }
  } catch {
    sig = bs58.decode(signatureBase64OrBs58);
  }
  if (sig.length !== 64) {
    throw new Error("Invalid signature length");
  }
  return nacl.sign.detached.verify(msg, sig, pubkey.toBytes());
}

walletRouter.post("/challenge", requireAuth, async (req: AuthedRequest, res) => {
  const config = loadChainConfig();
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiry = new Date(Date.now() + config.walletLinkTtlSec * 1000);
  const placeholder = `pending:${req.user!.id}:${nonce}`;
  await prisma.walletLink.upsert({
    where: { userId: req.user!.id },
    create: {
      userId: req.user!.id,
      pubkey: placeholder,
      challengeNonce: nonce,
      challengeExpiry: expiry,
    },
    update: { challengeNonce: nonce, challengeExpiry: expiry },
  });
  const message = buildChallengeMessage({
    domain: config.walletLinkDomain,
    userId: req.user!.id,
    nonce,
    expiryIso: expiry.toISOString(),
  });
  res.json({ message, nonce, expiresAt: expiry.toISOString(), domain: config.walletLinkDomain });
});

const linkSchema = z.object({
  pubkey: z.string().min(32).max(64),
  signature: z.string().min(16),
  nonce: z.string().min(8),
});

walletRouter.post("/link", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "pubkey, signature, and nonce are required." });
  }
  const config = loadChainConfig();
  const link = await prisma.walletLink.findUnique({ where: { userId: req.user!.id } });
  if (!link?.challengeNonce || link.challengeNonce !== parsed.data.nonce) {
    return res.status(400).json({ error: "Challenge expired or invalid." });
  }
  if (!link.challengeExpiry || link.challengeExpiry < new Date()) {
    return res.status(400).json({ error: "Challenge expired." });
  }

  try {
    new PublicKey(parsed.data.pubkey);
  } catch {
    return res.status(400).json({ error: "Invalid Solana pubkey." });
  }

  const message = buildChallengeMessage({
    domain: config.walletLinkDomain,
    userId: req.user!.id,
    nonce: parsed.data.nonce,
    expiryIso: link.challengeExpiry.toISOString(),
  });

  let ok = false;
  try {
    ok = verifyEd25519(message, parsed.data.signature, parsed.data.pubkey);
  } catch {
    ok = false;
  }
  if (!ok) {
    return res.status(400).json({ error: "Wallet signature verification failed." });
  }

  const existing = await prisma.walletLink.findFirst({
    where: { pubkey: parsed.data.pubkey, NOT: { userId: req.user!.id } },
  });
  if (existing) {
    return res.status(409).json({ error: "Pubkey already linked to another account." });
  }

  const updated = await prisma.walletLink.update({
    where: { userId: req.user!.id },
    data: {
      pubkey: parsed.data.pubkey,
      challengeNonce: null,
      challengeExpiry: null,
      linkVersion: { increment: 1 },
      linkedAt: new Date(),
    },
  });
  await prisma.chainAuditLog.create({
    data: {
      actorUserId: req.user!.id,
      action: "WALLET_LINKED",
      detail: updated.pubkey,
    },
  });
  res.json({
    pubkey: updated.pubkey,
    linkedAt: updated.linkedAt,
    domain: config.walletLinkDomain,
    verified: true,
  });
});

/**
 * The account's wallets as the Account screen shows them: the fixed wallet
 * (its address never changes), whether it is registered on-chain, the
 * linked Phantom if any, which of the two pays bookings, and that wallet's
 * dKNA balance. Never the secret key.
 */
walletRouter.get("/account", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const wallet =
    (await prisma.wallet.findUnique({ where: { userId } })) ?? (await provisionAndRegister(userId));
  const link = await prisma.walletLink.findUnique({ where: { userId } });
  const linked = link && !link.pubkey.startsWith("pending:") ? link : null;
  const paymentWallet = linked?.isDefault ? linked.pubkey : wallet.pubkey;
  const config = loadChainConfig();

  let balance = null;
  const mint = loadMint();
  if (mint) {
    try {
      balance = await readAtaBalance(new Connection(config.rpcUrl, "confirmed"), mint, paymentWallet);
    } catch {
      balance = null; // RPC trouble must not break the Account screen
    }
  }

  const registeredTx =
    wallet.registeredTx && wallet.registeredTx !== "already-registered" ? wallet.registeredTx : null;
  res.json({
    address: wallet.pubkey,
    explorer: explorerAccountUrl(config.cluster, wallet.pubkey),
    registered: Boolean(wallet.registeredTx),
    registeredAt: wallet.registeredAt,
    registeredTxExplorer: registeredTx ? explorerTxUrl(config.cluster, registeredTx) : null,
    registerError: wallet.registeredTx ? null : wallet.registerError,
    linked: linked ? { pubkey: linked.pubkey, isDefault: linked.isDefault } : null,
    paymentWallet,
    balance,
  });
});

walletRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const link = await prisma.walletLink.findUnique({ where: { userId: req.user!.id } });
  if (!link || link.pubkey.startsWith("pending:")) {
    return res.json(null);
  }
  res.json(link);
});

// ── Funding the wallet ──────────────────────────────────────────────────
// Payment at check-out comes out of the guest's wallet, so the wallet has to
// hold dKNA first: pay VND by VietQR and the same amount is minted to the
// wallet, or (devnet only) take a daily grant from the demo faucet.

const topUpSchema = z.object({ amountVnd: z.number().int().min(10_000).max(50_000_000) });

walletRouter.post("/topup", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = topUpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "amountVnd must be between 10,000 and 50,000,000." });
  }
  const topUp = await prisma.topUp.create({
    data: { userId: req.user!.id, source: "VIETQR", amountVnd: parsed.data.amountVnd },
  });
  const payment = await getPaymentGateway().createIntent({
    reference: topUp.id,
    amountVnd: topUp.amountVnd,
    description: "KNĂ wallet top-up",
  });
  const updated = await prisma.topUp.update({
    where: { id: topUp.id },
    data: { paymentRef: payment.paymentRef ?? null },
  });
  res.status(201).json({ topUp: updated, payment });
});

const FAUCET_VND = Number(process.env.FAUCET_AMOUNT_VND ?? 2_000_000);
const FAUCET_EVERY_MS = 24 * 3_600_000;

walletRouter.post("/faucet", requireAuth, async (req: AuthedRequest, res) => {
  const config = loadChainConfig();
  if (config.cluster !== "devnet" && config.cluster !== "localnet") {
    return res.status(403).json({ error: "The demo faucet exists on devnet only." });
  }
  if (!loadMint()) {
    return res.status(503).json({ error: "The demo faucet is not configured." });
  }
  const recent = await prisma.topUp.findFirst({
    where: { userId: req.user!.id, source: "FAUCET", createdAt: { gte: new Date(Date.now() - FAUCET_EVERY_MS) } },
  });
  if (recent) {
    return res.status(429).json({
      error: "The demo faucet gives once a day.",
      nextAt: new Date(recent.createdAt.getTime() + FAUCET_EVERY_MS),
    });
  }
  const topUp = await prisma.topUp.create({
    data: { userId: req.user!.id, source: "FAUCET", amountVnd: FAUCET_VND, status: "PAID", paidAt: new Date() },
  });
  try {
    res.status(201).json(await creditTopUp(topUp.id));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Mint failed", topUpId: topUp.id });
  }
});

walletRouter.get("/topups", requireAuth, async (req: AuthedRequest, res) => {
  const config = loadChainConfig();
  const rows = await prisma.topUp.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(
    rows.map((t) => ({
      ...t,
      explorer: t.mintTx ? explorerTxUrl(config.cluster, t.mintTx) : null,
    }))
  );
});
