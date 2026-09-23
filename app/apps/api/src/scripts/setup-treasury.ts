/**
 * One-time devnet setup for settle_split (idempotent — safe to re-run):
 *   1. the escrow token account: dKNA ATA owned by the treasury PDA
 *   2. initialize_treasury (mint, escrow, platform wallet, 1 VND = 1,000 units)
 *   3. ROLE_COORDINATOR for the settler key the API signs settle_split with
 *
 * Needs, from the repo root:
 *   secrets/deploy-keypair.json   config authority (= program upgrade authority)
 *   DEMO_MINT                     the dKNA mint (secrets/.env.demo-token)
 *   KNA_SETTLER_KEYPAIR_B58       or DEMO_FUNDER_KEYPAIR_B58 as the settler
 *   KNA_PLATFORM_WALLET           optional; defaults to the deploy wallet
 *
 * Run: npx tsx src/scripts/setup-treasury.ts  (from apps/api)
 */
import fs from "fs";
import path from "path";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  associatedTokenAddress,
  buildCreateAtaIdempotentIx,
  buildGrantCoordinatorIx,
  buildInitializeTreasuryIx,
  configPda,
  decodeConfig,
  fetchTreasury,
  roleGrantPda,
  treasuryPda,
} from "@kna/chain-client";

const UNITS_PER_VND = 1_000n; // dKNA: 6 decimals, 1 dKNA = 1,000 VND

const root = path.resolve(__dirname, "../../../../../");
const deployPath = path.join(root, "secrets", "deploy-keypair.json");
if (!fs.existsSync(deployPath)) {
  throw new Error(`Missing ${deployPath} (the config authority / upgrade authority keypair)`);
}
const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
if (rpc.toLowerCase().includes("mainnet")) throw new Error("Refusing to run against mainnet");

const deploy = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(deployPath, "utf8"))));
const settlerRaw = (process.env.KNA_SETTLER_KEYPAIR_B58 ?? process.env.DEMO_FUNDER_KEYPAIR_B58)?.trim();
if (!settlerRaw) throw new Error("Set KNA_SETTLER_KEYPAIR_B58 or DEMO_FUNDER_KEYPAIR_B58");
const settler = Keypair.fromSecretKey(bs58.decode(settlerRaw));
if (!process.env.DEMO_MINT) throw new Error("Set DEMO_MINT");
const mint = new PublicKey(process.env.DEMO_MINT);
const platformWallet = new PublicKey(process.env.KNA_PLATFORM_WALLET || deploy.publicKey.toBase58());
const connection = new Connection(rpc, "confirmed");

async function send(label: string, ixs: TransactionInstruction[], signers: Keypair[]) {
  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(...ixs), signers, {
    commitment: "confirmed",
  });
  console.log(`${label}: ${sig}`);
  return sig;
}

async function main() {
  const cfgInfo = await connection.getAccountInfo(configPda());
  if (!cfgInfo) throw new Error("Config not initialised — run init-governance first");
  const config = decodeConfig(Buffer.from(cfgInfo.data), cfgInfo.owner);
  if (config.coordinatorAuthority !== deploy.publicKey.toBase58()) {
    throw new Error(`deploy-keypair is not the config authority (${config.coordinatorAuthority})`);
  }

  const escrow = associatedTokenAddress(mint, treasuryPda());
  const txs: Record<string, string> = {};

  if (!(await connection.getAccountInfo(escrow))) {
    txs.escrow = await send("escrow ATA", [buildCreateAtaIdempotentIx(deploy.publicKey, treasuryPda(), mint)], [deploy]);
  }

  const existing = await fetchTreasury(connection);
  if (existing) {
    console.log("Treasury already initialised:", existing);
  } else {
    txs.initializeTreasury = await send(
      "initialize_treasury",
      [
        buildInitializeTreasuryIx({
          authority: deploy.publicKey,
          mint,
          vault: escrow,
          platformWallet,
          unitsPerVnd: UNITS_PER_VND,
        }),
      ],
      [deploy]
    );
  }

  if (!(await connection.getAccountInfo(roleGrantPda(settler.publicKey)))) {
    txs.grantSettler = await send(
      "grant coordinator role to settler",
      [buildGrantCoordinatorIx(deploy.publicKey, settler.publicKey)],
      [deploy]
    );
  }

  console.log(
    JSON.stringify(
      {
        treasury: treasuryPda().toBase58(),
        escrow: escrow.toBase58(),
        mint: mint.toBase58(),
        platformWallet: platformWallet.toBase58(),
        settler: settler.publicKey.toBase58(),
        txs,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
