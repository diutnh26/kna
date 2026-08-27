import { Router } from "express";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import {
  explorerAccountUrl,
  explorerTxUrl,
  finalPdaFromLedgerId,
  isLikelyFakeSignature,
  pendingPdaFromLedgerId,
} from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  requireCoordinator,
  requireCommittee,
  type AuthedRequest,
} from "../middleware/auth";
import { getChainGateway } from "../chain/gateway";
import { loadChainConfig } from "../chain/config";
import { recomputeAndVerifySettled } from "../chain/outbox";

export const chainRouter = Router();

function verifiedExplorer(cluster: "devnet" | "localnet", sig: string | null | undefined) {
  if (!sig || isLikelyFakeSignature(sig)) return null;
  return explorerTxUrl(cluster, sig);
}

chainRouter.get("/status", async (_req, res) => {
  const gateway = getChainGateway();
  const status = gateway.status();
  let programDeployed: boolean | null = null;
  if (status.enabled) {
    try {
      const info = await gateway.connection().getAccountInfo(new PublicKey(status.programId));
      programDeployed = Boolean(info?.executable);
    } catch {
      programDeployed = false;
    }
  }
  res.json({ ...status, programDeployed });
});

chainRouter.get("/ledger/:id", async (req, res) => {
  const attestation = await prisma.ledgerAttestation.findFirst({
    where: { ledgerEntryId: req.params.id },
    include: { ledgerEntry: true },
  });
  if (!attestation) {
    return res.status(404).json({ error: "No attestation for that ledger entry." });
  }
  const config = loadChainConfig();
  const verified =
    attestation.state === "AWAITING_COMMITTEE" ||
    attestation.state === "FINALIZED" ||
    attestation.state === "SUBMITTED";
  res.json({
    ...attestation,
    slot: attestation.slot?.toString() ?? null,
    verified,
    explorer: {
      pending: verifiedExplorer(config.cluster, attestation.pendingTxSig),
      finalize: verifiedExplorer(config.cluster, attestation.finalizeTxSig),
      pendingPda: attestation.pendingPda
        ? explorerAccountUrl(config.cluster, attestation.pendingPda)
        : null,
      finalPda: attestation.finalPda
        ? explorerAccountUrl(config.cluster, attestation.finalPda)
        : null,
    },
  });
});

chainRouter.get("/awaiting-committee", requireAuth, requireCommittee, async (_req, res) => {
  const rows = await prisma.ledgerAttestation.findMany({
    where: { state: "AWAITING_COMMITTEE" },
    include: { ledgerEntry: true },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });
  res.json(
    rows.map((row) => ({
      ledgerEntryId: row.ledgerEntryId,
      payloadHash: row.payloadHash,
      pendingPda: row.pendingPda,
      pendingTxSig: row.pendingTxSig,
      totalVnd: row.ledgerEntry.totalVnd,
      platformFeeVnd: row.ledgerEntry.platformFeeVnd,
      communityFundVnd: row.ledgerEntry.communityFundVnd,
      toLabel: row.ledgerEntry.toLabel,
      finalPda: finalPdaFromLedgerId(row.ledgerEntryId).toBase58(),
    }))
  );
});

chainRouter.post(
  "/ledger/:id/prepare",
  requireAuth,
  requireCoordinator,
  async (req: AuthedRequest, res) => {
    const gateway = getChainGateway();
    if (!gateway.isEnabled()) {
      return res.status(503).json({ error: "Solana trust layer is disabled." });
    }
    const body = z
      .object({ coordinatorPubkey: z.string().min(32).max(64) })
      .safeParse(req.body ?? {});
    if (!body.success) {
      return res.status(400).json({ error: "coordinatorPubkey is required." });
    }
    try {
      new PublicKey(body.data.coordinatorPubkey);
    } catch {
      return res.status(400).json({ error: "Invalid coordinatorPubkey." });
    }

    const { entry, hash, payload } = await recomputeAndVerifySettled(req.params.id);
    const prepared = await gateway.prepareSubmitTransaction({
      ledgerEntryId: entry.id,
      coordinatorPubkey: body.data.coordinatorPubkey,
      providerLabel: entry.toLabel,
      payload,
      payloadHash: hash,
    });

    await prisma.ledgerAttestation.upsert({
      where: { ledgerEntryId: entry.id },
      create: {
        ledgerEntryId: entry.id,
        payloadHash: hash,
        pendingPda: prepared.pendingPda,
        state: "PENDING_SIGNATURE",
        cluster: prepared.cluster,
        programId: prepared.programId,
        payloadVersion: 1,
      },
      update: {
        pendingPda: prepared.pendingPda,
        payloadHash: hash,
        state: "PENDING_SIGNATURE",
        lastError: null,
        cluster: prepared.cluster,
        programId: prepared.programId,
        payloadVersion: 1,
      },
    });

    res.json(prepared);
  }
);

