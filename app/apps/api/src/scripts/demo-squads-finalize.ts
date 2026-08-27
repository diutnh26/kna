import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as sqds from "@sqds/multisig";
import {
  buildFinalizeAttestationIx,
  fetchFinalAttestation,
  finalPdaFromLedgerId,
  KNA_TRUST_PROGRAM_ID,
} from "@kna/chain-client";

const root = path.resolve(__dirname, "../../../../../");
const secrets = path.join(root, "secrets");
const docsDir = path.join(root, "docs");
const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const squadsPath = path.join(secrets, "squads-devnet.json");
const evidencePath = path.join(secrets, "devnet-evidence.json");
const publicEvidencePath = path.join(docsDir, "DEVNET-EVIDENCE.json");

function readKeypair(name: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(secrets, name), "utf8")))
  );
}

async function main() {
  const confirm = async (sig: string | null) => {
    if (!sig) return;
    await connection.confirmTransaction(sig, "confirmed");
  };

  if (!fs.existsSync(squadsPath)) {
    throw new Error("Missing secrets/squads-devnet.json. Run setup-squads-vault.ts first.");
  }
  if (!fs.existsSync(evidencePath)) {
    throw new Error("Missing secrets/devnet-evidence.json. Run submit flow first.");
  }

  const connection = new Connection(rpc, "confirmed");
  const committee1 = readKeypair("committee-1-keypair.json");
  const committee2 = readKeypair("committee-2-keypair.json");
  const deploy = readKeypair("deploy-keypair.json");

  const squads = JSON.parse(fs.readFileSync(squadsPath, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const ledgerId = evidence.demoSubmit?.ledgerId;
  if (!ledgerId) {
    throw new Error("No demoSubmit.ledgerId found in devnet evidence.");
  }

  const multisigPda = new PublicKey(squads.multisigPda);
  const vaultPda = new PublicKey(squads.vaultPda);
  const multisigAccount = await sqds.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  const currentTransactionIndex = BigInt(multisigAccount.transactionIndex.toString());

  const finalizeIx = buildFinalizeAttestationIx({
    authority: vaultPda,
    ledgerId,
    includeCommitteeRole: false,
  });
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const innerMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: blockhash,
    instructions: [finalizeIx],
  });

  let transactionIndex = currentTransactionIndex + 1n;
  let vaultCreateSig: string | null = null;
  const existingTxPda = sqds.getTransactionPda({
    multisigPda,
    index: currentTransactionIndex,
  })[0];
  const existingTxInfo = currentTransactionIndex > 0n
    ? await connection.getAccountInfo(existingTxPda)
    : null;
  const existingProposalPda = currentTransactionIndex > 0n
    ? sqds.getProposalPda({ multisigPda, transactionIndex: currentTransactionIndex })[0]
    : null;
  const existingProposalInfo =
    existingProposalPda && currentTransactionIndex > 0n
      ? await connection.getAccountInfo(existingProposalPda)
      : null;

  if (existingTxInfo && !existingProposalInfo) {
    transactionIndex = currentTransactionIndex;
  } else {
    vaultCreateSig = await sqds.rpc.vaultTransactionCreate({
      connection,
      feePayer: committee1,
      multisigPda,
      transactionIndex,
      creator: committee1.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: innerMessage,
    });
    await confirm(vaultCreateSig);
  }

  const proposalPda = sqds.getProposalPda({ multisigPda, transactionIndex })[0];
  let proposalInfo = await connection.getAccountInfo(proposalPda);
  let proposalCreateSig: string | null = null;
  if (!proposalInfo) {
    proposalCreateSig = await sqds.rpc.proposalCreate({
      connection,
      feePayer: committee1,
      creator: committee1,
      multisigPda,
      transactionIndex,
      isDraft: false,
    });
    await confirm(proposalCreateSig);
    proposalInfo = await connection.getAccountInfo(proposalPda);
  }

  const proposal = proposalInfo
    ? await sqds.accounts.Proposal.fromAccountAddress(connection, proposalPda)
    : null;
  const approvedSet = new Set((proposal?.approved ?? []).map((pk) => pk.toBase58()));

  const approvalSigs: string[] = [];
  if (!approvedSet.has(committee1.publicKey.toBase58())) {
    const sig = await sqds.rpc.proposalApprove({
      connection,
      feePayer: committee1,
      member: committee1,
      multisigPda,
      transactionIndex,
    });
    approvalSigs.push(sig);
    await confirm(sig);
  }
  if (!approvedSet.has(committee2.publicKey.toBase58())) {
    const secondApproveSig = await sqds.rpc.proposalApprove({
      connection,
      feePayer: committee2,
      member: committee2,
      multisigPda,
      transactionIndex,
    });
    approvalSigs.push(secondApproveSig);
    await confirm(secondApproveSig);
  }

  const vaultBalance = await connection.getBalance(vaultPda);
  let fundVaultSig: string | null = null;
  if (vaultBalance < Math.floor(0.02 * LAMPORTS_PER_SOL)) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: deploy.publicKey,
        toPubkey: vaultPda,
        lamports: Math.floor(0.05 * LAMPORTS_PER_SOL),
      })
    );
    fundVaultSig = await sendAndConfirmTransaction(connection, tx, [deploy], {
      commitment: "confirmed",
    });
  }

  const executeSig = await sqds.rpc.vaultTransactionExecute({
    connection,
    feePayer: committee1,
    multisigPda,
    transactionIndex,
    member: committee1.publicKey,
    signers: [committee1],
  });
  await confirm(executeSig);

  const finalPda = finalPdaFromLedgerId(ledgerId).toBase58();
  const final = await fetchFinalAttestation(connection, ledgerId);
  if (!final) {
    throw new Error("Final PDA not found after Squads execution.");
  }

  evidence.committeeVault = vaultPda.toBase58();
  evidence.squads = {
    multisigPda: multisigPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    transactionIndex: transactionIndex.toString(),
    vaultCreateSig,
    proposalCreateSig,
    approvalSigs,
    fundVaultSig,
    executeSig,
    explorerMultisig: `https://explorer.solana.com/address/${multisigPda.toBase58()}?cluster=devnet`,
    explorerVault: `https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet`,
    explorerExecuteTx: `https://explorer.solana.com/tx/${executeSig}?cluster=devnet`,
    at: new Date().toISOString(),
  };
  evidence.demoFinalize = {
    ledgerId,
    finalPda,
    txSignature: executeSig,
    explorerTx: `https://explorer.solana.com/tx/${executeSig}?cluster=devnet`,
    explorerPda: `https://explorer.solana.com/address/${finalPda}?cluster=devnet`,
    explorerVault: `https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet`,
    programId: KNA_TRUST_PROGRAM_ID,
    note: "Executed by Squads v4 vault after 2-of-3 committee approvals; API should record this signature via /chain/ledger/:id/finalize.",
    finalizedBy: vaultPda.toBase58(),
    at: new Date().toISOString(),
    finalAccountVerified: final.address,
  };

  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  fs.writeFileSync(publicEvidencePath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ squads: evidence.squads, demoFinalize: evidence.demoFinalize }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
