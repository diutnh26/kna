import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  ATTESTATION_CANCELLED,
  assertFinalMatchesPayload,
  assertPendingMatchesPayload,
  assertProgramDeployed,
  buildCancelPendingIx,
  buildSubmitAttestationIx,
  buildFinalizeAttestationIx,
  confirmSignature,
  contentHashFromPayload,
  fetchFinalAttestation,
  fetchPendingAttestation,
  finalPdaFromLedgerId,
  isLikelyFakeSignature,
  pendingPdaFromLedgerId,
  recordedAtUnixFromIso,
  serializeTransactionBase64,
  type LedgerAttestationPayload,
} from "@kna/chain-client";
import { loadChainConfig } from "./config";

export interface SubmitAttestationResult {
  pendingPda: string;
  pendingTxSig: string;
  payloadHash: string;
  slot?: number;
  verifiedAt?: string;
}

export interface FinalizeAttestationResult {
  finalPda: string;
  finalizeTxSig: string;
  slot?: number;
  verifiedAt?: string;
}

export interface PreparedSubmitTx {
  ledgerEntryId: string;
  pendingPda: string;
  payloadHash: string;
  payload: LedgerAttestationPayload;
  providerLabel: string;
  recordedAtUnix: number;
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  programId: string;
  cluster: string;
}

/** Gateway seam — real RPC submission + verification for Track 2. */
export class ChainGateway {
  private config = loadChainConfig();

