import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
  type Connection,
} from "@solana/web3.js";
import { anchorDiscriminator, encodeU64, IX, readI64LE, readU64LE } from "./codec";
import { bytesToHex, ledgerIdHashBytes } from "./canonical";
import { KNA_TRUST_PROGRAM_ID } from "./constants";
import { configPda, finalPdaFromLedgerId, programId, roleGrantPda } from "./instructions";

/**
 * Settlement: the treasury escrow and settle_split, which pays a finalized
 * attestation out in three SPL token transfers (provider, Community Fund,
 * platform). See programs/kna-trust-layer (initialize_treasury, settle_split).
 */

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const DISCRIMINATOR = 8;

function meta(pubkey: PublicKey, isSigner = false, isWritable = false): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

export function treasuryPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury")], programId())[0];
}

export function settlementPdaFromLedgerId(ledgerId: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("settlement"), Buffer.from(ledgerIdHashBytes(ledgerId))],
    programId()
  )[0];
}

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

export function buildInitializeTreasuryIx(opts: {
  authority: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
  platformWallet: PublicKey;
  unitsPerVnd: number | bigint;
}) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.authority, true, true),
      meta(configPda()),
      meta(treasuryPda(), false, true),
      meta(opts.mint),
      meta(opts.vault),
      meta(SystemProgram.programId),
    ],
    data: Buffer.concat([
      anchorDiscriminator(IX.initializeTreasury),
      opts.platformWallet.toBuffer(),
      encodeU64(opts.unitsPerVnd),
    ]),
  });
}

export function buildSettleSplitIx(opts: {
  settler: PublicKey;
  ledgerId: string;
  mint: PublicKey;
  vault: PublicKey;
  providerToken: PublicKey;
  communityToken: PublicKey;
  platformToken: PublicKey;
}) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(opts.settler, true, true),
      meta(configPda()),
      meta(roleGrantPda(opts.settler)),
      meta(treasuryPda(), false, true),
      meta(finalPdaFromLedgerId(opts.ledgerId)),
      meta(settlementPdaFromLedgerId(opts.ledgerId), false, true),
      meta(opts.vault, false, true),
      meta(opts.mint),
      meta(opts.providerToken, false, true),
      meta(opts.communityToken, false, true),
      meta(opts.platformToken, false, true),
      meta(TOKEN_PROGRAM_ID),
      meta(SystemProgram.programId),
    ],
    data: anchorDiscriminator(IX.settleSplit),
  });
}

export interface DecodedTreasury {
  mint: string;
  vault: string;
  platformWallet: string;
  unitsPerVnd: bigint;
  decimals: number;
  settledCount: number;
  settledTotalVnd: number;
  bump: number;
}

export interface DecodedSettlementRecord {
  ledgerIdHash: string;
  providerToken: string;
  providerVnd: number;
  communityVnd: number;
  platformVnd: number;
  unitsPerVnd: bigint;
  settledAt: number;
  settledBy: string;
  bump: number;
}

function requireProgramAccount(data: Buffer, owner: PublicKey) {
  if (!owner.equals(new PublicKey(KNA_TRUST_PROGRAM_ID))) {
    throw new Error("Account owner is not KNĂ trust program");
  }
  if (data.length < DISCRIMINATOR) {
    throw new Error("Account data too short");
  }
}

export function decodeTreasury(data: Buffer, owner: PublicKey): DecodedTreasury {
  requireProgramAccount(data, owner);
  let o = DISCRIMINATOR;
  const key = () => {
    const k = new PublicKey(data.subarray(o, o + 32)).toBase58();
    o += 32;
    return k;
  };
  const mint = key();
  const vault = key();
  const platformWallet = key();
  const unitsPerVnd = readU64LE(data, o);
  o += 8;
  const decimals = data[o];
  o += 1;
  const settledCount = Number(readU64LE(data, o));
  o += 8;
  const settledTotalVnd = Number(readU64LE(data, o));
  o += 8;
  return { mint, vault, platformWallet, unitsPerVnd, decimals, settledCount, settledTotalVnd, bump: data[o] };
}

export function decodeSettlementRecord(data: Buffer, owner: PublicKey): DecodedSettlementRecord {
  requireProgramAccount(data, owner);
  let o = DISCRIMINATOR;
  const ledgerIdHash = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const providerToken = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const providerVnd = Number(readU64LE(data, o));
  o += 8;
  const communityVnd = Number(readU64LE(data, o));
  o += 8;
  const platformVnd = Number(readU64LE(data, o));
  o += 8;
  const unitsPerVnd = readU64LE(data, o);
  o += 8;
  const settledAt = Number(readI64LE(data, o));
  o += 8;
  const settledBy = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  return {
    ledgerIdHash,
    providerToken,
    providerVnd,
    communityVnd,
    platformVnd,
    unitsPerVnd,
    settledAt,
    settledBy,
    bump: data[o],
  };
}

export async function fetchTreasury(connection: Connection) {
  const info = await connection.getAccountInfo(treasuryPda(), "confirmed");
  return info ? decodeTreasury(Buffer.from(info.data), info.owner) : null;
}

export async function fetchSettlementRecord(connection: Connection, ledgerId: string) {
  const address = settlementPdaFromLedgerId(ledgerId);
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info) return null;
  return { address: address.toBase58(), account: decodeSettlementRecord(Buffer.from(info.data), info.owner) };
}
