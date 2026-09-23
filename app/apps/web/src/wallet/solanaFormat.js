// Base58 without 0, O, I, l. A Solana address is 32 bytes (32–44 chars);
// a transaction signature is 64 bytes (86–88 chars).
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const isSolanaAddress = (v) => BASE58.test(v) && v.length >= 32 && v.length <= 44;
export const isSolanaSignature = (v) => BASE58.test(v) && v.length >= 86 && v.length <= 88;
