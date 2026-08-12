import { PrismaClient } from "@prisma/client";

// Single shared client — tsx watch re-imports this module on every reload,
// so stash it on globalThis to avoid exhausting SQLite's connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
