import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { loadChainConfig } from "./config";

/** 1 dKNA = 1,000 VND; mint uses 6 decimals. */
export const DEMO_VND_PER_DKNA = 1_000;
export const DEMO_TOKEN_DECIMALS = 6;
export const DEMO_TOKEN_SYMBOL = "dKNA";
const VND_PER_DKNA = DEMO_VND_PER_DKNA;
const DECIMALS = DEMO_TOKEN_DECIMALS;

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

export async function readAtaBalance(
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

export function loadFunder(): Keypair | null {
  const raw = process.env.DEMO_FUNDER_KEYPAIR_B58?.trim();
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    console.warn("[demo-token] DEMO_FUNDER_KEYPAIR_B58 is invalid — skipping demo mint");
    return null;
  }
}

export function loadMint(): PublicKey | null {
  const raw = process.env.DEMO_MINT?.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    console.warn("[demo-token] DEMO_MINT is invalid — skipping demo mint");
    return null;
  }
}

export function assertDemoNetwork(rpcUrl: string, cluster: string) {
  if (cluster === "mainnet-beta" || cluster === "mainnet") {
    throw new Error("demoDisburse refused: mainnet cluster");
  }
  const lower = rpcUrl.toLowerCase();
  if (lower.includes("mainnet")) {
    throw new Error("demoDisburse refused: mainnet RPC URL");
  }
}
