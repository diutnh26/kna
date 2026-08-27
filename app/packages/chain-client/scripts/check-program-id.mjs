import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const expected = "2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f";

const files = [
  "programs/kna-trust-layer/src/lib.rs",
  "Anchor.toml",
  "packages/chain-client/src/constants.ts",
  "apps/api/src/chain/config.ts",
];

const missing = [];
for (const rel of files) {
  const full = path.join(root, rel);
  const text = fs.readFileSync(full, "utf8");
  if (!text.includes(expected)) {
    missing.push(rel);
  }
}

const compose = path.join(root, "../docker-compose.solana.yml");
if (fs.existsSync(compose)) {
  const text = fs.readFileSync(compose, "utf8");
  if (!text.includes(expected)) missing.push("docker-compose.solana.yml");
  if (text.includes("KnATrust1111111111111111111111111111111111111")) {
    missing.push("docker-compose.solana.yml (placeholder)");
  }
}

if (missing.length) {
  console.error("Program ID mismatch in:", missing.join(", "));
  process.exit(1);
}
console.log("Program ID consistent:", expected);
