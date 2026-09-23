/**
 * One-time devnet setup for accounts, bookings and pay_booking (idempotent):
 *   1. initialize_payment_config: the dKNA mint (1 VND = 1,000 base units),
 *      the KNĂ platform wallet (7%) and the Community Fund wallet (3%)
 *   2. ROLE_COORDINATOR for the platform registrar key, which registers
 *      accounts, records bookings and pays network fees
 *
 * Needs, from the repo root:
 *   secrets/deploy-keypair.json   config authority (= program upgrade authority)
 *   DEMO_MINT                     the dKNA mint
 *   KNA_REGISTRAR_KEYPAIR_B58     the platform registrar / fee payer
 *   KNA_PLATFORM_WALLET           optional; defaults to the deploy wallet
 *   KNA_COMMUNITY_FUND_WALLET     optional; defaults to KNA_COMMITTEE_VAULT
 *
 * Run: npx tsx src/scripts/setup-payments.ts  (from apps/api)
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
  buildGrantCoordinatorIx,
  buildInitializePaymentConfigIx,
  configPda,
  decodeConfig,
  fetchPaymentConfig,
  roleGrantPda,
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
const registrarRaw = process.env.KNA_REGISTRAR_KEYPAIR_B58?.trim();
if (!registrarRaw) throw new Error("Set KNA_REGISTRAR_KEYPAIR_B58");
const registrar = Keypair.fromSecretKey(bs58.decode(registrarRaw));
if (!process.env.DEMO_MINT) throw new Error("Set DEMO_MINT");
const mint = new PublicKey(process.env.DEMO_MINT);
const platformWallet = new PublicKey(process.env.KNA_PLATFORM_WALLET || deploy.publicKey.toBase58());
const communityRaw = process.env.KNA_COMMUNITY_FUND_WALLET || process.env.KNA_COMMITTEE_VAULT;
if (!communityRaw) throw new Error("Set KNA_COMMUNITY_FUND_WALLET or KNA_COMMITTEE_VAULT");
const communityWallet = new PublicKey(communityRaw);
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

  const txs: Record<string, string> = {};
  const existing = await fetchPaymentConfig(connection);
  if (existing) {
    console.log("Payment config already initialised:", existing);
  } else {
    txs.paymentConfig = await send(
      "initialize_payment_config",
      [
        buildInitializePaymentConfigIx({
          authority: deploy.publicKey,
          mint,
          platformWallet,
          communityWallet,
          unitsPerVnd: UNITS_PER_VND,
        }),
      ],
      [deploy]
    );
  }

  if (!(await connection.getAccountInfo(roleGrantPda(registrar.publicKey)))) {
    txs.grantRegistrar = await send(
      "grant coordinator role to the registrar",
      [buildGrantCoordinatorIx(deploy.publicKey, registrar.publicKey)],
      [deploy]
    );
  }

  console.log(
    JSON.stringify(
      {
        mint: mint.toBase58(),
        platformWallet: platformWallet.toBase58(),
        communityWallet: communityWallet.toBase58(),
        registrar: registrar.publicKey.toBase58(),
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
