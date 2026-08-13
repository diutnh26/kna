// Tests run against their own database (kna_test), never the developer's
// kna_dev. Set before anything imports the Prisma client, since it reads
// DATABASE_URL at construction.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "sqlserver://localhost:1433;database=kna_test;integratedSecurity=true;trustServerCertificate=true";
process.env.JWT_SECRET = "test-only-secret";
process.env.NODE_ENV = "test";
