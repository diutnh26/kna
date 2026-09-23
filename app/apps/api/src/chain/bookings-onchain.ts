import { Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  ACCOUNT_FLAG_GUEST,
  ACCOUNT_FLAG_PROVIDER,
  buildCancelBookingIx,
  buildCreateBookingIx,
  buildSetAccountFlagsIx,
  fetchAccountRecord,
  fetchBookingRecord,
} from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { vnStartOfDayUnix } from "../lib/availability";
import { getChainGateway } from "./gateway";
import { loadRegistrar } from "./accounts-onchain";
import { provisionAndRegister } from "./wallets";

/** Thrown while a prerequisite (an account registration) is still pending. */
export class NotReadyError extends Error {}

async function sendAsRegistrar(ixs: TransactionInstruction[]) {
  const connection = getChainGateway().connection();
  const registrar = loadRegistrar();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: registrar.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
  const sig = await connection.sendTransaction(tx, [registrar], { preflightCommitment: "confirmed" });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return { sig, connection, registrar };
}

/**
 * create_booking for a confirmed booking. Needs both accounts on-chain; the
 * host's account gains the PROVIDER flag here if it was registered before
 * they became a host. Read back from chain before it counts as recorded.
 */
export async function recordBookingOnChain(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { include: { provider: true } } },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.onchainTx) return booking;
  if (booking.status === "CANCELLED") return booking; // cancelled before it reached the chain
  if (!booking.checkOut) throw new Error("Booking has no check-out date");

  const guestId = booking.guestId;
  const hostId = booking.listing.provider.userId;
  const connection = getChainGateway().connection();
  const [guest, host] = await Promise.all([
    fetchAccountRecord(connection, guestId),
    fetchAccountRecord(connection, hostId),
  ]);
  if (!guest || !host) {
    // Make sure both are on their way, then let the worker retry.
    if (!guest) await provisionAndRegister(guestId);
    if (!host) await provisionAndRegister(hostId);
    throw new NotReadyError("Waiting for the guest's and provider's accounts to be registered");
  }

  const registrar = loadRegistrar();
  const ixs: TransactionInstruction[] = [];
  if ((host.flags & ACCOUNT_FLAG_PROVIDER) === 0) {
    ixs.push(
      buildSetAccountFlagsIx({
        registrar: registrar.publicKey,
        userId: hostId,
        flags: host.flags | ACCOUNT_FLAG_GUEST | ACCOUNT_FLAG_PROVIDER,
      })
    );
  }
  ixs.push(
    buildCreateBookingIx({
      registrar: registrar.publicKey,
      bookingId,
      guestUserId: guestId,
      providerUserId: hostId,
      checkIn: vnStartOfDayUnix(booking.checkIn),
      checkOut: vnStartOfDayUnix(booking.checkOut),
      totalVnd: booking.totalVnd,
      platformVnd: booking.platformFeeVnd,
      communityVnd: booking.communityFundVnd,
      providerVnd: booking.providerPayoutVnd,
    })
  );
  const { sig } = await sendAsRegistrar(ixs);

  const record = await fetchBookingRecord(connection, bookingId);
  if (
    !record ||
    record.totalVnd !== booking.totalVnd ||
    record.providerVnd !== booking.providerPayoutVnd ||
    record.providerWallet !== host.wallet
  ) {
    throw new Error("Booking record on-chain does not match after create_booking");
  }
  return prisma.booking.update({
    where: { id: bookingId },
    data: { onchainTx: sig, onchainError: null },
  });
}

export async function cancelBookingOnChain(bookingId: string) {
  const { sig } = await sendAsRegistrar([buildCancelBookingIx(loadRegistrar().publicKey, bookingId)]);
  await prisma.chainAuditLog.create({
    data: { actorUserId: null, action: "BOOKING_CANCEL_ONCHAIN", detail: `${bookingId} · ${sig}` },
  });
  return sig;
}
