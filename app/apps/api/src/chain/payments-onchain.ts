import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  BOOKING_PAID,
  BOOKING_UNPAID,
  buildCreateAtaIdempotentIx,
  buildMarkUnpaidIx,
  buildPayBookingIx,
  confirmSignature,
  fetchBookingRecord,
  fetchPaymentConfig,
  isLikelyFakeSignature,
} from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { getChainGateway } from "./gateway";
import { loadRegistrar } from "./accounts-onchain";
import { loadWalletKeypair } from "./wallets";
import { readAtaBalance, loadMint } from "./demo-token";

/**
 * pay_booking from the API. The guest's paying wallet signs — the fixed
 * platform-held wallet (the server signs with its key), or a linked Phantom
 * (the server prepares, the browser signs). The registrar pays the network
 * fee and creates any missing token accounts. Nothing is recorded as paid
 * until the booking record on-chain reads PAID by the expected wallet.
 */

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

/** Which wallet pays this guest's bookings, and whether the server holds its key. */
export async function payingWallet(userId: string) {
  const [wallet, link] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.walletLink.findUnique({ where: { userId } }),
  ]);
  if (link?.isDefault && !link.pubkey.startsWith("pending:")) {
    return { pubkey: new PublicKey(link.pubkey), custodial: false as const };
  }
  if (!wallet) throw new PaymentError("This account has no wallet yet.", 409);
  return { pubkey: new PublicKey(wallet.pubkey), custodial: true as const };
}

/** dKNA the paying wallet holds, in VND (null when the rail is not configured or RPC fails). */
export async function payingBalanceVnd(userId: string): Promise<number | null> {
  const mint = loadMint();
  if (!mint) return null;
  try {
    const { pubkey } = await payingWallet(userId);
    const connection = getChainGateway().connection();
    const [balance, pc] = await Promise.all([
      readAtaBalance(connection, mint, pubkey.toBase58()),
      fetchPaymentConfig(connection),
    ]);
    const units = pc?.unitsPerVnd ?? 1_000n;
    return Number(BigInt(balance.raw) / units);
  } catch {
    return null;
  }
}

async function buildPayment(bookingId: string, payer: PublicKey, connection: Connection) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new PaymentError("Booking not found", 404);
  const [pc, record] = await Promise.all([
    fetchPaymentConfig(connection),
    fetchBookingRecord(connection, bookingId),
  ]);
  if (!pc) throw new PaymentError("The payment rail is not set up on-chain yet.", 503);
  if (!record) throw new PaymentError("This booking is still being recorded on-chain. Try again shortly.", 409);

  const registrar = loadRegistrar();
  const mint = new PublicKey(pc.mint);
  const providerWallet = new PublicKey(record.providerWallet);
  const communityWallet = new PublicKey(pc.communityWallet);
  const platformWallet = new PublicKey(pc.platformWallet);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: registrar.publicKey, blockhash, lastValidBlockHeight });
  for (const owner of [providerWallet, communityWallet, platformWallet]) {
    tx.add(buildCreateAtaIdempotentIx(registrar.publicKey, owner, mint));
  }
  tx.add(
    buildPayBookingIx({
      payer,
      bookingId,
      guestUserId: booking.guestId,
      mint,
      providerWallet,
      communityWallet,
      platformWallet,
    })
  );
  // Refuse early, with a clear message, rather than letting the token
  // program fail on an empty wallet.
  const balance = await readAtaBalance(connection, mint, payer.toBase58());
  const needed = BigInt(booking.totalVnd) * pc.unitsPerVnd;
  if (BigInt(balance.raw) < needed) {
    throw new PaymentError(
      `The paying wallet holds ${Number(BigInt(balance.raw) / pc.unitsPerVnd).toLocaleString("vi-VN")} ₫ in dKNA; this stay costs ${booking.totalVnd.toLocaleString("vi-VN")} ₫. Top up first.`,
      402
    );
  }
  return { tx, registrar, blockhash, lastValidBlockHeight };
}

/** Verify on-chain that the booking is PAID, and by whom. */
async function verifyPaid(connection: Connection, bookingId: string, payer: PublicKey) {
  const record = await fetchBookingRecord(connection, bookingId);
  if (!record || record.status !== BOOKING_PAID || record.paidBy !== payer.toBase58()) {
    throw new PaymentError("The booking record on-chain does not read as paid by this wallet.");
  }
  return record;
}

/** Pay from the account's fixed platform-held wallet: the server signs. */
export async function payFromPlatformWallet(bookingId: string, guestId: string) {
  const connection = getChainGateway().connection();
  const guest = await loadWalletKeypair(guestId);
  const { tx, registrar, blockhash, lastValidBlockHeight } = await buildPayment(bookingId, guest.publicKey, connection);
  const sig = await connection.sendTransaction(tx, [registrar, guest], { preflightCommitment: "confirmed" });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  await verifyPaid(connection, bookingId, guest.publicKey);
  return sig;
}

/** Pay from a linked Phantom: the registrar signs its part, the browser the rest. */
export async function preparePhantomPayment(bookingId: string, phantom: PublicKey) {
  const connection = getChainGateway().connection();
  const { tx, registrar } = await buildPayment(bookingId, phantom, connection);
  tx.partialSign(registrar);
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function confirmPhantomPayment(bookingId: string, phantom: PublicKey, signature: string) {
  if (isLikelyFakeSignature(signature)) throw new PaymentError("Fake/mock signatures are rejected.");
  const connection = getChainGateway().connection();
  await confirmSignature(connection, signature, "confirmed");
  await verifyPaid(connection, bookingId, phantom);
  return signature;
}

/** Record a booking UNPAID on-chain (it stays payable). */
export async function markUnpaidOnChain(bookingId: string) {
  const connection = getChainGateway().connection();
  const record = await fetchBookingRecord(connection, bookingId);
  if (!record || record.status === BOOKING_UNPAID || record.status === BOOKING_PAID) return null;
  const registrar = loadRegistrar();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: registrar.publicKey, blockhash, lastValidBlockHeight }).add(
    buildMarkUnpaidIx(registrar.publicKey, bookingId)
  );
  const sig = await connection.sendTransaction(tx, [registrar], { preflightCommitment: "confirmed" });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}
