import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as sqds from "@sqds/multisig";
import {
  buildInitializeConfigIx,
  buildSetCommitteeVaultIx,
  configPda,
  KNA_TRUST_PROGRAM_ID,
} from "@kna/chain-client";

const root = path.resolve(__dirname, "../../../../../");
const secrets = path.join(root, "secrets");
const docsDir = path.join(root, "docs");
const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const squadsPath = path.join(secrets, "squads-devnet.json");
const envPath = path.join(secrets, ".env.solana");

function readKeypair(name: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(secrets, name), "utf8")))
  );
}

function replaceEnvValue(src: string, key: string, value: string) {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=.*$`, "m").test(src)) {
    return src.replace(new RegExp(`^${key}=.*$`, "m"), line);
  }
  return `${src.trimEnd()}\n${line}\n`;
}

async function ensureFunded(
  connection: Connection,
  deploy: Keypair,
  wallets: Keypair[],
  minSol = 0.08,
  topUpSol = 0.15
) {
  const balances = await Promise.all(wallets.map((kp) => connection.getBalance(kp.publicKey)));
  const transfers = wallets
    .map((kp, i) => ({ kp, bal: balances[i] / LAMPORTS_PER_SOL }))
    .filter((row) => row.bal < minSol)
    .map((row) =>
      SystemProgram.transfer({
        fromPubkey: deploy.publicKey,
        toPubkey: row.kp.publicKey,
        lamports: Math.floor(topUpSol * LAMPORTS_PER_SOL),
      })
    );
  if (transfers.length === 0) return [] as string[];
  const tx = new Transaction().add(...transfers);
  const sig = await sendAndConfirmTransaction(connection, tx, [deploy], {
    commitment: "confirmed",
  });
  return [sig];
}

async function syncCommitteeVault(connection: Connection, deploy: Keypair, vault: PublicKey) {
  const cfg = configPda();
  const info = await connection.getAccountInfo(cfg);
  const tx = new Transaction();
  if (!info) {
    tx.add(buildInitializeConfigIx(deploy.publicKey, vault));
  } else {
    tx.add(buildSetCommitteeVaultIx(deploy.publicKey, vault));
  }
  return sendAndConfirmTransaction(connection, tx, [deploy], { commitment: "confirmed" });
}

async function main() {
  const connection = new Connection(rpc, "confirmed");
  const deploy = readKeypair("deploy-keypair.json");
  const committee1 = readKeypair("committee-1-keypair.json");
  const committee2 = readKeypair("committee-2-keypair.json");
  const committee3 = readKeypair("committee-3-keypair.json");
  const programConfigPda = sqds.getProgramConfigPda({})[0];
  const programConfig = await sqds.accounts.ProgramConfig.fromAccountAddress(
    connection,
    programConfigPda
  );

  const fundSigs = await ensureFunded(connection, deploy, [committee1, committee2, committee3]);

  let multisigPda: PublicKey;
  let vaultPda: PublicKey;
  let createSig: string | null = null;
  let createKeyPubkey: string | null = null;

  if (fs.existsSync(squadsPath)) {
    const existing = JSON.parse(fs.readFileSync(squadsPath, "utf8"));
    multisigPda = new PublicKey(existing.multisigPda);
    vaultPda = new PublicKey(existing.vaultPda);
  } else {
    const createKey = Keypair.generate();
    multisigPda = sqds.getMultisigPda({ createKey: createKey.publicKey })[0];
    vaultPda = sqds.getVaultPda({ multisigPda, index: 0 })[0];
    createSig = await sqds.rpc.multisigCreateV2({
      connection,
      treasury: programConfig.treasury,
      createKey,
      creator: committee1,
      multisigPda,
      configAuthority: null,
      threshold: 2,
      members: [committee1, committee2, committee3].map((kp) => ({
        key: kp.publicKey,
        permissions: sqds.types.Permissions.all(),
      })),
      timeLock: 0,
      rentCollector: deploy.publicKey,
    });
    createKeyPubkey = createKey.publicKey.toBase58();
  }

  const setVaultSig = await syncCommitteeVault(connection, deploy, vaultPda);
  const envSrc = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const nextEnv = replaceEnvValue(envSrc, "KNA_COMMITTEE_VAULT", vaultPda.toBase58());
  fs.writeFileSync(envPath, nextEnv);

  const out = {
    cluster: "devnet",
    programId: KNA_TRUST_PROGRAM_ID,
    multisigPda: multisigPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    threshold: 2,
    members: [
      committee1.publicKey.toBase58(),
      committee2.publicKey.toBase58(),
      committee3.publicKey.toBase58(),
    ],
    createKeyPubkey,
    fundingTxs: fundSigs,
    createSig,
    setVaultSig,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(squadsPath, JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(docsDir, "SQUADS-DEVNET.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
