import crypto from "node:crypto";
import { isProduction } from "./config";

/**
 * Platform-held wallet keys, encrypted at rest with AES-256-GCM.
 *
 * The key comes from WALLET_ENCRYPTION_KEY (32 random bytes, base64). A
 * production process refuses to start without it (lib/config.ts); outside
 * production a fixed development key is used so tests and local runs work,
 * and wallets made with it are worthless anywhere else.
 *
 * Stored form: "v1:" + base64(iv[12] | tag[16] | ciphertext). The version
 * prefix leaves room to rotate the key later.
 */

const DEV_KEY = crypto.createHash("sha256").update("kna-dev-wallet-encryption-key").digest();

function key(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (isProduction) throw new Error("WALLET_ENCRYPTION_KEY is not set");
    return DEV_KEY;
  }
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes, base64");
  return bytes;
}

export function encryptSecret(secret: Uint8Array): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  return "v1:" + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptSecret(stored: string): Uint8Array {
  if (!stored.startsWith("v1:")) throw new Error("Unknown wallet secret format");
  const raw = Buffer.from(stored.slice(3), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return new Uint8Array(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]));
}
