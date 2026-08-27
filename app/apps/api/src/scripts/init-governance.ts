/**
 * Initialize on-chain config + grant coordinator (idempotent).
 * Run: npx tsx src/scripts/init-governance.ts  (from apps/api)
 */
import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  buildInitializeConfigIx,
  buildGrantCoordinatorIx,
  buildSetCommitteeVaultIx,
  configPda,
  KNA_TRUST_PROGRAM_ID,
} from "@kna/chain-client";

const root = path.resolve(__dirname, "../../../../../");
const secrets = path.join(root, "secrets");
if (!fs.existsSync(path.join(secrets, "deploy-keypair.json"))) {
  throw new Error(`Missing deploy keypair under ${secrets}`);
}
const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const deploy = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(path.join(secrets, "deploy-keypair.json"), "utf8")))
);
const coordinator = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(path.join(secrets, "coordinator-keypair.json"), "utf8"))
  )
);
const vaultEnv = process.env.KNA_COMMITTEE_VAULT || coordinator.publicKey.toBase58();
const committeeVault = new PublicKey(vaultEnv);
const connection = new Connection(rpc, "confirmed");

async function send(ixs: TransactionInstruction[], signers: Keypair[]) {
  const tx = new Transaction().add(...ixs);
  const sig = await sendAndConfirmTransaction(connection, tx, signers, {
    commitment: "confirmed",
  });
  console.log("tx", sig);
  return sig;
}

async function main() {
  const cfg = configPda();
  const info = await connection.getAccountInfo(cfg);
  const evidence: Record<string, unknown> = {
    programId: KNA_TRUST_PROGRAM_ID,
    configPda: cfg.toBase58(),
    coordinator: coordinator.publicKey.toBase58(),
    committeeVault: committeeVault.toBase58(),
    deployAuthority: deploy.publicKey.toBase58(),
    deployTx:
      "2zu5VkBki6q9hmYUyiVDepS5KqjrZUsRRJydtDKd1s5AX5mSCu5RUuZngR9tYYRTUaM9CmkCkmS4GkTLJ1z8vCMa",
    explorerProgram: `https://explorer.solana.com/address/${KNA_TRUST_PROGRAM_ID}?cluster=devnet`,
    txs: {} as Record<string, string>,
    at: new Date().toISOString(),
  };
  const txs = evidence.txs as Record<string, string>;

  if (!info) {
    txs.initialize = await send(
      [buildInitializeConfigIx(deploy.publicKey, committeeVault)],
      [deploy]
    );
  } else {
    console.log("Config already exists:", cfg.toBase58());
    if (process.env.KNA_COMMITTEE_VAULT) {
      txs.setVault = await send(
        [buildSetCommitteeVaultIx(deploy.publicKey, committeeVault)],
        [deploy]
      );
    }
  }

  try {
    txs.grantCoordinator = await send(
      [buildGrantCoordinatorIx(deploy.publicKey, coordinator.publicKey)],
      [deploy]
    );
  } catch (err) {
    console.log("grant_role skipped/failed (maybe exists):", (err as Error).message || err);
  }

  const out = path.join(secrets, "devnet-evidence.json");
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));
  const publicOut = path.join(root, "docs", "DEVNET-EVIDENCE.json");
  fs.writeFileSync(publicOut, JSON.stringify(evidence, null, 2));
  console.log("Wrote", out);
  console.log("Wrote", publicOut);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
