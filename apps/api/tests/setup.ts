// Tests run against their own SQLite file, never the developer's dev.db.
// Set before anything imports the Prisma client, since it reads
// DATABASE_URL at construction.
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-only-secret";
process.env.NODE_ENV = "test";
