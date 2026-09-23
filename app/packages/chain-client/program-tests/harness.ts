import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "vitest";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM, type TransactionMetadata } from "litesvm";
import {
  ROLE_COMMITTEE,
  ROLE_COORDINATOR,
  buildCancelPendingIx,
  buildFinalizeAttestationIx,
  buildGrantRoleIx,
  buildInitializeConfigIx,
  buildSubmitAttestationIx,
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
 * Shared LiteSVM harness for the kna-trust-layer program tests: the compiled .so runs
 * inside LiteSVM, and every instruction goes through the same builders the
 * API and web use. These are the guards the unit tests on validate_split
 * cannot reach — signer checks, role checks, pause, and the state machine
 * PENDING → FINALIZED | CANCELLED.
 *
 * Needs `anchor build` first (target/deploy/kna_trust_layer.so), and a
 * Linux or macOS host: LiteSVM ships no Windows binary. On Windows, run
 * scripts/program-tests.ps1, which does both inside Docker.
 */

export const PROGRAM_SO =
  process.env.KNA_PROGRAM_SO ?? resolve(__dirname, "../../../target/deploy/kna_trust_layer.so");

if (!existsSync(PROGRAM_SO)) {
  throw new Error(
    `Program binary not found at ${PROGRAM_SO}. Run \`anchor build\` first, or set KNA_PROGRAM_SO.`
  );
}

export type Result = TransactionMetadata | FailedTransactionMetadata;

/** Compute units per successful instruction, printed at the end (Phase 6 input). */
const computeUnits = new Map<string, bigint[]>();

function record(label: string, res: Result) {
  if (res instanceof FailedTransactionMetadata) return;
  const list = computeUnits.get(label) ?? [];
  list.push(res.computeUnitsConsumed());
  computeUnits.set(label, list);
}

/** Print the compute-unit table; call from each test file's afterAll. */
export function printComputeUnits() {
  const rows = [...computeUnits.entries()].map(([instruction, units]) => ({
    instruction,
    runs: units.length,
    maxCU: Number(units.reduce((a, b) => (b > a ? b : a), 0n)),
  }));
  console.log("Compute units by instruction (LiteSVM):");
  console.table(rows);
}

export function logsOf(res: Result): string {
  const meta = res instanceof FailedTransactionMetadata ? res.meta() : res;
  return meta.logs().join("\n");
}

export function expectOk(res: Result) {
  if (res instanceof FailedTransactionMetadata) {
    throw new Error(`Transaction failed:\n${logsOf(res)}`);
  }
}

/** Fails with the named Anchor error (KnaError variant or Anchor constraint). */
export function expectAnchorError(res: Result, name: string) {
  expect(res, "transaction should have failed").toBeInstanceOf(FailedTransactionMetadata);
  expect(logsOf(res)).toContain(`Error Code: ${name}`);
}

/** Fails because an `init` account already exists — the replay guard. */
export function expectAlreadyInUse(res: Result) {
  expect(res, "transaction should have failed").toBeInstanceOf(FailedTransactionMetadata);
  expect(logsOf(res)).toMatch(/already in use/);
}

export function payloadFor(ledgerId: string, overrides: Partial<LedgerAttestationPayload> = {}) {
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
export function setup() {
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

