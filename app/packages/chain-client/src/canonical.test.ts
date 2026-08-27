import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  assertPendingMatchesPayload,
  buildSubmitAttestationIx,
  contentHashFromPayload,
  decodePendingAttestation,
  hashLedgerId,
  hashProviderLabel,
  isLikelyFakeSignature,
  pendingPdaFromLedgerId,
  validateSplitInvariant,
  type LedgerAttestationPayload,
} from "./index";
import { KNA_TRUST_PROGRAM_ID } from "./constants";

const payload: LedgerAttestationPayload = {
  ledgerId: "clxyzledger001",
  providerLabelHash: hashProviderLabel("Ami Homestay"),
  totalVnd: 1_000_000,
  platformFeeVnd: 70_000,
  communityFundVnd: 30_000,
  providerPayoutVnd: 900_000,
  recordedAtIso: "2026-08-24T00:00:00.000Z",
  kind: "booking",
};

describe("split + hashes", () => {
  it("matches on-chain floor split", () => {
    expect(validateSplitInvariant(1_000_000, 70_000, 30_000, 900_000)).toBe(true);
    expect(validateSplitInvariant(1_000_001, 70_000, 30_000, 900_001)).toBe(true);
    expect(validateSplitInvariant(1_000_000, 70_001, 30_000, 899_999)).toBe(false);
  });

  it("stable content hash", () => {
    expect(contentHashFromPayload(payload)).toHaveLength(64);
    expect(contentHashFromPayload(payload)).toBe(contentHashFromPayload({ ...payload }));
  });
});

describe("instructions", () => {
  it("builds submit ix for program id", () => {
    const ix = buildSubmitAttestationIx({
      coordinator: Keypair.generate().publicKey,
      ledgerId: payload.ledgerId,
      providerLabel: "Ami Homestay",
      payload,
      recordedAtUnix: 1724457600,
    });
    expect(ix.programId.toBase58()).toBe(KNA_TRUST_PROGRAM_ID);
    expect(ix.keys).toHaveLength(5);
    expect(ix.data.length).toBeGreaterThan(8);
  });

  it("pending PDA is deterministic", () => {
    const a = pendingPdaFromLedgerId(payload.ledgerId).toBase58();
    const b = pendingPdaFromLedgerId(payload.ledgerId).toBase58();
    expect(a).toBe(b);
  });
});

describe("verify helpers", () => {
  it("rejects mock signatures", () => {
    expect(isLikelyFakeSignature("mock_abc_123")).toBe(true);
    expect(isLikelyFakeSignature("devnet_deadbeef_1")).toBe(true);
  });

  it("assertPendingMatchesPayload checks hashes", () => {
    const account = {
      ledgerIdHash: hashLedgerId(payload.ledgerId),
      providerHash: hashProviderLabel("Ami Homestay"),
      contentHash: contentHashFromPayload(payload),
      totalVnd: payload.totalVnd,
      platformVnd: payload.platformFeeVnd,
      communityVnd: payload.communityFundVnd,
      providerVnd: payload.providerPayoutVnd,
      recordedAt: 1,
      submittedBy: Keypair.generate().publicKey.toBase58(),
      status: 0,
      bump: 255,
    };
    expect(() => assertPendingMatchesPayload(account, payload, "Ami Homestay")).not.toThrow();
    expect(() =>
      assertPendingMatchesPayload({ ...account, totalVnd: 1 }, payload, "Ami Homestay")
    ).toThrow(/total_vnd/);
  });

  it("decodePendingAttestation requires program owner", () => {
    const buf = Buffer.alloc(8 + 32 + 32 + 32 + 8 * 5 + 32 + 2, 1);
    expect(() => decodePendingAttestation(buf, Keypair.generate().publicKey)).toThrow(/owner/);
  });
});
