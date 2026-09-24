/**
 * Make an existing account an admin — the one admin step done outside the
 * console, to create the first admin. Later admins are made from the
 * console (People → Users → role).
 *
 * The account must exist: sign up on the web app first (email or Google).
 *
 * Run from apps/api, against the database in DATABASE_URL:
 *   npx tsx src/scripts/make-admin.ts someone@example.com
 * For Neon, use its direct connection string:
 *   $env:DATABASE_URL = "<Neon direct URL>"; npx tsx src/scripts/make-admin.ts someone@example.com
 */
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: npx tsx src/scripts/make-admin.ts <email>");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No account for ${email}. Sign up on the web app first, then run this again.`);
  }
  if (user.role === "ADMIN" && !user.disabledAt) {
    console.log(`${email} is already an admin.`);
    return;
  }
  // tokenVersion is bumped so the next sign-in carries the new role.
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN", disabledAt: null, tokenVersion: { increment: 1 } },
  });
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: user.id,
      resource: "users",
      recordId: user.id,
      action: "bootstrap-admin",
      changes: { role: { before: user.role, after: "ADMIN" } },
      reason: "make-admin script",
    },
  });
  console.log(`${email} is now an admin (was ${user.role}). Sign in again to open the admin console.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
