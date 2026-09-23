import { createHash } from "crypto";

/** Anchor ix discriminator: first 8 bytes of sha256("global:<name>"). */
export function anchorDiscriminator(ixName: string): Buffer {
  return createHash("sha256").update(`global:${ixName}`).digest().subarray(0, 8);
}

export const IX = {
  initializeConfig: "initialize_config",
  setPaused: "set_paused",
  setCommitteeVault: "set_committee_vault",
  grantRole: "grant_role",
  revokeRole: "revoke_role",
  submitAttestation: "submit_attestation",
  finalizeAttestation: "finalize_attestation",
  cancelPending: "cancel_pending",
  acknowledgeReceipt: "acknowledge_receipt",
  publishArchiveProof: "publish_archive_proof",
  revokeArchiveProof: "revoke_archive_proof",
  initializeTreasury: "initialize_treasury",
  settleSplit: "settle_split",
} as const;

export function encodeU64(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

export function encodeI64(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(n));
  return buf;
}

export function encodeBool(v: boolean): Buffer {
  return Buffer.from([v ? 1 : 0]);
}

export function encodeU8(v: number): Buffer {
  return Buffer.from([v & 0xff]);
}

export function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

export function readI64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}