const submitSchema = z.object({
  pendingTxSig: z.string().min(64),
  coordinatorPubkey: z.string().min(32).max(64).optional(),
});

chainRouter.post(
  "/ledger/:id/submit",
  requireAuth,
  requireCoordinator,
  async (req: AuthedRequest, res) => {
    const gateway = getChainGateway();
    if (!gateway.isEnabled()) {
      return res.status(503).json({ error: "Solana trust layer is disabled." });
    }
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "pendingTxSig is required." });
    }
    if (isLikelyFakeSignature(parsed.data.pendingTxSig)) {
      return res.status(400).json({ error: "Fake/mock signatures are rejected." });
    }

    const { entry, hash, payload } = await recomputeAndVerifySettled(req.params.id);
    const expectedPda = pendingPdaFromLedgerId(entry.id).toBase58();
    try {
      const verified = await gateway.verifyPendingSubmission({
        ledgerEntryId: entry.id,
        pendingTxSig: parsed.data.pendingTxSig,
        providerLabel: entry.toLabel,
        payload,
        expectedCoordinator: parsed.data.coordinatorPubkey,
      });
      if (verified.pendingPda !== expectedPda) {
        return res.status(400).json({ error: "Derived pending PDA mismatch." });
      }
      const updated = await prisma.ledgerAttestation.update({
        where: { ledgerEntryId: req.params.id },
        data: {
          pendingTxSig: verified.pendingTxSig,
          pendingPda: verified.pendingPda,
          payloadHash: hash,
          state: "AWAITING_COMMITTEE",
          slot: verified.slot ?? null,
          verifiedAt: verified.verifiedAt ? new Date(verified.verifiedAt) : new Date(),
          lastError: null,
          cluster: loadChainConfig().cluster,
          programId: loadChainConfig().programId,
        },
      });
      await prisma.chainOutbox.updateMany({
        where: { idempotencyKey: `ledger:${req.params.id}:settled` },
        data: { status: "AWAITING_COMMITTEE", lastError: null },
      });
      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submit verification failed";
      await prisma.ledgerAttestation.updateMany({
        where: { ledgerEntryId: req.params.id },
        data: { lastError: message, state: "RETRYABLE" },
      });
      return res.status(400).json({ error: message });
    }
  }
);

const finalizeSchema = z.object({
  finalizeTxSig: z.string().min(64),
});

chainRouter.post(
  "/ledger/:id/finalize",
  requireAuth,
  requireCommittee,
  async (req: AuthedRequest, res) => {
    const gateway = getChainGateway();
    if (!gateway.isEnabled()) {
      return res.status(503).json({ error: "Solana trust layer is disabled." });
    }
    const parsed = finalizeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "finalizeTxSig is required." });
    }
    if (isLikelyFakeSignature(parsed.data.finalizeTxSig)) {
      return res.status(400).json({ error: "Fake/mock signatures are rejected." });
    }

    const { entry, hash, payload } = await recomputeAndVerifySettled(req.params.id);
    const expectedFinal = finalPdaFromLedgerId(entry.id).toBase58();
    try {
      const verified = await gateway.verifyFinalize({
        ledgerEntryId: entry.id,
        finalizeTxSig: parsed.data.finalizeTxSig,
        providerLabel: entry.toLabel,
        payload,
      });
      if (verified.finalPda !== expectedFinal) {
        return res.status(400).json({ error: "Derived final PDA mismatch." });
      }
      const updated = await prisma.ledgerAttestation.update({
        where: { ledgerEntryId: req.params.id },
        data: {
          finalizeTxSig: verified.finalizeTxSig,
          finalPda: verified.finalPda,
          payloadHash: hash,
          slot: verified.slot ?? null,
          state: "FINALIZED",
          verifiedAt: verified.verifiedAt ? new Date(verified.verifiedAt) : new Date(),
          lastError: null,
        },
      });
      await prisma.chainOutbox.updateMany({
        where: { idempotencyKey: `ledger:${req.params.id}:settled` },
        data: { status: "FINALIZED", lastError: null },
      });
      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Finalize verification failed";
      return res.status(400).json({ error: message });
    }
  }
);

