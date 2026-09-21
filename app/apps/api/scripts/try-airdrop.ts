import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const rpcs = [
    "https://api.devnet.solana.com",
    "https://rpc.ankr.com/solana_devnet",
  ];
  const kp = Keypair.generate();
  console.log("pubkey", kp.publicKey.toBase58());

  for (const rpc of rpcs) {
    const c = new Connection(rpc, "confirmed");
    console.log("try rpc", rpc);
    for (const amt of [1, 0.5]) {
      try {
        const sig = await c.requestAirdrop(kp.publicKey, Math.floor(amt * LAMPORTS_PER_SOL));
        const latest = await c.getLatestBlockhash("confirmed");
        await c.confirmTransaction({ signature: sig, ...latest }, "confirmed");
        console.log("OK", amt, sig, "bal", await c.getBalance(kp.publicKey));
        process.exit(0);
      } catch (e) {
        console.log("fail", amt, (e as Error).message);
        await sleep(4000);
      }
    }
  }
  process.exit(1);
}

main();
