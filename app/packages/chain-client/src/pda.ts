import { address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";
import { KNA_TRUST_PROGRAM_ID } from "./constants";
import { hexToBytes, ledgerIdHashBytes } from "./canonical";

const programAddress = address(KNA_TRUST_PROGRAM_ID);

export async function deriveConfigPda() {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: ["config"],
  });
  return pda;
}

export async function deriveRoleGrantPda(walletBase58: string) {
  const encoder = getAddressEncoder();
  const walletBytes = encoder.encode(address(walletBase58));
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: ["role", walletBytes],
  });
  return pda;
}

export async function derivePendingAttestationPda(ledgerId: string) {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: ["pending", ledgerIdHashBytes(ledgerId)],
  });
  return pda;
}

export async function deriveFinalAttestationPda(ledgerId: string) {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: ["final", ledgerIdHashBytes(ledgerId)],
  });
  return pda;
}

export async function deriveGuestReceiptPda(guestBase58: string, ledgerId: string) {
  const encoder = getAddressEncoder();
  const guestBytes = encoder.encode(address(guestBase58));
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: ["receipt", guestBytes, ledgerIdHashBytes(ledgerId)],
  });
  return pda;
}

export async function deriveArchiveProofPda(archiveIdHashHex: string) {
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: ["archive", hexToBytes(archiveIdHashHex)],
  });
  return pda;
}
