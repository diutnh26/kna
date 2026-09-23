import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM, type TransactionMetadata } from "litesvm";
import {
  ATTESTATION_CANCELLED,
  ATTESTATION_FINALIZED,
  ATTESTATION_PENDING,
  ROLE_COMMITTEE,
  ROLE_COORDINATOR,
  buildCancelPendingIx,
  buildFinalizeAttestationIx,
  buildGrantRoleIx,
  buildInitializeConfigIx,
  buildRevokeRoleIx,
  buildSetPausedIx,
  buildSubmitAttestationIx,
  configPda,
  decodeConfig,
  decodeFinalAttestation,
  decodePendingAttestation,
  finalPdaFromLedgerId,
  hashProviderLabel,
  pendingPdaFromLedgerId,
  programId,
  recordedAtUnixFromIso,
  type LedgerAttestationPayload,
} from "../src";

/**
 * Integration tests for the kna-trust-layer program: the compiled .so runs
 * inside LiteSVM, and every instruction goes through the same builders the
 * API and web use. These are the guards the unit tests on validate_split
 * cannot reach — signer checks, role checks, pause, and the state machine
 * PENDING → FINALIZED | CANCELLED.
 *
 * Needs `anchor build` first (target/deploy/kna_trust_layer.so), and a
 * Linux or macOS host: LiteSVM ships no Windows binary. On Windows, run
 * scripts/program-tests.ps1, which does both inside Docker.
 */

const PROGRAM_SO =
  process.env.KNA_PROGRAM_SO ?? resolve(__dirname, "../../../target/deploy/kna_trust_layer.so");

if (!existsSync(PROGRAM_SO)) {
  throw new Error(
    `Program binary not found at ${PROGRAM_SO}. Run \`anchor build\` first, or set KNA_PROGRAM_SO.`
  );
}

type Result = TransactionMetadata | FailedTransactionMetadata;

/** Compute units per successful instruction, printed at the end (Phase 6 input). */
const computeUnits = new Map<string, bigint[]>();

function record(label: string, res: Result) {
  if (res instanceof FailedTransactionMetadata) return;
  const list = computeUnits.get(label) ?? [];
  list.push(res.computeUnitsConsumed());
  computeUnits.set(label, list);
}

afterAll(() => {
  const rows = [...computeUnits.entries()].map(([instruction, units]) => ({
    instruction,
    runs: units.length,
    maxCU: Number(units.reduce((a, b) => (b > a ? b : a), 0n)),
  }));
  console.log("Compute units by instruction (LiteSVM):");
  console.table(rows);
});

function logsOf(res: Result): string {
  const meta = res instanceof FailedTransactionMetadata ? res.meta() : res;
  return meta.logs().join("\n");
}

function expectOk(res: Result) {
  if (res instanceof FailedTransactionMetadata) {
    throw new Error(`Transaction failed:\n${logsOf(res)}`);
  }
}

/** Fails with the named Anchor error (KnaError variant or Anchor constraint). */
function expectAnchorError(res: Result, name: string) {
  expect(res, "transaction should have failed").toBeInstanceOf(FailedTransactionMetadata);
  expect(logsOf(res)).toContain(`Error Code: ${name}`);
}

/** Fails because an `init` account already exists — the replay guard. */
function expectAlreadyInUse(res: Result) {
  expect(res, "transaction should have failed").toBeInstanceOf(FailedTransactionMetadata);
  expect(logsOf(res)).toMatch(/already in use/);
}

function payloadFor(ledgerId: string, overrides: Partial<LedgerAttestationPayload> = {}) {
  // 1,000,000 ₫ at 7% / 3%: the booking split the program enforces.
  const payload: LedgerAttestationPayload = {
    ledgerId,
    providerLabelHash: hashProviderLabel("H'Bia Homestay"),
    totalVnd: 1_000_000,
    platformFeeVnd: 70_000,
    communityFundVnd: 30_000,
    providerPayoutVnd: 900_000,
    recordedAtIso: "2026-09-01T00:00:00.000Z",
    kind: "booking",
    ...overrides,
  };
  return payload;
}

/**
 * A fresh chain per test: config initialised by `admin` (the coordinator
 * authority), a coordinator and a committee member granted their roles, and
 * `vault` standing in for the Squads vault — a keypair here, since what the
 * program checks is only that the signer equals config.committee_vault.
 */
