import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
  type Connection,
} from "@solana/web3.js";
import { anchorDiscriminator, encodeI64, encodeU64, encodeU8, IX, readI64LE, readU64LE } from "./codec";
import { bytesToHex, hashBookingId, hashUserId, hexToBytes } from "./canonical";
import { KNA_TRUST_PROGRAM_ID } from "./constants";
import { configPda, programId, roleGrantPda } from "./instructions";

/**
 * Accounts, bookings and payment on the KNĂ program:
 *   register_account   one KNĂ account ↔ one fixed wallet (both directions unique)
 *   set_payment_wallet the wallet that pays (the fixed one, or a linked Phantom)
 *   create_booking     a confirmed booking with its 7 / 3 / 90 split
 *   pay_booking        payment at check-out: three SPL token transfers
 *   mark_unpaid / cancel_booking
 */

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const DISCRIMINATOR = 8;

function meta(pubkey: PublicKey, isSigner = false, isWritable = false): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

function pda(seeds: (Buffer | Uint8Array)[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds.map((s) => Buffer.from(s)), programId())[0];
}

export const userHashBytes = (userId: string) => hexToBytes(hashUserId(userId));
export const bookingHashBytes = (bookingId: string) => hexToBytes(hashBookingId(bookingId));

export const paymentConfigPda = () => pda([Buffer.from("payment_config")]);
export const accountRecordPda = (userId: string) => pda([Buffer.from("account"), userHashBytes(userId)]);
export const walletRecordPda = (wallet: PublicKey) => pda([Buffer.from("wallet"), wallet.toBuffer()]);
export const bookingRecordPda = (bookingId: string) => pda([Buffer.from("booking"), bookingHashBytes(bookingId)]);

/** Associated token account of `owner` for `mint` (owner may be a PDA). */
export function associatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

/** Idempotent ATA creation (Associated Token program, instruction 1). */
export function buildCreateAtaIdempotentIx(payer: PublicKey, owner: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      meta(payer, true, true),
      meta(associatedTokenAddress(mint, owner), false, true),
      meta(owner),
      meta(mint),
      meta(SystemProgram.programId),
      meta(TOKEN_PROGRAM_ID),
    ],
    data: Buffer.from([1]),
  });
}

// ── builders ────────────────────────────────────────────────────────────

export function buildInitializePaymentConfigIx(opts: {
  authority: PublicKey;
  mint: PublicKey;
  platformWallet: PublicKey;
  communityWallet: PublicKey;
  unitsPerVnd: number | bigint;
}) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.authority, true, true),
      meta(configPda()),
      meta(paymentConfigPda(), false, true),
      meta(opts.mint),
      meta(SystemProgram.programId),
    ],
    data: Buffer.concat([
      anchorDiscriminator(IX.initializePaymentConfig),
      opts.platformWallet.toBuffer(),
      opts.communityWallet.toBuffer(),
      encodeU64(opts.unitsPerVnd),
    ]),
  });
}

export function buildUpdatePaymentWalletsIx(opts: {
  authority: PublicKey;
  platformWallet: PublicKey;
  communityWallet: PublicKey;
}) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [meta(opts.authority, true), meta(configPda()), meta(paymentConfigPda(), false, true)],
    data: Buffer.concat([
      anchorDiscriminator(IX.updatePaymentWallets),
      opts.platformWallet.toBuffer(),
      opts.communityWallet.toBuffer(),
    ]),
  });
}

export function buildRegisterAccountIx(opts: {
  registrar: PublicKey;
  wallet: PublicKey;
  userId: string;
  flags: number;
}) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.registrar, true, true),
      meta(configPda()),
      meta(roleGrantPda(opts.registrar)),
      meta(opts.wallet, true),
      meta(accountRecordPda(opts.userId), false, true),
      meta(walletRecordPda(opts.wallet), false, true),
      meta(SystemProgram.programId),
    ],
    data: Buffer.concat([
      anchorDiscriminator(IX.registerAccount),
      Buffer.from(userHashBytes(opts.userId)),
      encodeU8(opts.flags),
    ]),
  });
}

