/**
 * One-time setup: create a demo SPL mint on Solana devnet for Approach A.
 *
 * Run from apps/api:
 *   npx tsx scripts/setup-demo-mint.ts
 *
 * Copy the printed DEMO_MINT / DEMO_FUNDER_KEYPAIR_B58 into .env / docker-compose.
 */
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import bs58 from "bs58";

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const funder = Keypair.generate();
  console.log("Funder pubkey:", funder.publicKey.toBase58());
  console.log("Requesting 2 SOL airdrop on devnet…");

  const airdropSig = await connection.requestAirdrop(funder.publicKey, 2 * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    { signature: airdropSig, ...latest },
    "confirmed"
  );

  console.log("Creating mint (6 decimals)…");
  const mint = await createMint(
    connection,
    funder,
    funder.publicKey,
    null,
    6
  );

  console.log("\n── Paste into .env / docker-compose ──");
  console.log(`DEMO_MINT=${mint.toBase58()}`);
  console.log(`DEMO_FUNDER_KEYPAIR_B58=${bs58.encode(funder.secretKey)}`);
  console.log("─────────────────────────────────────\n");
  console.log("Mint address:", mint.toBase58());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
