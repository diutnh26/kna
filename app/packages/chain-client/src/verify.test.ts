import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  assertFinalMatchesPayload,
  assertPendingMatchesPayload,
  confirmSignature,
  contentHashFromPayload,
  decodePendingAttestation,
  hashLedgerId,
  hashProviderLabel,
  isLikelyFakeSignature,
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

function matchingPending(submittedBy: string) {
  return {
    ledgerIdHash: hashLedgerId(payload.ledgerId),
    providerHash: hashProviderLabel("Ami Homestay"),
    contentHash: contentHashFromPayload(payload),
    totalVnd: payload.totalVnd,
    platformVnd: payload.platformFeeVnd,
    communityVnd: payload.communityFundVnd,
    providerVnd: payload.providerPayoutVnd,
    recordedAt: 1,
    submittedBy,
    status: 0,
    bump: 255,
  };
}

describe("reject paths", () => {
  it("isLikelyFakeSignature catches mock and short signatures", () => {
    expect(isLikelyFakeSignature("mock_" + "A".repeat(80))).toBe(true);
    expect(isLikelyFakeSignature("devnet_" + "B".repeat(80))).toBe(true);
    expect(isLikelyFakeSignature("short")).toBe(true);
  });

  it("confirmSignature never hits RPC for fake signatures", async () => {
    const connection = {
      getSignatureStatuses: async () => {
        throw new Error("RPC should not be called for fake signatures");
      },
    } as any;
    await expect(confirmSignature(connection, "mock_deadbeef")).rejects.toThrow(
      /Rejected fake\/mock/
    );
  });

  it("rejects wrong coordinator signer", () => {
    const expected = Keypair.generate().publicKey.toBase58();
    const other = Keypair.generate().publicKey.toBase58();
    expect(() =>
      assertPendingMatchesPayload(matchingPending(other), payload, "Ami Homestay", expected)
    ).toThrow(/submitted_by does not match coordinator/);
  });

  it("rejects wrong program owner on decode", () => {
    const buf = Buffer.alloc(200, 1);
    expect(() => decodePendingAttestation(buf, Keypair.generate().publicKey)).toThrow(
      /not KNĂ trust program/
    );
    expect(() => decodePendingAttestation(buf, new PublicKey(KNA_TRUST_PROGRAM_ID))).not.toThrow(
      /not KNĂ trust program/
    );
  });

  it("rejects finalize when payload amounts do not match", () => {
    const account = {
      ledgerIdHash: hashLedgerId(payload.ledgerId),
      providerHash: hashProviderLabel("Ami Homestay"),
      contentHash: contentHashFromPayload(payload),
      totalVnd: payload.totalVnd,
      platformVnd: payload.platformFeeVnd,
      communityVnd: payload.communityFundVnd,
      providerVnd: payload.providerPayoutVnd,
      recordedAt: 1,
      finalizedAt: 2,
      finalizedBy: Keypair.generate().publicKey.toBase58(),
      bump: 255,
    };
    expect(() => assertFinalMatchesPayload(account, payload, "Ami Homestay")).not.toThrow();
    expect(() =>
      assertFinalMatchesPayload({ ...account, totalVnd: 42 }, payload, "Ami Homestay")
    ).toThrow(/final total_vnd/);
  });
});