function setup() {
  const svm = new LiteSVM();
  svm.addProgramFromFile(programId(), PROGRAM_SO);

  const admin = Keypair.generate();
  const coordinator = Keypair.generate();
  const member = Keypair.generate();
  const vault = Keypair.generate();
  const outsider = Keypair.generate();
  for (const kp of [admin, coordinator, member, vault, outsider]) {
    svm.airdrop(kp.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
  }

  const send = (label: string, ixs: TransactionInstruction[], signers: Keypair[]): Result => {
    const tx = new Transaction();
    tx.recentBlockhash = svm.latestBlockhash();
    tx.feePayer = signers[0].publicKey;
    tx.add(...ixs);
    tx.sign(...signers);
    const res = svm.sendTransaction(tx);
    record(label, res);
    // A fresh blockhash for the next send, so a deliberate replay of the same
    // instruction is judged by the program rather than rejected as a
    // duplicate signature.
    svm.expireBlockhash();
    return res;
  };

  expectOk(send("initialize_config", [buildInitializeConfigIx(admin.publicKey, vault.publicKey)], [admin]));
  expectOk(
    send(
      "grant_role",
      [buildGrantRoleIx(admin.publicKey, coordinator.publicKey, ROLE_COORDINATOR)],
      [admin]
    )
  );
  expectOk(
    send("grant_role", [buildGrantRoleIx(admin.publicKey, member.publicKey, ROLE_COMMITTEE)], [admin])
  );

  const account = (address: PublicKey) => {
    const acct = svm.getAccount(address);
    if (!acct) return null;
    return { data: Buffer.from(acct.data), owner: new PublicKey(acct.owner) };
  };

  const submit = (ledgerId: string, signer: Keypair, overrides: Partial<LedgerAttestationPayload> = {}) => {
    const payload = payloadFor(ledgerId, overrides);
    return send(
      "submit_attestation",
      [
        buildSubmitAttestationIx({
          coordinator: signer.publicKey,
          ledgerId,
          providerLabel: "H'Bia Homestay",
          payload,
          recordedAtUnix: recordedAtUnixFromIso(payload.recordedAtIso),
        }),
      ],
      [signer]
    );
  };

  const finalize = (ledgerId: string, signer: Keypair, viaVault = false) =>
    send(
      viaVault ? "finalize_attestation (vault)" : "finalize_attestation (member)",
      [
        buildFinalizeAttestationIx({
          authority: signer.publicKey,
          ledgerId,
          includeCommitteeRole: !viaVault,
        }),
      ],
      [signer]
    );

  const cancel = (ledgerId: string, signer: Keypair) =>
    send("cancel_pending", [buildCancelPendingIx(signer.publicKey, ledgerId)], [signer]);

  const pending = (ledgerId: string) => {
    const acct = account(pendingPdaFromLedgerId(ledgerId));
    return acct && decodePendingAttestation(acct.data, acct.owner);
  };

  const final = (ledgerId: string) => {
    const acct = account(finalPdaFromLedgerId(ledgerId));
    return acct && decodeFinalAttestation(acct.data, acct.owner);
  };

  return { svm, send, admin, coordinator, member, vault, outsider, account, submit, finalize, cancel, pending, final };
}

describe("kna-trust-layer program", () => {
  describe("configuration and roles", () => {
    it("initialises config with the fee schedule, authority and committee vault", () => {
      const { account, admin, vault } = setup();
      const acct = account(configPda());
      expect(acct).not.toBeNull();
      const config = decodeConfig(acct!.data, acct!.owner);
      expect(config.platformFeeBps).toBe(700);
      expect(config.communityFeeBps).toBe(300);
      expect(config.coordinatorAuthority).toBe(admin.publicKey.toBase58());
      expect(config.committeeVault).toBe(vault.publicKey.toBase58());
      expect(config.paused).toBe(false);
    });

    it("refuses a second initialize_config", () => {
      const { send, outsider } = setup();
      const res = send(
        "initialize_config",
        [buildInitializeConfigIx(outsider.publicKey, outsider.publicKey)],
        [outsider]
      );
      expectAlreadyInUse(res);
    });

    it("lets only the coordinator authority grant a role", () => {
      const { send, outsider } = setup();
      const wallet = Keypair.generate().publicKey;
      const res = send(
        "grant_role",
        [buildGrantRoleIx(outsider.publicKey, wallet, ROLE_COORDINATOR)],
        [outsider]
      );
      expectAnchorError(res, "Unauthorized");
    });

    it("rejects an unknown role number", () => {
      const { send, admin } = setup();
      const res = send("grant_role", [buildGrantRoleIx(admin.publicKey, Keypair.generate().publicKey, 9)], [admin]);
      expectAnchorError(res, "InvalidRole");
    });

    it("lets only the coordinator authority pause the program", () => {
      const { send, outsider } = setup();
      expectAnchorError(send("set_paused", [buildSetPausedIx(outsider.publicKey, true)], [outsider]), "Unauthorized");
    });

    it("lets only the coordinator authority revoke a role", () => {
      const { send, outsider, coordinator } = setup();
      const res = send("revoke_role", [buildRevokeRoleIx(outsider.publicKey, coordinator.publicKey)], [outsider]);
      expectAnchorError(res, "Unauthorized");
    });
  });

  describe("submit_attestation", () => {
    it("records the four amounts and the submitter in a PENDING attestation", () => {
      const { submit, pending, coordinator } = setup();
      expectOk(submit("ledger-ok", coordinator));
      const p = pending("ledger-ok")!;
      expect(p.status).toBe(ATTESTATION_PENDING);
      expect(p.totalVnd).toBe(1_000_000);
      expect(p.platformVnd).toBe(70_000);
      expect(p.communityVnd).toBe(30_000);
      expect(p.providerVnd).toBe(900_000);
      expect(p.submittedBy).toBe(coordinator.publicKey.toBase58());
    });

    it("refuses a second submission for the same ledger entry", () => {
      const { submit, coordinator } = setup();
      expectOk(submit("ledger-twice", coordinator));
      expectAlreadyInUse(submit("ledger-twice", coordinator));
    });

    it("refuses a signer holding the committee role instead of the coordinator role", () => {
      const { submit, member, pending } = setup();
      expectAnchorError(submit("ledger-wrong-role", member), "Unauthorized");
      expect(pending("ledger-wrong-role")).toBeNull();
    });

    it("refuses a signer with no role grant at all", () => {
      const { submit, outsider } = setup();
      expectAnchorError(submit("ledger-no-role", outsider), "AccountNotInitialized");
    });

    it("refuses a coordinator whose role was revoked", () => {
      const { send, submit, admin, coordinator } = setup();
      expectOk(send("revoke_role", [buildRevokeRoleIx(admin.publicKey, coordinator.publicKey)], [admin]));
      expectAnchorError(submit("ledger-revoked", coordinator), "RoleRevoked");
    });

    it("refuses while the program is paused, and accepts again once unpaused", () => {
      const { send, submit, admin, coordinator } = setup();
      expectOk(send("set_paused", [buildSetPausedIx(admin.publicKey, true)], [admin]));
      expectAnchorError(submit("ledger-paused", coordinator), "Paused");
      expectOk(send("set_paused", [buildSetPausedIx(admin.publicKey, false)], [admin]));
      expectOk(submit("ledger-paused", coordinator));
    });

    it("refuses amounts that do not add up to the total", () => {
      const { submit, coordinator } = setup();
      expectAnchorError(submit("ledger-sum", coordinator, { providerPayoutVnd: 899_999 }), "SplitMismatch");
    });

    it("refuses a split other than 7% / 3%", () => {
      // The marketplace split (5% / 0%): why the API no longer queues orders.
      const { submit, coordinator } = setup();
      const res = submit("ledger-marketplace", coordinator, {
        platformFeeVnd: 50_000,
        communityFundVnd: 0,
        providerPayoutVnd: 950_000,
      });
      expectAnchorError(res, "SplitMismatch");
    });

    it("floors each share on a total not divisible by 100 (F1)", () => {
      // 3,750 ₫: 7% is 262.5 and 3% is 112.5. The API floors to 262 / 112;
      // rounding to 263 / 113 is what the program rejects.
      const { submit, coordinator } = setup();
      const rounded = submit("ledger-odd-round", coordinator, {
        totalVnd: 3_750,
        platformFeeVnd: 263,
        communityFundVnd: 113,
        providerPayoutVnd: 3_374,
      });
      expectAnchorError(rounded, "SplitMismatch");
      const floored = submit("ledger-odd-floor", coordinator, {
        totalVnd: 3_750,
        platformFeeVnd: 262,
        communityFundVnd: 112,
        providerPayoutVnd: 3_376,
      });
      expectOk(floored);
    });
  });

  describe("finalize_attestation", () => {
    it("lets a committee member finalize, copying the amounts into the final PDA", () => {
      const { submit, finalize, pending, final, coordinator, member } = setup();
      expectOk(submit("ledger-member", coordinator));
      expectOk(finalize("ledger-member", member));
      expect(pending("ledger-member")!.status).toBe(ATTESTATION_FINALIZED);
      const f = final("ledger-member")!;
      expect(f.totalVnd).toBe(1_000_000);
      expect(f.communityVnd).toBe(30_000);
      expect(f.finalizedBy).toBe(member.publicKey.toBase58());
    });

    it("lets the committee vault finalize without a role grant", () => {
      const { submit, finalize, final, coordinator, vault } = setup();
      expectOk(submit("ledger-vault", coordinator));
      expectOk(finalize("ledger-vault", vault, true));
      expect(final("ledger-vault")!.finalizedBy).toBe(vault.publicKey.toBase58());
    });

    it("refuses the coordinator: submitting and finalizing are separate duties", () => {
      const { submit, finalize, final, coordinator } = setup();
      expectOk(submit("ledger-self", coordinator));
      expectAnchorError(finalize("ledger-self", coordinator), "Unauthorized");
      expect(final("ledger-self")).toBeNull();
    });

    it("refuses a signer who is neither the vault nor a committee member", () => {
      const { submit, finalize, coordinator, outsider } = setup();
      expectOk(submit("ledger-outsider", coordinator));
      expectAnchorError(finalize("ledger-outsider", outsider, true), "Unauthorized");
    });

    it("refuses a committee member whose role was revoked", () => {
      const { send, submit, finalize, admin, coordinator, member } = setup();
      expectOk(submit("ledger-member-revoked", coordinator));
      expectOk(send("revoke_role", [buildRevokeRoleIx(admin.publicKey, member.publicKey)], [admin]));
      expectAnchorError(finalize("ledger-member-revoked", member), "RoleRevoked");
    });

    it("refuses while the program is paused", () => {
      const { send, submit, finalize, admin, coordinator, member } = setup();
      expectOk(submit("ledger-final-paused", coordinator));
      expectOk(send("set_paused", [buildSetPausedIx(admin.publicKey, true)], [admin]));
      expectAnchorError(finalize("ledger-final-paused", member), "Paused");
    });

    it("cannot finalize the same attestation twice (no double settlement)", () => {
      const { submit, finalize, final, coordinator, member, vault } = setup();
      expectOk(submit("ledger-double", coordinator));
      expectOk(finalize("ledger-double", member));
      expectAlreadyInUse(finalize("ledger-double", vault, true));
      // The first finalization stands.
      expect(final("ledger-double")!.finalizedBy).toBe(member.publicKey.toBase58());
    });

    it("cannot finalize an attestation that was cancelled", () => {
      const { submit, cancel, finalize, final, coordinator, member } = setup();
      expectOk(submit("ledger-cancelled", coordinator));
      expectOk(cancel("ledger-cancelled", coordinator));
      expectAnchorError(finalize("ledger-cancelled", member), "InvalidState");
      expect(final("ledger-cancelled")).toBeNull();
    });
  });

  describe("cancel_pending", () => {
    it("lets the coordinator cancel a PENDING attestation", () => {
      const { submit, cancel, pending, coordinator } = setup();
      expectOk(submit("ledger-cancel", coordinator));
      expectOk(cancel("ledger-cancel", coordinator));
      expect(pending("ledger-cancel")!.status).toBe(ATTESTATION_CANCELLED);
    });

    it("refuses anyone but a coordinator", () => {
      const { submit, cancel, pending, coordinator, member } = setup();
      expectOk(submit("ledger-cancel-member", coordinator));
      expectAnchorError(cancel("ledger-cancel-member", member), "Unauthorized");
      expect(pending("ledger-cancel-member")!.status).toBe(ATTESTATION_PENDING);
    });

    it("cannot cancel an attestation that is already finalized", () => {
      const { submit, finalize, cancel, pending, coordinator, member } = setup();
      expectOk(submit("ledger-cancel-final", coordinator));
      expectOk(finalize("ledger-cancel-final", member));
      expectAnchorError(cancel("ledger-cancel-final", coordinator), "InvalidState");
      expect(pending("ledger-cancel-final")!.status).toBe(ATTESTATION_FINALIZED);
    });
  });
});
