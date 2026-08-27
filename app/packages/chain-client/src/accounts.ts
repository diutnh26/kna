import { PublicKey } from "@solana/web3.js";
import { bytesToHex } from "./canonical";
import { readI64LE, readU64LE } from "./codec";
import { KNA_TRUST_PROGRAM_ID } from "./constants";

const ACCOUNT_DISCRIMINATOR = 8;

export interface DecodedPendingAttestation {
  ledgerIdHash: string;
  providerHash: string;
  contentHash: string;
  totalVnd: number;
  platformVnd: number;
  communityVnd: number;
  providerVnd: number;
  recordedAt: number;
  submittedBy: string;
  status: number;
  bump: number;
}

export interface DecodedFinalAttestation extends Omit<DecodedPendingAttestation, "submittedBy" | "status"> {
  finalizedAt: number;
  finalizedBy: string;
}

export interface DecodedConfig {
  version: number;
  platformFeeBps: number;
  communityFeeBps: number;
  coordinatorAuthority: string;
  committeeVault: string;
  paused: boolean;
  bump: number;
}

function requireOwnedByProgram(data: Buffer, owner: PublicKey) {
  if (!owner.equals(new PublicKey(KNA_TRUST_PROGRAM_ID))) {
    throw new Error("Account owner is not KNĂ trust program");
  }
  if (data.length < ACCOUNT_DISCRIMINATOR) {
    throw new Error("Account data too short");
  }
}

export function decodePendingAttestation(
  data: Buffer,
  owner: PublicKey
): DecodedPendingAttestation {
  requireOwnedByProgram(data, owner);
  let o = ACCOUNT_DISCRIMINATOR;
  const ledgerIdHash = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const providerHash = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const contentHash = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const totalVnd = Number(readU64LE(data, o));
  o += 8;
  const platformVnd = Number(readU64LE(data, o));
  o += 8;
  const communityVnd = Number(readU64LE(data, o));
  o += 8;
  const providerVnd = Number(readU64LE(data, o));
  o += 8;
  const recordedAt = Number(readI64LE(data, o));
  o += 8;
  const submittedBy = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const status = data[o];
  o += 1;
  const bump = data[o];
  return {
    ledgerIdHash,
    providerHash,
    contentHash,
    totalVnd,
    platformVnd,
    communityVnd,
    providerVnd,
    recordedAt,
    submittedBy,
    status,
    bump,
  };
}

export function decodeFinalAttestation(data: Buffer, owner: PublicKey): DecodedFinalAttestation {
  requireOwnedByProgram(data, owner);
  let o = ACCOUNT_DISCRIMINATOR;
  const ledgerIdHash = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const providerHash = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const contentHash = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const totalVnd = Number(readU64LE(data, o));
  o += 8;
  const platformVnd = Number(readU64LE(data, o));
  o += 8;
  const communityVnd = Number(readU64LE(data, o));
  o += 8;
  const providerVnd = Number(readU64LE(data, o));
  o += 8;
  const recordedAt = Number(readI64LE(data, o));
  o += 8;
  const finalizedAt = Number(readI64LE(data, o));
  o += 8;
  const finalizedBy = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const bump = data[o];
  return {
    ledgerIdHash,
    providerHash,
    contentHash,
    totalVnd,
    platformVnd,
    communityVnd,
    providerVnd,
    recordedAt,
    finalizedAt,
    finalizedBy,
    bump,
  };
}

export function decodeConfig(data: Buffer, owner: PublicKey): DecodedConfig {
  requireOwnedByProgram(data, owner);
  let o = ACCOUNT_DISCRIMINATOR;
  const version = data[o];
  o += 1;
  const platformFeeBps = data.readUInt16LE(o);
  o += 2;
  const communityFeeBps = data.readUInt16LE(o);
  o += 2;
  const coordinatorAuthority = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const committeeVault = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const paused = data[o] === 1;
  o += 1;
  const bump = data[o];
  return {
    version,
    platformFeeBps,
    communityFeeBps,
    coordinatorAuthority,
    committeeVault,
    paused,
    bump,
  };
}