export function buildSetAccountFlagsIx(opts: { registrar: PublicKey; userId: string; flags: number }) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.registrar, true),
      meta(roleGrantPda(opts.registrar)),
      meta(accountRecordPda(opts.userId), false, true),
    ],
    data: Buffer.concat([anchorDiscriminator(IX.setAccountFlags), encodeU8(opts.flags)]),
  });
}

/** `paymentWallet === wallet` unlinks (pays from the account's own wallet again). */
export function buildSetPaymentWalletIx(opts: {
  wallet: PublicKey;
  paymentWallet: PublicKey;
  userId: string;
}) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.wallet, true),
      meta(opts.paymentWallet, true),
      meta(accountRecordPda(opts.userId), false, true),
    ],
    data: anchorDiscriminator(IX.setPaymentWallet),
  });
}

export function buildCreateBookingIx(opts: {
  registrar: PublicKey;
  bookingId: string;
  guestUserId: string;
  providerUserId: string;
  checkIn: number;
  checkOut: number;
  totalVnd: number;
  platformVnd: number;
  communityVnd: number;
  providerVnd: number;
}) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.registrar, true, true),
      meta(configPda()),
      meta(roleGrantPda(opts.registrar)),
      meta(accountRecordPda(opts.guestUserId)),
      meta(accountRecordPda(opts.providerUserId)),
      meta(bookingRecordPda(opts.bookingId), false, true),
      meta(SystemProgram.programId),
    ],
    data: Buffer.concat([
      anchorDiscriminator(IX.createBooking),
      Buffer.from(bookingHashBytes(opts.bookingId)),
      encodeI64(opts.checkIn),
      encodeI64(opts.checkOut),
      encodeU64(opts.totalVnd),
      encodeU64(opts.platformVnd),
      encodeU64(opts.communityVnd),
      encodeU64(opts.providerVnd),
    ]),
  });
}

export function buildPayBookingIx(opts: {
  payer: PublicKey;
  bookingId: string;
  guestUserId: string;
  mint: PublicKey;
  providerWallet: PublicKey;
  communityWallet: PublicKey;
  platformWallet: PublicKey;
  /** Overrides, for tests that send the wrong accounts on purpose. */
  payerToken?: PublicKey;
  providerToken?: PublicKey;
  communityToken?: PublicKey;
  platformToken?: PublicKey;
}) {
  const ata = (owner: PublicKey) => associatedTokenAddress(opts.mint, owner);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.payer, true),
      meta(configPda()),
      meta(paymentConfigPda()),
      meta(bookingRecordPda(opts.bookingId), false, true),
      meta(accountRecordPda(opts.guestUserId)),
      meta(opts.mint),
      meta(opts.payerToken ?? ata(opts.payer), false, true),
      meta(opts.providerToken ?? ata(opts.providerWallet), false, true),
      meta(opts.communityToken ?? ata(opts.communityWallet), false, true),
      meta(opts.platformToken ?? ata(opts.platformWallet), false, true),
      meta(TOKEN_PROGRAM_ID),
    ],
    data: anchorDiscriminator(IX.payBooking),
  });
}

function buildUpdateBookingIx(name: string, registrar: PublicKey, bookingId: string) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(registrar, true),
      meta(roleGrantPda(registrar)),
      meta(bookingRecordPda(bookingId), false, true),
    ],
    data: anchorDiscriminator(name),
  });
}

export const buildMarkUnpaidIx = (registrar: PublicKey, bookingId: string) =>
  buildUpdateBookingIx(IX.markUnpaid, registrar, bookingId);
export const buildCancelBookingIx = (registrar: PublicKey, bookingId: string) =>
  buildUpdateBookingIx(IX.cancelBooking, registrar, bookingId);

// ── decoders ────────────────────────────────────────────────────────────

