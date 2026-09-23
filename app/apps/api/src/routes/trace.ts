import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import {
  BOOKING_BOOKED,
  BOOKING_CANCELLED,
  BOOKING_PAID,
  BOOKING_UNPAID,
  explorerAccountUrl,
  explorerTxUrl,
  fetchBookingRecord,
  fetchPaymentConfig,
  fetchWalletRecord,
  isLikelyFakeSignature,
} from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { loadChainConfig } from "../chain/config";
import { getChainGateway } from "../chain/gateway";
import { loadMint, readAtaBalance } from "../chain/demo-token";

/**
 * Public traceability. Every wallet (guest, provider, Community Fund, KNĂ)
 * has one public address, and every booking and payment is a transaction of
 * the KNĂ program — these routes put the on-chain facts next to each other
 * with Explorer links. No names or emails: what is public on-chain is what
 * is shown here, plus the booking's own dates and amounts.
 */

export const traceRouter = Router();

const STATUS = {
  [BOOKING_BOOKED]: "BOOKED",
  [BOOKING_PAID]: "PAID",
  [BOOKING_UNPAID]: "UNPAID",
  [BOOKING_CANCELLED]: "CANCELLED",
} as Record<number, string>;

const tx = (cluster: "devnet" | "localnet", sig: string | null | undefined) =>
  sig && !isLikelyFakeSignature(sig) && sig !== "already-registered"
    ? { signature: sig, explorer: explorerTxUrl(cluster, sig) }
    : null;

traceRouter.get("/wallet/:address", async (req, res) => {
  let address: PublicKey;
  try {
    address = new PublicKey(req.params.address);
  } catch {
    return res.status(400).json({ error: "That is not a Solana address." });
  }
  const config = loadChainConfig();
  const connection = getChainGateway().connection();
  const base58 = address.toBase58();

  const [record, pc, recent] = await Promise.all([
    fetchWalletRecord(connection, address).catch(() => null),
    fetchPaymentConfig(connection).catch(() => null),
    connection.getSignaturesForAddress(address, { limit: 20 }, "confirmed").catch(() => []),
  ]);

  // What this address is, in KNĂ terms.
  let role = "unknown";
  if (pc?.communityWallet === base58) role = "community-fund";
  else if (pc?.platformWallet === base58) role = "platform";
  else if (record) {
    const account = await prisma.wallet.findUnique({
      where: { pubkey: base58 },
      select: { user: { select: { provider: { select: { id: true } } } } },
    });
    role = account?.user.provider ? "provider" : "account";
  }

  let balance = null;
  const mint = loadMint();
  if (mint) balance = await readAtaBalance(connection, mint, base58).catch(() => null);

  res.json({
    address: base58,
    explorer: explorerAccountUrl(config.cluster, base58),
    role,
    registered: Boolean(record),
    balance,
    transactions: recent.map((s) => ({
      signature: s.signature,
      slot: s.slot,
      at: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
      failed: Boolean(s.err),
      explorer: explorerTxUrl(config.cluster, s.signature),
    })),
  });
});

traceRouter.get("/booking/:id", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      listing: { select: { title: true, provider: { select: { displayName: true } } } },
      ledgerEntries: { where: { voidedAt: null }, include: { attestation: true } },
    },
  });
  if (!booking) return res.status(404).json({ error: "No booking with that reference." });

  const config = loadChainConfig();
  const connection = getChainGateway().connection();
  const [record, pc] = await Promise.all([
    fetchBookingRecord(connection, booking.id).catch(() => null),
    fetchPaymentConfig(connection).catch(() => null),
  ]);
  const attestation = booking.ledgerEntries[0]?.attestation ?? null;
  const guestWallet = await prisma.wallet.findUnique({
    where: { userId: booking.guestId },
    select: { pubkey: true },
  });
  const wallet = (pubkey: string | null | undefined) =>
    pubkey ? { address: pubkey, explorer: explorerAccountUrl(config.cluster, pubkey) } : null;

  res.json({
    id: booking.id,
    listing: booking.listing.title,
    host: booking.listing.provider.displayName,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    rooms: booking.rooms,
    status: booking.status,
    split: {
      totalVnd: booking.totalVnd,
      providerVnd: booking.providerPayoutVnd,
      communityFundVnd: booking.communityFundVnd,
      platformVnd: booking.platformFeeVnd,
    },
    wallets: {
      guest: wallet(guestWallet?.pubkey),
      provider: wallet(record?.providerWallet),
      communityFund: wallet(pc?.communityWallet),
      platform: wallet(pc?.platformWallet),
      paidBy: wallet(record && record.status === BOOKING_PAID ? record.paidBy : null),
    },
    onchain: record
      ? {
          status: STATUS[record.status] ?? String(record.status),
          matchesLedger:
            record.totalVnd === booking.totalVnd &&
            record.providerVnd === booking.providerPayoutVnd &&
            record.communityVnd === booking.communityFundVnd &&
            record.platformVnd === booking.platformFeeVnd,
          paidAt: record.paidAt ? new Date(record.paidAt * 1000).toISOString() : null,
        }
      : null,
    transactions: {
      recorded: tx(config.cluster, booking.onchainTx),
      paid: tx(config.cluster, booking.payTx),
      attested: tx(config.cluster, attestation?.pendingTxSig),
      finalized: tx(config.cluster, attestation?.finalizeTxSig),
    },
    attestationState: attestation?.state ?? null,
  });
});

