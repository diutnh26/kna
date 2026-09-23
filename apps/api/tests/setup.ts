// Loads apps/api/.env the same way dev and the scripts do. dotenv never
// overrides variables that are already set, so CI's explicit env wins there
// and the developer's .env wins here — including a TEST_DATABASE_URL that
// points at a portable Postgres on a non-default port.
import "dotenv/config";
// Tests run against their own database (kna_test), never the developer's
// kna_dev. Set before anything imports the Prisma client, since it reads
// DATABASE_URL at construction.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres@localhost:5432/kna_test";
// Prisma requires directUrl to resolve even when it equals the main URL.
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.JWT_SECRET = "test-only-secret";
process.env.NODE_ENV = "test";
// The suite must pass on machines with no GPU and no Ollama — CI above all.
// "off" exercises the honest degraded mode: approved answers and refusals,
// which are exactly the paths whose correctness the platform promises.
process.env.AI_PROVIDER = "off";
// No reference-document ingestion in tests: the suite's document counts
// must be about the database, not about what files sit in data/ on the
// machine running it.
process.env.AI_REFERENCE_DIR = "";