chainRouter.post(
  "/ledger/:id/reconcile",
  requireAuth,
  requireCoordinator,
  async (req: AuthedRequest, res) => {
    const gateway = getChainGateway();
    if (!gateway.isEnabled()) {
      return res.status(503).json({ error: "Solana trust layer is disabled." });
    }
    const { entry, hash, payload } = await recomputeAndVerifySettled(req.params.id);
    try {
      const result = await gateway.reconcileLedger({
        ledgerEntryId: entry.id,
        providerLabel: entry.toLabel,
        payload,
      });
      let state = "PENDING_SIGNATURE";
      if (result.hasFinal) state = "FINALIZED";
      else if (result.hasPending) state = "AWAITING_COMMITTEE";

      const updated = await prisma.ledgerAttestation.upsert({
        where: { ledgerEntryId: entry.id },
        create: {
          ledgerEntryId: entry.id,
          payloadHash: hash,
          pendingPda: result.pendingPda,
          finalPda: result.hasFinal ? result.finalPda : null,
          state,
        },
        update: {
          payloadHash: hash,
          pendingPda: result.pendingPda,
          finalPda: result.hasFinal ? result.finalPda : undefined,
          state,
          lastError: null,
          verifiedAt: new Date(),
        },
      });
      res.json({ attestation: updated, chain: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reconcile failed";
      return res.status(400).json({ error: message });
    }
  }
);

chainRouter.post(
  "/ledger/:id/retry",
  requireAuth,
  requireCoordinator,
  async (req: AuthedRequest, res) => {
    await prisma.chainOutbox.updateMany({
      where: { idempotencyKey: `ledger:${req.params.id}:settled` },
      data: { status: "PENDING", attempts: 0, lastError: null, leaseUntil: null },
    });
    await prisma.ledgerAttestation.updateMany({
      where: { ledgerEntryId: req.params.id },
      data: {
        state: "PENDING_SIGNATURE",
        lastError: null,
        pendingTxSig: null,
        finalizeTxSig: null,
        verifiedAt: null,
      },
    });
    await prisma.chainAuditLog.create({
      data: {
        actorUserId: req.user!.id,
        action: "RETRY_ATTESTATION",
        ledgerEntryId: req.params.id,
        detail: "Coordinator requested outbox retry",
      },
    });
    res.json({ ok: true });
  }
);

chainRouter.get("/ledger/:id/finalize-ix", requireAuth, requireCommittee, async (req, res) => {
  const gateway = getChainGateway();
  if (!gateway.isEnabled()) {
    return res.status(503).json({ error: "Solana trust layer is disabled." });
  }
  const config = loadChainConfig();
  const authority = String(req.query.authority ?? config.committeeVault ?? "");
  if (!authority) {
    return res.status(400).json({ error: "authority query or KNA_COMMITTEE_VAULT required" });
  }
  const includeCommitteeRole = authority !== config.committeeVault;
  const ix = gateway.buildFinalizeInstruction(authority, req.params.id, includeCommitteeRole);
  res.json({
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((k) => ({
      pubkey: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    dataBase64: Buffer.from(ix.data).toString("base64"),
    finalPda: finalPdaFromLedgerId(req.params.id).toBase58(),
    pendingPda: pendingPdaFromLedgerId(req.params.id).toBase58(),
    note: includeCommitteeRole
      ? "Committee member path — include role PDA"
      : "Squads vault path — optional committee role omitted",
  });
});

/** Squads v4 proposal helper — returns finalize ix + vault checks for 2-of-3 flow. */
chainRouter.get("/ledger/:id/squads-proposal", requireAuth, requireCommittee, async (req, res) => {
  const gateway = getChainGateway();
  if (!gateway.isEnabled()) {
    return res.status(503).json({ error: "Solana trust layer is disabled." });
  }
  try {
    const { assertVaultMatchesMultisig, buildFinalizeForVault } = await import("../chain/squads");
    const multisigPda = String(req.query.multisigPda ?? "");
    const built = buildFinalizeForVault(req.params.id);
    const vaultCheck = multisigPda ? assertVaultMatchesMultisig(multisigPda) : null;
    res.json({
      ...built,
      vaultCheck,
      pendingPda: pendingPdaFromLedgerId(req.params.id).toBase58(),
      instruction: {
        programId: built.instruction.programId.toBase58(),
        dataBase64: Buffer.from(built.instruction.data).toString("base64"),
        keys: built.instruction.keys.map((k) => ({
          pubkey: k.pubkey.toBase58(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
      },
      explorer: {
        vault: explorerAccountUrl(loadChainConfig().cluster, built.vault),
        finalPda: explorerAccountUrl(loadChainConfig().cluster, built.finalPda),
        pendingPda: explorerAccountUrl(
          loadChainConfig().cluster,
          pendingPdaFromLedgerId(req.params.id).toBase58()
        ),
        multisig: vaultCheck?.multisigPda
          ? explorerAccountUrl(loadChainConfig().cluster, vaultCheck.multisigPda)
          : null,
      },
      docs: "See docs/SQUADS-SETUP.md — create vault tx → create proposal → 2-of-3 approve → execute → POST /finalize with executed sig",
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
