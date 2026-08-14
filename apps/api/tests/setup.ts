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
