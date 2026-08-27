import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { loadChainConfig } from "../chain/config";

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

walletRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const link = await prisma.walletLink.findUnique({ where: { userId: req.user!.id } });
  if (!link || link.pubkey.startsWith("pending:")) {
    return res.json(null);
  }
  res.json(link);
});
