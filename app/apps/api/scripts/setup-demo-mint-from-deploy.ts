/**
 * Create DEMO_MINT using existing secrets/deploy-keypair.json (already has Devnet SOL).
 * Writes secrets/.env.demo-token for docker-compose env_file.
 *
 * Run from apps/api:
 *   npx tsx scripts/setup-demo-mint-from-deploy.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import bs58 from "bs58";

const SECRETS = path.resolve(process.cwd(), "../../../secrets");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const DECIMALS = 6;
const COMMITTEE_VAULT = "3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42";
/** User Phantom (Devnet) — guest receipt target for evidence mint */
const USER_PHANTOM = "5J9ixFxaUBe1bNDxPec67shUjRce831GgAyoE1Ygyu8V";
/** Pre-generated guest-demo keypair — used as provider target in evidence */
const PROVIDER_DEMO = "ACP16wSVq6au2wjdyQJLren8HY1bKa5Xfiq4majUfuf7";

function explorerTx(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}
function explorerAddr(a: string) {
  return `https://explorer.solana.com/address/${a}?cluster=devnet`;
}

async function mintTo(
  connection: Connection,
  funder: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  rawAmount: bigint
) {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: funder.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(
    createAssociatedTokenAccountIdempotentInstruction(
      funder.publicKey,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createMintToInstruction(mint, ata, funder.publicKey, rawAmount, [], TOKEN_PROGRAM_ID)
  );
  const sig = await connection.sendTransaction(tx, [funder], { skipPreflight: false });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  const acc = await getAccount(connection, ata);
  return {
    sig,
    ata: ata.toBase58(),
    balance: Number(acc.amount) / 10 ** DECIMALS,
  };
}

async function main() {
  const deployPath = path.join(SECRETS, "deploy-keypair.json");
  if (!fs.existsSync(deployPath)) {
    throw new Error(`Missing ${deployPath}`);
  }
  const funder = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(deployPath, "utf8")))
  );
  const connection = new Connection(RPC, "confirmed");
  console.log("Funder (deploy):", funder.publicKey.toBase58());
  console.log("Balance SOL:", (await connection.getBalance(funder.publicKey)) / 1e9);

  console.log("Creating mint (6 decimals)…");
  const mint = await createMint(connection, funder, funder.publicKey, null, DECIMALS);
  console.log("DEMO_MINT:", mint.toBase58());

  // Evidence: 1M VND booking → 900 provider + 30 community + 1 guest receipt
  const providerRaw = 900n * 10n ** BigInt(DECIMALS);
  const communityRaw = 30n * 10n ** BigInt(DECIMALS);
  const guestRaw = 1n * 10n ** BigInt(DECIMALS);

  const provider = await mintTo(
    connection,
    funder,
    mint,
    new PublicKey(PROVIDER_DEMO),
    providerRaw
  );
  console.log("Provider mint:", provider.sig, provider.balance, "dKNA");
  const community = await mintTo(
    connection,
    funder,
    mint,
    new PublicKey(COMMITTEE_VAULT),
    communityRaw
  );
  console.log("Community mint:", community.sig, community.balance, "dKNA");
  const guest = await mintTo(
    connection,
    funder,
    mint,
    new PublicKey(USER_PHANTOM),
    guestRaw
  );
  console.log("Guest receipt mint:", guest.sig, guest.balance, "dKNA");

  const funderB58 = bs58.encode(funder.secretKey);
  const envBody = [
    `# Generated ${new Date().toISOString()} — local only, gitignored`,
    `DEMO_MINT=${mint.toBase58()}`,
    `DEMO_FUNDER_KEYPAIR_B58=${funderB58}`,
    `DEMO_FUNDER_PUBKEY=${funder.publicKey.toBase58()}`,
    `KNA_COMMITTEE_VAULT=${COMMITTEE_VAULT}`,
    `DEMO_GUEST_WALLET=${USER_PHANTOM}`,
    `DEMO_PROVIDER_WALLET=${PROVIDER_DEMO}`,
    "",
  ].join("\n");

  const envPath = path.join(SECRETS, ".env.demo-token");
  fs.writeFileSync(envPath, envBody);

  const evidence = {
    cluster: "devnet",
    disclaimer: "Demo token — không phải thanh toán thật",
    mint: mint.toBase58(),
    mintExplorer: explorerAddr(mint.toBase58()),
    funder: funder.publicKey.toBase58(),
    wallets: {
      guestPhantom: {
        role: "guest (your Phantom)",
        pubkey: USER_PHANTOM,
        explorer: explorerAddr(USER_PHANTOM),
        amountDKna: guest.balance,
        tx: explorerTx(guest.sig),
        ata: explorerAddr(guest.ata),
      },
      providerDemo: {
        role: "provider (guest-demo keypair)",
        pubkey: PROVIDER_DEMO,
        explorer: explorerAddr(PROVIDER_DEMO),
        amountDKna: provider.balance,
        tx: explorerTx(provider.sig),
        ata: explorerAddr(provider.ata),
      },
      communityFund: {
        role: "community fund (Squads vault)",
        pubkey: COMMITTEE_VAULT,
        explorer: explorerAddr(COMMITTEE_VAULT),
        amountDKna: community.balance,
        tx: explorerTx(community.sig),
        ata: explorerAddr(community.ata),
      },
    },
  };
  fs.writeFileSync(
    path.join(SECRETS, "demo-token-evidence.json"),
    JSON.stringify(evidence, null, 2)
  );

  console.log("\nWrote", envPath);
  console.log("Wrote secrets/demo-token-evidence.json");
  console.log("\n── Explorer evidence ──");
  console.log("Mint:", evidence.mintExplorer);
  for (const w of Object.values(evidence.wallets)) {
    console.log(`\n${w.role}: ${w.amountDKna} dKNA`);
    console.log("  wallet", w.explorer);
    console.log("  tx    ", w.tx);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
