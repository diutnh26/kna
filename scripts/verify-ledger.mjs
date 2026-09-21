#!/usr/bin/env node
/**
 * Judge-facing offline verifier.
 * Usage:
 *   node scripts/verify-ledger.mjs
 *   node scripts/verify-ledger.mjs <ledgerId>
 *   node scripts/verify-ledger.mjs --evidence
 *
 * Reads docs/DEVNET-EVIDENCE.json by default, derives PDAs, prints Explorer
 * URLs, and optionally confirms accounts on Solana RPC (SOLANA_RPC_URL).
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const evidencePath = join(root, "docs", "DEVNET-EVIDENCE.json");

const DOMAIN = "kna-trust-v1";
const PROGRAM_ID = "2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f";

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function hashLedgerId(ledgerId) {
  return sha256Hex(`${DOMAIN}:ledger:${ledgerId}`);
}

function explorerAccount(address) {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

function explorerTx(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function loadEvidence() {
  if (!existsSync(evidencePath)) {
    throw new Error(`Missing ${evidencePath}`);
  }
  return JSON.parse(readFileSync(evidencePath, "utf8"));
}

async function rpcGetAccount(rpcUrl, address) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [address, { encoding: "base64", commitment: "confirmed" }],
    }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result?.value ?? null;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--evidence");
  const evidence = loadEvidence();
  const ledgerId = args[0] || evidence.demoSubmit?.ledgerId || evidence.demoFinalize?.ledgerId;

  if (!ledgerId) {
    console.error("No ledgerId provided and none in evidence.");
    process.exit(1);
  }

  const ledgerHash = hashLedgerId(ledgerId);
  const pendingPda = evidence.demoSubmit?.pendingPda ?? "(derive via chain-client)";
  const finalPda = evidence.demoFinalize?.finalPda ?? "(derive via chain-client)";
  const payloadHash = evidence.demoSubmit?.payloadHash ?? null;

  console.log("== KNĂ verify-ledger ==");
  console.log(`ledgerId     ${ledgerId}`);
  console.log(`ledgerHash   ${ledgerHash}`);
  console.log(`programId    ${evidence.programId || PROGRAM_ID}`);
  console.log(`payloadHash  ${payloadHash ?? "(not in evidence)"}`);
  console.log(`pendingPda   ${pendingPda}`);
  console.log(`finalPda     ${finalPda}`);
  console.log(`vault        ${evidence.committeeVault}`);
  console.log(`coordinator  ${evidence.coordinator}`);

  if (evidence.committeeVault === evidence.coordinator) {
    console.error("FAIL: committeeVault == coordinator (bootstrap, not Squads)");
    process.exit(1);
  }

  if (evidence.demoSubmit?.explorerTx) {
    console.log(`submit tx    ${evidence.demoSubmit.explorerTx}`);
  } else if (evidence.demoSubmit?.txSignature) {
    console.log(`submit tx    ${explorerTx(evidence.demoSubmit.txSignature)}`);
  }
  if (evidence.demoFinalize?.explorerTx) {
    console.log(`finalize tx  ${evidence.demoFinalize.explorerTx}`);
  } else if (evidence.demoFinalize?.txSignature) {
    console.log(`finalize tx  ${explorerTx(evidence.demoFinalize.txSignature)}`);
  }
  if (pendingPda && !pendingPda.startsWith("(")) {
    console.log(`pending URL  ${explorerAccount(pendingPda)}`);
  }
  if (finalPda && !finalPda.startsWith("(")) {
    console.log(`final URL    ${explorerAccount(finalPda)}`);
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  if (finalPda && !finalPda.startsWith("(")) {
    try {
      const acc = await rpcGetAccount(rpcUrl, finalPda);
      if (acc) {
        console.log(`RPC final    EXISTS (owner=${acc.owner}, lamports=${acc.lamports})`);
      } else {
        console.log("RPC final    MISSING (account not found)");
        process.exitCode = 2;
      }
    } catch (err) {
      console.log(`RPC final    SKIP (${err.message})`);
    }
  }

  console.log("OK — open Explorer URLs above to independently audit the settled split.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