  connection(): Connection {
    return new Connection(this.config.rpcUrl, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60_000,
    });
  }

  isEnabled() {
    return this.config.enabled;
  }

  status() {
    return {
      enabled: this.config.enabled,
      cluster: this.config.cluster,
      programId: this.config.programId,
      committeeVault: this.config.committeeVault || null,
      rpcUrl: this.config.rpcUrl.replace(/api-key=[^&]+/, "api-key=***"),
    };
  }

  async preparePendingPda(ledgerId: string): Promise<string> {
    return pendingPdaFromLedgerId(ledgerId).toBase58();
  }

  async prepareSubmitTransaction(opts: {
    ledgerEntryId: string;
    coordinatorPubkey: string;
    providerLabel: string;
    payload: LedgerAttestationPayload;
    payloadHash: string;
  }): Promise<PreparedSubmitTx> {
    if (!this.isEnabled()) {
      throw new Error("Solana trust layer is disabled");
    }
    const connection = this.connection();
    await assertProgramDeployed(connection);
    const coordinator = new PublicKey(opts.coordinatorPubkey);
    const recordedAtUnix = recordedAtUnixFromIso(opts.payload.recordedAtIso);
    const ix = buildSubmitAttestationIx({
      coordinator,
      ledgerId: opts.ledgerEntryId,
      providerLabel: opts.providerLabel,
      payload: opts.payload,
      recordedAtUnix,
    });
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({
      feePayer: coordinator,
      blockhash,
      lastValidBlockHeight,
    }).add(ix);
    const pendingPda = pendingPdaFromLedgerId(opts.ledgerEntryId).toBase58();
    return {
      ledgerEntryId: opts.ledgerEntryId,
      pendingPda,
      payloadHash: opts.payloadHash,
      payload: opts.payload,
      providerLabel: opts.providerLabel,
      recordedAtUnix,
      transactionBase64: serializeTransactionBase64(transaction),
      recentBlockhash: blockhash,
      lastValidBlockHeight,
      programId: this.config.programId,
      cluster: this.config.cluster,
    };
  }

  async verifyPendingSubmission(opts: {
    ledgerEntryId: string;
    pendingTxSig: string;
    providerLabel: string;
    payload: LedgerAttestationPayload;
    expectedCoordinator?: string;
  }): Promise<SubmitAttestationResult> {
    if (isLikelyFakeSignature(opts.pendingTxSig)) {
      throw new Error("Rejected fake/mock transaction signature");
    }
    const connection = this.connection();
    await confirmSignature(connection, opts.pendingTxSig, "confirmed");
    const pending = await fetchPendingAttestation(connection, opts.ledgerEntryId);
    if (!pending) {
      throw new Error("Pending attestation PDA not found after confirmed tx");
    }
    assertPendingMatchesPayload(
      pending.account,
      opts.payload,
      opts.providerLabel,
      opts.expectedCoordinator
    );
    const slot = await connection.getSlot("confirmed");
    return {
      pendingPda: pending.address,
      pendingTxSig: opts.pendingTxSig,
      payloadHash: contentHashFromPayload(opts.payload),
      slot,
      verifiedAt: new Date().toISOString(),
    };
  }

  /** An unsigned cancel_pending transaction for the coordinator to sign in Phantom. */
  async prepareCancelTransaction(opts: { ledgerEntryId: string; coordinatorPubkey: string }) {
    if (!this.isEnabled()) {
      throw new Error("Solana trust layer is disabled");
    }
    const connection = this.connection();
    await assertProgramDeployed(connection);
    const coordinator = new PublicKey(opts.coordinatorPubkey);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({
      feePayer: coordinator,
      blockhash,
      lastValidBlockHeight,
    }).add(buildCancelPendingIx(coordinator, opts.ledgerEntryId));
    return {
      ledgerEntryId: opts.ledgerEntryId,
      pendingPda: pendingPdaFromLedgerId(opts.ledgerEntryId).toBase58(),
      transactionBase64: serializeTransactionBase64(transaction),
      recentBlockhash: blockhash,
      lastValidBlockHeight,
      programId: this.config.programId,
      cluster: this.config.cluster,
    };
  }

  /** Confirmed on RPC and the pending PDA now reads CANCELLED — nothing less. */
  async verifyCancel(opts: { ledgerEntryId: string; cancelTxSig: string }) {
    if (isLikelyFakeSignature(opts.cancelTxSig)) {
      throw new Error("Rejected fake/mock transaction signature");
    }
    const connection = this.connection();
    await confirmSignature(connection, opts.cancelTxSig, "confirmed");
    const pending = await fetchPendingAttestation(connection, opts.ledgerEntryId);
    if (!pending) {
      throw new Error("Pending attestation PDA not found after confirmed tx");
    }
    if (pending.account.status !== ATTESTATION_CANCELLED) {
      throw new Error("Pending attestation is not cancelled on-chain");
    }
    return {
      pendingPda: pending.address,
      cancelTxSig: opts.cancelTxSig,
      slot: await connection.getSlot("confirmed"),
      verifiedAt: new Date().toISOString(),
    };
  }

  async verifyFinalize(opts: {
    ledgerEntryId: string;
    finalizeTxSig: string;
    providerLabel: string;
    payload: LedgerAttestationPayload;
  }): Promise<FinalizeAttestationResult> {
    if (isLikelyFakeSignature(opts.finalizeTxSig)) {
      throw new Error("Rejected fake/mock finalize signature");
    }
    const connection = this.connection();
    await confirmSignature(connection, opts.finalizeTxSig, "confirmed");
    const final = await fetchFinalAttestation(connection, opts.ledgerEntryId);
    if (!final) {
      throw new Error("Final attestation PDA not found after confirmed tx");
    }
    assertFinalMatchesPayload(final.account, opts.payload, opts.providerLabel);
    const slot = await connection.getSlot("confirmed");
    return {
      finalPda: final.address,
      finalizeTxSig: opts.finalizeTxSig,
      slot,
      verifiedAt: new Date().toISOString(),
    };
  }

  async reconcileLedger(opts: {
    ledgerEntryId: string;
    providerLabel: string;
    payload: LedgerAttestationPayload;
  }) {
    const connection = this.connection();
    const pending = await fetchPendingAttestation(connection, opts.ledgerEntryId);
    const final = await fetchFinalAttestation(connection, opts.ledgerEntryId);
    if (pending) {
      assertPendingMatchesPayload(pending.account, opts.payload, opts.providerLabel);
    }
    if (final) {
      assertFinalMatchesPayload(final.account, opts.payload, opts.providerLabel);
    }
    return {
      pendingPda: pending?.address ?? pendingPdaFromLedgerId(opts.ledgerEntryId).toBase58(),
      finalPda: final?.address ?? finalPdaFromLedgerId(opts.ledgerEntryId).toBase58(),
      hasPending: Boolean(pending),
      hasFinal: Boolean(final),
      pendingStatus: pending?.account.status ?? null,
    };
  }

  buildFinalizeInstruction(authority: string, ledgerId: string, includeCommitteeRole: boolean) {
    return buildFinalizeAttestationIx({
      authority: new PublicKey(authority),
      ledgerId,
      includeCommitteeRole,
    });
  }
}

let gateway: ChainGateway | null = null;

export function getChainGateway() {
  if (!gateway) gateway = new ChainGateway();
  return gateway;
}

export function resetChainGatewayForTests() {
  gateway = null;
}
