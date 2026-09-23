/**
 * Loads apps/api/.env before anything else touches process.env.
 *
 * This file must stay the FIRST import in server.ts: src/ai/config.ts in
 * the API reads its environment variables at module-evaluation time, and
 * static imports evaluate in declaration order.
 */
import { config } from "dotenv";
import path from "node:path";

// The API's .env is the single source of truth (GEMINI_API_KEY,
// DATABASE_URL, AI_* overrides) — no second copy to drift.
config({ path: path.resolve(__dirname, "../api/.env") });
// A local .env in this folder may add test-only extras (e.g. PORT);
// dotenv never overrides variables that are already set.
config({ path: path.resolve(__dirname, ".env") });
