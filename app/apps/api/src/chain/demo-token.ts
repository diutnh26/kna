import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { loadChainConfig } from "./config";

/** 1 dKNA = 1,000 VND; mint uses 6 decimals. */
export const DEMO_VND_PER_DKNA = 1_000;
export const DEMO_TOKEN_DECIMALS = 6;
export const DEMO_TOKEN_SYMBOL = "dKNA";
const VND_PER_DKNA = DEMO_VND_PER_DKNA;
const DECIMALS = DEMO_TOKEN_DECIMALS;
const RECEIPT_TOKENS = 1n * 10n ** BigInt(DECIMALS);

export type DemoTokenBalance = {
  pubkey: string;
  ata: string | null;
  raw: string;
  uiAmount: number;
  symbol: string;
  approxVnd: number;
};

export type DemoTokenBalances = {
  mint: string;
  symbol: string;
  decimals: number;
  vndPerToken: number;
  guest: DemoTokenBalance | null;
  provider: DemoTokenBalance | null;
  community: DemoTokenBalance | null;
};

async function readAtaBalance(
  connection: Connection,
  mint: PublicKey,
  owner: string
): Promise<DemoTokenBalance> {
  let ownerPk: PublicKey;
  try {
    ownerPk = new PublicKey(owner);
  } catch {
    return {
      pubkey: owner,
      ata: null,
      raw: "0",
      uiAmount: 0,
      symbol: DEMO_TOKEN_SYMBOL,
      approxVnd: 0,
    };
  }

  const ata = getAssociatedTokenAddressSync(
    mint,
    ownerPk,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  try {
    const account = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
    const raw = account.amount.toString();
    const uiAmount = Number(account.amount) / 10 ** DECIMALS;
    return {
      pubkey: ownerPk.toBase58(),
      ata: ata.toBase58(),
      raw,
      uiAmount,
      symbol: DEMO_TOKEN_SYMBOL,
      approxVnd: Math.round(uiAmount * VND_PER_DKNA),
    };
  } catch {
    // ATA missing → zero balance (not an error for the status panel).
    return {
      pubkey: ownerPk.toBase58(),
      ata: ata.toBase58(),
      raw: "0",
      uiAmount: 0,
      symbol: DEMO_TOKEN_SYMBOL,
      approxVnd: 0,
    };
  }
}

/**
 * Live SPL balances for the hackathon demo wallets (devnet). Used by GET /chain/status
 * so the web can show amounts beside Explorer links without leaving the app.
 */
export async function fetchDemoTokenBalances(wallets: {
  guest?: string | null;
  provider?: string | null;
  community?: string | null;
}): Promise<DemoTokenBalances | null> {
  const mint = loadMint();
  if (!mint) return null;

  const chain = loadChainConfig();
  try {
    assertDemoNetwork(chain.rpcUrl, chain.cluster);
  } catch {
    return null;
  }

  const connection = new Connection(chain.rpcUrl, { commitment: "confirmed" });

  const [guest, provider, community] = await Promise.all([
    wallets.guest ? readAtaBalance(connection, mint, wallets.guest) : Promise.resolve(null),
    wallets.provider
      ? readAtaBalance(connection, mint, wallets.provider)
      : Promise.resolve(null),
    wallets.community
      ? readAtaBalance(connection, mint, wallets.community)
      : Promise.resolve(null),
  ]);

  return {
    mint: mint.toBase58(),
    symbol: DEMO_TOKEN_SYMBOL,
    decimals: DECIMALS,
    vndPerToken: VND_PER_DKNA,
    guest,
    provider,
    community,
  };
}

function vndToRawAmount(vnd: number): bigint {
  const whole = Math.floor(vnd / VND_PER_DKNA);
  if (whole <= 0) return 0n;
  return BigInt(whole) * 10n ** BigInt(DECIMALS);
}

function loadFunder(): Keypair | null {
  const raw = process.env.DEMO_FUNDER_KEYPAIR_B58?.trim();
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    console.warn("[demo-token] DEMO_FUNDER_KEYPAIR_B58 is invalid — skipping demo mint");
    return null;
  }
}

function loadMint(): PublicKey | null {
  const raw = process.env.DEMO_MINT?.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    console.warn("[demo-token] DEMO_MINT is invalid — skipping demo mint");
    return null;
  }
}

function assertDemoNetwork(rpcUrl: string, cluster: string) {
  if (cluster === "mainnet-beta" || cluster === "mainnet") {
    throw new Error("demoDisburse refused: mainnet cluster");
  }
  const lower = rpcUrl.toLowerCase();
  if (lower.includes("mainnet")) {
    throw new Error("demoDisburse refused: mainnet RPC URL");
  }
}

export interface DemoDisburseInput {
  id: string;
  providerPayoutVnd: number;
  communityFundVnd: number;
  guestWallet?: string | null;
  providerWallet?: string | null;
}

/**
 * Approach A hackathon helper: mint demo SPL tokens on Solana devnet after
 * a VietQR payment is marked PAID. No-ops when DEMO_MINT / funder key are unset.
 *
 * Does NOT call the KNĂ attestation program or Squads.
 */
export async function demoDisburse(booking: DemoDisburseInput): Promise<string[]> {
  const mint = loadMint();
  const funder = loadFunder();
  if (!mint || !funder) return [];

  const chain = loadChainConfig();
  assertDemoNetwork(chain.rpcUrl, chain.cluster);
  const connection = new Connection(chain.rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
  });

  const recipients: { wallet: PublicKey; amount: bigint; label: string }[] = [];

  if (booking.providerWallet) {
    const amount = vndToRawAmount(booking.providerPayoutVnd);
    if (amount > 0n) {
      recipients.push({
        wallet: new PublicKey(booking.providerWallet),
        amount,
        label: "provider",
      });
    }
  }

  if (chain.committeeVault) {
    const amount = vndToRawAmount(booking.communityFundVnd);
    if (amount > 0n) {
      recipients.push({
        wallet: new PublicKey(chain.committeeVault),
        amount,
        label: "community",
      });
    }
  }

  if (booking.guestWallet) {
    recipients.push({
      wallet: new PublicKey(booking.guestWallet),
      amount: RECEIPT_TOKENS,
      label: "guest-receipt",
    });
  }

  if (recipients.length === 0) {
    console.info("[demo-token] no linked wallets — nothing to mint for", booking.id);
    return [];
  }

  const signatures: string[] = [];

  for (const recipient of recipients) {
    const ata = getAssociatedTokenAddressSync(
      mint,
      recipient.wallet,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({
      feePayer: funder.publicKey,
      blockhash,
      lastValidBlockHeight,
    });

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        funder.publicKey,
        ata,
        recipient.wallet,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint,
        ata,
        funder.publicKey,
        recipient.amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const sig = await connection.sendTransaction(tx, [funder], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    console.info(`[demo-token] minted ${recipient.label} → ${sig}`);
    signatures.push(sig);
  }

  return signatures;
}
