import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";
import { KNA_TRUST_PROGRAM_ID, ROLE_COMMITTEE, ROLE_COORDINATOR } from "./constants";
import {
  IX,
  anchorDiscriminator,
  encodeBool,
  encodeI64,
  encodeU64,
  encodeU8,
} from "./codec";
import {
  contentHashBytes,
  hexToBytes,
  ledgerIdHashBytes,
  providerHashBytes,
  type LedgerAttestationPayload,
} from "./canonical";

export function programId(): PublicKey {
  return new PublicKey(KNA_TRUST_PROGRAM_ID);
}

export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId())[0];
}

export function roleGrantPda(wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("role"), wallet.toBuffer()],
    programId()
  )[0];
}

export function pendingPdaFromLedgerId(ledgerId: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pending"), Buffer.from(ledgerIdHashBytes(ledgerId))],
    programId()
  )[0];
}

export function finalPdaFromLedgerId(ledgerId: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("final"), Buffer.from(ledgerIdHashBytes(ledgerId))],
    programId()
  )[0];
}

export function pendingPdaFromHash(ledgerIdHashHex: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pending"), Buffer.from(hexToBytes(ledgerIdHashHex))],
    programId()
  )[0];
}

export function finalPdaFromHash(ledgerIdHashHex: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("final"), Buffer.from(hexToBytes(ledgerIdHashHex))],
    programId()
  )[0];
}

function meta(pubkey: PublicKey, isSigner = false, isWritable = false): AccountMeta {
  return { pubkey, isSigner, isWritable };
}

export function buildInitializeConfigIx(authority: PublicKey, committeeVault: PublicKey) {
  const data = Buffer.concat([
    anchorDiscriminator(IX.initializeConfig),
    committeeVault.toBuffer(),
  ]);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(authority, true, true),
      meta(configPda(), false, true),
      meta(SystemProgram.programId),
    ],
    data,
  });
}

export function buildSetPausedIx(authority: PublicKey, paused: boolean) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [meta(authority, true, false), meta(configPda(), false, true)],
    data: Buffer.concat([anchorDiscriminator(IX.setPaused), encodeBool(paused)]),
  });
}

export function buildSetCommitteeVaultIx(authority: PublicKey, committeeVault: PublicKey) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [meta(authority, true, false), meta(configPda(), false, true)],
    data: Buffer.concat([
      anchorDiscriminator(IX.setCommitteeVault),
      committeeVault.toBuffer(),
    ]),
  });
}

export function buildGrantRoleIx(authority: PublicKey, wallet: PublicKey, role: number) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(authority, true, true),
      meta(configPda()),
      meta(wallet),
      meta(roleGrantPda(wallet), false, true),
      meta(SystemProgram.programId),
    ],
    data: Buffer.concat([anchorDiscriminator(IX.grantRole), encodeU8(role)]),
  });
}

export function buildRevokeRoleIx(authority: PublicKey, wallet: PublicKey) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(authority, true, false),
      meta(configPda()),
      meta(roleGrantPda(wallet), false, true),
    ],
    data: anchorDiscriminator(IX.revokeRole),
  });
}

export function buildGrantCoordinatorIx(authority: PublicKey, wallet: PublicKey) {
  return buildGrantRoleIx(authority, wallet, ROLE_COORDINATOR);
}

export function buildGrantCommitteeIx(authority: PublicKey, wallet: PublicKey) {
  return buildGrantRoleIx(authority, wallet, ROLE_COMMITTEE);
}

export interface SubmitAttestationArgs {
  coordinator: PublicKey;
  ledgerId: string;
  providerLabel: string;
  payload: LedgerAttestationPayload;
  recordedAtUnix: number;
}

export function buildSubmitAttestationIx(args: SubmitAttestationArgs) {
  const ledgerHash = Buffer.from(ledgerIdHashBytes(args.ledgerId));
  const providerHash = Buffer.from(providerHashBytes(args.providerLabel));
  const contentHash = Buffer.from(contentHashBytes(args.payload));
  const pending = pendingPdaFromLedgerId(args.ledgerId);
  const data = Buffer.concat([
    anchorDiscriminator(IX.submitAttestation),
    ledgerHash,
    providerHash,
    contentHash,
    encodeU64(args.payload.totalVnd),
    encodeU64(args.payload.platformFeeVnd),
    encodeU64(args.payload.communityFundVnd),
    encodeU64(args.payload.providerPayoutVnd),
    encodeI64(args.recordedAtUnix),
  ]);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(args.coordinator, true, true),
      meta(configPda()),
      meta(roleGrantPda(args.coordinator)),
      meta(pending, false, true),
      meta(SystemProgram.programId),
    ],
    data,
  });
}

export function buildFinalizeAttestationIx(opts: {
  authority: PublicKey;
  ledgerId: string;
  /** When authority is a committee member (not Squads vault), include role PDA. */
  includeCommitteeRole?: boolean;
}) {
  const pending = pendingPdaFromLedgerId(opts.ledgerId);
  const finalPda = finalPdaFromLedgerId(opts.ledgerId);
  const keys: AccountMeta[] = [
    meta(opts.authority, true, true),
    meta(configPda()),
    meta(pending, false, true),
    meta(finalPda, false, true),
  ];
  if (opts.includeCommitteeRole !== false) {
    keys.push(meta(roleGrantPda(opts.authority)));
  } else {
    // Optional account omitted → pass program id per Anchor optional convention
    keys.push(meta(programId()));
  }
  keys.push(meta(SystemProgram.programId));
  return new TransactionInstruction({
    programId: programId(),
    keys,
    data: anchorDiscriminator(IX.finalizeAttestation),
  });
}

export function buildCancelPendingIx(coordinator: PublicKey, ledgerId: string) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      meta(coordinator, true, false),
      meta(configPda()),
      meta(roleGrantPda(coordinator)),
      meta(pendingPdaFromLedgerId(ledgerId), false, true),
    ],
    data: anchorDiscriminator(IX.cancelPending),
  });
}

export function recordedAtUnixFromIso(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}