class Reader {
  o = DISCRIMINATOR;
  constructor(private data: Buffer) {}
  key() {
    const k = new PublicKey(this.data.subarray(this.o, this.o + 32)).toBase58();
    this.o += 32;
    return k;
  }
  hash() {
    const h = bytesToHex(this.data.subarray(this.o, this.o + 32));
    this.o += 32;
    return h;
  }
  u8() {
    return this.data[this.o++];
  }
  u64() {
    const v = readU64LE(this.data, this.o);
    this.o += 8;
    return v;
  }
  i64() {
    const v = readI64LE(this.data, this.o);
    this.o += 8;
    return Number(v);
  }
}

function reader(data: Buffer, owner: PublicKey) {
  if (!owner.equals(new PublicKey(KNA_TRUST_PROGRAM_ID))) {
    throw new Error("Account owner is not KNĂ trust program");
  }
  if (data.length < DISCRIMINATOR) throw new Error("Account data too short");
  return new Reader(data);
}

export interface DecodedPaymentConfig {
  mint: string;
  decimals: number;
  unitsPerVnd: bigint;
  platformWallet: string;
  communityWallet: string;
}

export function decodePaymentConfig(data: Buffer, owner: PublicKey): DecodedPaymentConfig {
  const r = reader(data, owner);
  const mint = r.key();
  const decimals = r.u8();
  const unitsPerVnd = r.u64();
  return { mint, decimals, unitsPerVnd, platformWallet: r.key(), communityWallet: r.key() };
}

export interface DecodedAccountRecord {
  userHash: string;
  wallet: string;
  paymentWallet: string;
  flags: number;
  registeredAt: number;
}

export function decodeAccountRecord(data: Buffer, owner: PublicKey): DecodedAccountRecord {
  const r = reader(data, owner);
  return {
    userHash: r.hash(),
    wallet: r.key(),
    paymentWallet: r.key(),
    flags: r.u8(),
    registeredAt: r.i64(),
  };
}

export function decodeWalletRecord(data: Buffer, owner: PublicKey) {
  const r = reader(data, owner);
  return { wallet: r.key(), userHash: r.hash() };
}

export interface DecodedBookingRecord {
  bookingHash: string;
  guestUserHash: string;
  providerUserHash: string;
  providerWallet: string;
  checkIn: number;
  checkOut: number;
  totalVnd: number;
  platformVnd: number;
  communityVnd: number;
  providerVnd: number;
  status: number;
  paidBy: string;
  paidAt: number;
  createdAt: number;
}

export function decodeBookingRecord(data: Buffer, owner: PublicKey): DecodedBookingRecord {
  const r = reader(data, owner);
  return {
    bookingHash: r.hash(),
    guestUserHash: r.hash(),
    providerUserHash: r.hash(),
    providerWallet: r.key(),
    checkIn: r.i64(),
    checkOut: r.i64(),
    totalVnd: Number(r.u64()),
    platformVnd: Number(r.u64()),
    communityVnd: Number(r.u64()),
    providerVnd: Number(r.u64()),
    status: r.u8(),
    paidBy: r.key(),
    paidAt: r.i64(),
    createdAt: r.i64(),
  };
}

async function fetchDecoded<T>(
  connection: Connection,
  address: PublicKey,
  decode: (data: Buffer, owner: PublicKey) => T
): Promise<T | null> {
  const info = await connection.getAccountInfo(address, "confirmed");
  return info ? decode(Buffer.from(info.data), info.owner) : null;
}

export const fetchPaymentConfig = (c: Connection) =>
  fetchDecoded(c, paymentConfigPda(), decodePaymentConfig);
export const fetchAccountRecord = (c: Connection, userId: string) =>
  fetchDecoded(c, accountRecordPda(userId), decodeAccountRecord);
export const fetchWalletRecord = (c: Connection, wallet: PublicKey) =>
  fetchDecoded(c, walletRecordPda(wallet), decodeWalletRecord);
export const fetchBookingRecord = (c: Connection, bookingId: string) =>
  fetchDecoded(c, bookingRecordPda(bookingId), decodeBookingRecord);
