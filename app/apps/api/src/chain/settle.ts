import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createMintToInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import {
  associatedTokenAddress,
  buildCreateAtaIdempotentIx,
  buildSettleSplitIx,
  fetchSettlementRecord,
  fetchTreasury,
} from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { loadChainConfig } from "./config";
import { assertDemoNetwork, loadFunder, loadMint } from "./demo-token";

/**
 * settle_split, driven from the API: once the committee has finalized a
 * booking's attestation, the KNĂ program pays the escrow out in three SPL
 * token transfers — provider, Community Fund (committee vault), platform —
 * for exactly the finalized amounts. The DB records the payout only after
 * the on-chain SettlementRecord has been read back and matches.
 *
 * The settler key must hold ROLE_COORDINATOR on-chain (it vouches for the
 * provider's destination, which the program cannot know). If the escrow was
 * never funded for this booking (confirmed by hand, no VietQR payment), the
 * funder mints the total into escrow in the same transaction.
 */

export class SettlementError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function loadSettler(): Keypair | null {
  const raw = (process.env.KNA_SETTLER_KEYPAIR_B58 ?? process.env.DEMO_FUNDER_KEYPAIR_B58)?.trim();
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    return null;
  }
}

function parseSigs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export async function settleLedgerEntry(ledgerEntryId: string, actorUserId: string | null) {
  const attestation = await prisma.ledgerAttestation.findUnique({
    where: { ledgerEntryId },
    include: {
      ledgerEntry: {
        include: { booking: { include: { listing: { include: { provider: true } } } } },
      },
    },
  });
  if (!attestation || attestation.state !== "FINALIZED") {
    throw new SettlementError("Only a finalized attestation can be settled.", 409);
  }
  if (attestation.settleTxSig) {
    throw new SettlementError("This attestation is already settled.", 409);
  }
  const booking = attestation.ledgerEntry.booking;
  if (!booking) {
    throw new SettlementError("Only booking ledger entries are settled.", 409);
  }

  const settler = loadSettler();
  const mint = loadMint();
  if (!settler || !mint) {
    throw new SettlementError("Settlement is not configured (settler key or DEMO_MINT missing).", 503);
  }

  const chain = loadChainConfig();
  assertDemoNetwork(chain.rpcUrl, chain.cluster);
  if (!chain.committeeVault) {
    throw new SettlementError("KNA_COMMITTEE_VAULT is not configured.", 503);
  }
  const connection = new Connection(chain.rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
  });
  const treasury = await fetchTreasury(connection);
  if (!treasury) {
    throw new SettlementError("The treasury has not been initialised on-chain.", 503);
  }
  if (treasury.mint !== mint.toBase58()) {
    throw new SettlementError("DEMO_MINT does not match the treasury mint.", 503);
  }

  const providerLink = await prisma.walletLink.findUnique({
    where: { userId: booking.listing.provider.userId },
  });
  const providerWalletRaw = providerLink?.pubkey ?? process.env.DEMO_PROVIDER_WALLET?.trim();
  if (!providerWalletRaw) {
    throw new SettlementError("The provider has no linked wallet to be paid into.", 409);
  }
  const providerWallet = new PublicKey(providerWalletRaw);
  const communityWallet = new PublicKey(chain.committeeVault);
  const platformWallet = new PublicKey(treasury.platformWallet);
  const vault = new PublicKey(treasury.vault);

  const escrowSigs = parseSigs(booking.demoTxSigs);
  const signers: Keypair[] = [settler];
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: settler.publicKey, blockhash, lastValidBlockHeight });

  if (escrowSigs.length === 0) {
    const funder = loadFunder();
    if (!funder) {
      throw new SettlementError("Escrow was never funded and no funder key is configured.", 503);
    }
    tx.add(
      createMintToInstruction(
        mint,
        vault,
        funder.publicKey,
        BigInt(booking.totalVnd) * treasury.unitsPerVnd,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    if (!funder.publicKey.equals(settler.publicKey)) signers.push(funder);
  }

  for (const owner of [providerWallet, communityWallet, platformWallet]) {
    tx.add(buildCreateAtaIdempotentIx(settler.publicKey, owner, mint));
  }
  const providerToken = associatedTokenAddress(mint, providerWallet);
  tx.add(
    buildSettleSplitIx({
      settler: settler.publicKey,
      ledgerId: ledgerEntryId,
      mint,
      vault,
      providerToken,
      communityToken: associatedTokenAddress(mint, communityWallet),
      platformToken: associatedTokenAddress(mint, platformWallet),
    })
  );

  let settleTxSig: string;
  try {
    settleTxSig = await connection.sendTransaction(tx, signers, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(
      { signature: settleTxSig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "settle_split failed";
    await prisma.ledgerAttestation.update({
      where: { ledgerEntryId },
      data: { settleError: message },
    });
    throw new SettlementError(message);
  }

  // Believe the chain, not the send: read the record back and compare.
  const entry = attestation.ledgerEntry;
  const providerVnd = entry.totalVnd - entry.platformFeeVnd - entry.communityFundVnd;
  const record = await fetchSettlementRecord(connection, ledgerEntryId);
  if (
    !record ||
    record.account.providerVnd !== providerVnd ||
    record.account.communityVnd !== entry.communityFundVnd ||
    record.account.platformVnd !== entry.platformFeeVnd ||
    record.account.providerToken !== providerToken.toBase58()
  ) {
    const message = "Settlement record on-chain does not match the ledger entry.";
    await prisma.ledgerAttestation.update({ where: { ledgerEntryId }, data: { settleError: message } });
    throw new SettlementError(message);
  }

  const [updated] = await prisma.$transaction([
    prisma.ledgerAttestation.update({
      where: { ledgerEntryId },
      data: { settleTxSig, settledAt: new Date(), settleError: null },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        demoTxSigs: JSON.stringify([...escrowSigs, settleTxSig]),
        demoDisburseAt: new Date(),
      },
    }),
    prisma.chainAuditLog.create({
      data: {
        actorUserId,
        action: "SETTLE_SPLIT",
        ledgerEntryId,
        detail: `${settleTxSig} · ${record.address}`,
      },
    }),
  ]);
  return updated;
}

/** After a finalize: settle if configured, never failing the finalize itself. */
export async function settleAfterFinalize(ledgerEntryId: string, actorUserId: string | null) {
  try {
    const updated = await settleLedgerEntry(ledgerEntryId, actorUserId);
    return { ok: true as const, settleTxSig: updated.settleTxSig };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Settlement failed";
    if (!(err instanceof SettlementError) || err.status !== 503) {
      console.error("[settle]", ledgerEntryId, message);
    }
    return { ok: false as const, error: message };
  }
}
