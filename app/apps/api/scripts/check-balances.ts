import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const secrets = path.resolve(process.cwd(), "../../../secrets");
// When run from apps/api: ../../secrets
const secretsAlt = path.resolve(process.cwd(), "../../secrets");
const secretsDir = fs.existsSync(secretsAlt) ? secretsAlt : secrets;
const c = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  const files = [
    "deploy-keypair.json",
    "coordinator-keypair.json",
    "guest-demo-keypair.json",
    "committee-1-keypair.json",
  ];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(secretsDir, f), "utf8"));
    const kp = Keypair.fromSecretKey(Uint8Array.from(raw));
    const bal = await c.getBalance(kp.publicKey);
    console.log(f, kp.publicKey.toBase58(), bal / LAMPORTS_PER_SOL, "SOL");
  }
  const vault = new PublicKey("3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42");
  console.log("committee vault", vault.toBase58(), (await c.getBalance(vault)) / LAMPORTS_PER_SOL, "SOL");
  const user = new PublicKey("5J9ixFxaUBe1bNDxPec67shUjRce831GgAyoE1Ygyu8V");
  console.log("user phantom", user.toBase58(), (await c.getBalance(user)) / LAMPORTS_PER_SOL, "SOL");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
