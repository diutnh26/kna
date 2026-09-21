/**
 * One-shot evidence: mint demo tokens guest → provider + community on Solana DEVNET.
 * Prints Explorer URLs judges can open.
 *
 * Run from apps/api (needs network):
 *   npx tsx scripts/evidence-demo-flow.ts
 *
 * If DEMO_MINT / DEMO_FUNDER_KEYPAIR_B58 are unset, creates them first (airdrop).
 */
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const DECIMALS = 6;
const VND_PER = 1_000;

function explorerTx(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}
function explorerAddr(addr: string) {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}
function explorerToken(ata: string) {
  return `https://explorer.solana.com/address/${ata}?cluster=devnet`;
}

async function airdrop(connection: Connection, kp: Keypair, sol = 2) {
  const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
}

async function mintTo(
  connection: Connection,
  funder: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  rawAmount: bigint
): Promise<{ sig: string; ata: string }> {
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
  return { sig, ata: ata.toBase58() };
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  console.log("RPC:", RPC);

  let funder: Keypair;
  let mint: PublicKey;

  if (process.env.DEMO_FUNDER_KEYPAIR_B58?.trim() && process.env.DEMO_MINT?.trim()) {
    funder = Keypair.fromSecretKey(bs58.decode(process.env.DEMO_FUNDER_KEYPAIR_B58.trim()));
    mint = new PublicKey(process.env.DEMO_MINT.trim());
    console.log("Using existing DEMO_MINT / funder from env");
  } else {
    funder = Keypair.generate();
    console.log("Creating funder + airdrop…", funder.publicKey.toBase58());
    await airdrop(connection, funder, 2);
    mint = await createMint(connection, funder, funder.publicKey, null, DECIMALS);
    console.log("Created mint:", mint.toBase58());
  }

  // Simulate wallets: guest receipt, provider 90%, community 3%
  const guest = Keypair.generate();
  const provider = Keypair.generate();
  const community = Keypair.generate();

  const totalVnd = 1_000_000;
  const providerPayoutVnd = 900_000;
  const communityFundVnd = 30_000;
  // platform 7% stays off demo mint path in Approach A

  const providerRaw = BigInt(Math.floor(providerPayoutVnd / VND_PER)) * 10n ** BigInt(DECIMALS);
  const communityRaw = BigInt(Math.floor(communityFundVnd / VND_PER)) * 10n ** BigInt(DECIMALS);
  const guestRaw = 1n * 10n ** BigInt(DECIMALS);

  console.log("\n── Simulated split (1 dKNA = 1,000 VND) ──");
  console.log(`Booking total: ${totalVnd.toLocaleString("vi-VN")} ₫`);
  console.log(`Provider 90%:  ${providerPayoutVnd.toLocaleString("vi-VN")} ₫ → ${Number(providerRaw) / 1e6} dKNA`);
  console.log(`Community 3%:  ${communityFundVnd.toLocaleString("vi-VN")} ₫ → ${Number(communityRaw) / 1e6} dKNA`);
  console.log(`Guest receipt: 1 dKNA`);

  const providerTx = await mintTo(connection, funder, mint, provider.publicKey, providerRaw);
  console.log("\n[1] Provider mint OK", providerTx.sig);
  const communityTx = await mintTo(connection, funder, mint, community.publicKey, communityRaw);
  console.log("[2] Community mint OK", communityTx.sig);
  const guestTx = await mintTo(connection, funder, mint, guest.publicKey, guestRaw);
  console.log("[3] Guest receipt mint OK", guestTx.sig);

  async function bal(owner: PublicKey, ata: string) {
    const acc = await getAccount(connection, new PublicKey(ata));
    return Number(acc.amount) / 10 ** DECIMALS;
  }

  const evidence = {
    cluster: "devnet",
    disclaimer: "Demo token — không phải thanh toán thật",
    mint: mint.toBase58(),
    mintExplorer: explorerAddr(mint.toBase58()),
    funder: funder.publicKey.toBase58(),
    flow: {
      from: "Funder mint authority (demo) after VietQR PAID",
      to: [
        {
          role: "provider",
          wallet: provider.publicKey.toBase58(),
          amountDKna: await bal(provider.publicKey, providerTx.ata),
          ata: providerTx.ata,
          tx: providerTx.sig,
          explorerTx: explorerTx(providerTx.sig),
          explorerAta: explorerToken(providerTx.ata),
        },
        {
          role: "communityFund",
          wallet: community.publicKey.toBase58(),
          amountDKna: await bal(community.publicKey, communityTx.ata),
          ata: communityTx.ata,
          tx: communityTx.sig,
          explorerTx: explorerTx(communityTx.sig),
          explorerAta: explorerToken(communityTx.ata),
        },
        {
          role: "guestReceipt",
          wallet: guest.publicKey.toBase58(),
          amountDKna: await bal(guest.publicKey, guestTx.ata),
          ata: guestTx.ata,
          tx: guestTx.sig,
          explorerTx: explorerTx(guestTx.sig),
          explorerAta: explorerToken(guestTx.ata),
        },
      ],
    },
    envSnippet: {
      DEMO_MINT: mint.toBase58(),
      DEMO_FUNDER_KEYPAIR_B58: bs58.encode(funder.secretKey),
      KNA_COMMITTEE_VAULT: community.publicKey.toBase58(),
    },
    note:
      "Community page ledger = Postgres LedgerEntry (VND). These Explorer links = on-chain demo SPL mints on Solana Devnet.",
  };

  const outPath = join(process.cwd(), "scripts", "evidence-demo-flow.json");
  writeFileSync(outPath, JSON.stringify(evidence, null, 2));

  console.log("\n════════════════════════════════════════");
  console.log("EVIDENCE — open these on Solana Explorer (devnet)");
  console.log("════════════════════════════════════════");
  console.log("Mint:", evidence.mintExplorer);
  for (const row of evidence.flow.to) {
    console.log(`\n${row.role}: ${row.amountDKna} dKNA`);
    console.log("  wallet:", explorerAddr(row.wallet));
    console.log("  tx:    ", row.explorerTx);
    console.log("  ATA:   ", row.explorerAta);
  }
  console.log("\nWrote", outPath);
  console.log("\n── Paste into docker-compose api.environment ──");
  console.log(`DEMO_MINT: ${evidence.envSnippet.DEMO_MINT}`);
  console.log(`DEMO_FUNDER_KEYPAIR_B58: ${evidence.envSnippet.DEMO_FUNDER_KEYPAIR_B58}`);
  console.log(`KNA_COMMITTEE_VAULT: ${evidence.envSnippet.KNA_COMMITTEE_VAULT}`);
  console.log("───────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
