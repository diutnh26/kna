import { sha256 } from "@noble/hashes/sha256";

/** Domain-separated canonical payload for ledger attestations (no PII). */
export interface LedgerAttestationPayload {
  ledgerId: string;
  providerLabelHash: string;
  totalVnd: number;
  platformFeeVnd: number;
  communityFundVnd: number;
  providerPayoutVnd: number;
  recordedAtIso: string;
  kind: "booking" | "order" | "offset";
}

const DOMAIN = "kna-trust-v1";

export function hashProviderLabel(label: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(`${DOMAIN}:provider:${label}`)));
}

export function hashLedgerId(ledgerId: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(`${DOMAIN}:ledger:${ledgerId}`)));
}

export function encodeAttestationPayload(payload: LedgerAttestationPayload): Uint8Array {
  const canonical = JSON.stringify({
    v: 1,
    ledgerId: payload.ledgerId,
    providerLabelHash: payload.providerLabelHash,
    totalVnd: payload.totalVnd,
    platformFeeVnd: payload.platformFeeVnd,
    communityFundVnd: payload.communityFundVnd,
    providerPayoutVnd: payload.providerPayoutVnd,
    recordedAtIso: payload.recordedAtIso,
    kind: payload.kind,
  });
  return new TextEncoder().encode(canonical);
}

export function contentHashFromPayload(payload: LedgerAttestationPayload): string {
  return bytesToHex(sha256(encodeAttestationPayload(payload)));
}

export function ledgerIdHashBytes(ledgerId: string): Uint8Array {
  return hexToBytes(hashLedgerId(ledgerId));
}

export function providerHashBytes(label: string): Uint8Array {
  return hexToBytes(hashProviderLabel(label));
}

export function contentHashBytes(payload: LedgerAttestationPayload): Uint8Array {
  return hexToBytes(contentHashFromPayload(payload));
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length !== 64) {
    throw new Error("Expected 32-byte hex string");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function validateSplitInvariant(
  totalVnd: number,
  platformFeeVnd: number,
  communityFundVnd: number,
  providerPayoutVnd: number
): boolean {
  if (platformFeeVnd + communityFundVnd + providerPayoutVnd !== totalVnd) return false;
  // Match on-chain integer division (floor), not banker's rounding.
  const expectedPlatform = Math.floor((totalVnd * 700) / 10_000);
  const expectedCommunity = Math.floor((totalVnd * 300) / 10_000);
  return platformFeeVnd === expectedPlatform && communityFundVnd === expectedCommunity;
}
