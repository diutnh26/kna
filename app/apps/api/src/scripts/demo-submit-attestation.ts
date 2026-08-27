/**
 * Submit one demo pending attestation on devnet for Track 2 evidence.
 * Run from apps/api: npx tsx src/scripts/demo-submit-attestation.ts
 */
import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  buildSubmitAttestationIx,
  contentHashFromPayload,
  hashProviderLabel,
  pendingPdaFromLedgerId,
  recordedAtUnixFromIso,
  type LedgerAttestationPayload,
  KNA_TRUST_PROGRAM_ID,
} from "@kna/chain-client";

const root = path.resolve(__dirname, "../../../../../");
const secrets = path.join(root, "secrets");
const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const coordinator = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(path.join(secrets, "coordinator-keypair.json"), "utf8"))
  )
);

const ledgerId = `demo-ledger-${Date.now()}`;
const providerLabel = "Ho Gia Demo";
const recordedAtIso = new Date().toISOString();
const payload: LedgerAttestationPayload = {
  ledgerId,
  providerLabelHash: hashProviderLabel(providerLabel),
  totalVnd: 1_000_000,
  platformFeeVnd: 70_000,
  communityFundVnd: 30_000,
  providerPayoutVnd: 900_000,
  recordedAtIso,
  kind: "booking",
};

async function main() {
  const connection = new Connection(rpc, "confirmed");
  const bal = await connection.getBalance(coordinator.publicKey);
  console.log("coordinator balance lamports", bal);
  if (bal < 50_000_000) {
    // Fund from deploy wallet (has SOL) instead of faucet
    const deploy = Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(fs.readFileSync(path.join(secrets, "deploy-keypair.json"), "utf8"))
      )
    );
    const {
      SystemProgram,
      sendAndConfirmTransaction: send,
      Transaction: Tx,
      LAMPORTS_PER_SOL,
    } = await import("@solana/web3.js");
    const fund = new Tx().add(
      SystemProgram.transfer({
        fromPubkey: deploy.publicKey,
        toPubkey: coordinator.publicKey,
        lamports: Math.floor(0.2 * LAMPORTS_PER_SOL),
      })
    );
    const fundSig = await send(connection, fund, [deploy], { commitment: "confirmed" });
    console.log("funded coordinator", fundSig);
  }

  const ix = buildSubmitAttestationIx({
    coordinator: coordinator.publicKey,
    ledgerId,
    providerLabel,
    payload,
    recordedAtUnix: recordedAtUnixFromIso(recordedAtIso),
  });
  const pendingPda = pendingPdaFromLedgerId(ledgerId);
  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [coordinator], {
    commitment: "confirmed",
  });

  const evidencePath = path.join(secrets, "devnet-evidence.json");
  const publicPath = path.join(root, "docs", "DEVNET-EVIDENCE.json");
  const prev = fs.existsSync(evidencePath)
    ? JSON.parse(fs.readFileSync(evidencePath, "utf8"))
    : {};
  const next = {
    ...prev,
    demoSubmit: {
      ledgerId,
      pendingPda: pendingPda.toBase58(),
      payloadHash: contentHashFromPayload(payload),
      txSignature: sig,
      explorerTx: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
      explorerPda: `https://explorer.solana.com/address/${pendingPda.toBase58()}?cluster=devnet`,
      programId: KNA_TRUST_PROGRAM_ID,
      at: new Date().toISOString(),
    },
  };
  fs.writeFileSync(evidencePath, JSON.stringify(next, null, 2));
  fs.writeFileSync(publicPath, JSON.stringify(next, null, 2));
  console.log(JSON.stringify(next.demoSubmit, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
