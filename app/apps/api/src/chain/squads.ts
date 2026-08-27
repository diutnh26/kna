/**
 * Squads v4 helpers for committee finalize (2-of-3).
 * Primary path: export KNĂ finalize_attestation ix for Squads UI / @sqds/multisig proposal.
 */
import * as multisig from "@sqds/multisig";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  buildFinalizeAttestationIx,
  finalPdaFromLedgerId,
} from "@kna/chain-client";
import { loadChainConfig } from "./config";

export function getCommitteeVault(): PublicKey | null {
  const { committeeVault } = loadChainConfig();
  if (!committeeVault) return null;
  return new PublicKey(committeeVault);
}

/** Build the KNĂ finalize instruction keyed to the Squads vault as authority. */
export function buildFinalizeForVault(ledgerId: string): {
  instruction: TransactionInstruction;
  finalPda: string;
  vault: string;
} {
  const vault = getCommitteeVault();
  if (!vault) {
    throw new Error("KNA_COMMITTEE_VAULT is not configured");
  }
  const instruction = buildFinalizeAttestationIx({
    authority: vault,
    ledgerId,
    includeCommitteeRole: false,
  });
  return {
    instruction,
    finalPda: finalPdaFromLedgerId(ledgerId).toBase58(),
    vault: vault.toBase58(),
  };
}

/**
 * Validate that configured vault matches Squads multisig vault PDA (index 0).
 */
export function assertVaultMatchesMultisig(multisigPda: string): {
  multisigPda: string;
  vault: string;
} {
  const configured = getCommitteeVault();
  if (!configured) {
    throw new Error("KNA_COMMITTEE_VAULT is not configured");
  }
  const ms = new PublicKey(multisigPda);
  const vaultPda = multisig.getVaultPda({
    multisigPda: ms,
    index: 0,
  })[0];
  if (!vaultPda.equals(configured)) {
    throw new Error(
      `KNA_COMMITTEE_VAULT (${configured.toBase58()}) != Squads vault PDA (${vaultPda.toBase58()})`
    );
  }
  return { multisigPda: ms.toBase58(), vault: vaultPda.toBase58() };
}

export { multisig };
