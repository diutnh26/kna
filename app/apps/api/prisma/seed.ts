// Seeds the dev database with the same households, listings, products, and
// governance records the frontend's mock arrays used to hard-code — so a
// screen switching from its mock array to a fetch() doesn't change what's
// on screen.
//
// THIS DELETES EVERY ROW IN EVERY TABLE before inserting. See assertSafe()
// below for the conditions under which it will agree to run.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD, populate } from "./dataset";

const prisma = new PrismaClient();


/**
 * Refuses to wipe anything that doesn't look like a development database.
 *
 * A comment saying "don't point this at production" is worth nothing at
 * 2am with the wrong terminal focused. This platform's whole argument is a
 * ledger the community can audit; one careless `npm run db:seed` against
 * the deployed database would erase every booking and every Community Fund
 * record, and there is no undo.
 *
 * Escape hatch for the rare legitimate case (reseeding a shared staging
 * database): SEED_ALLOW_DESTRUCTIVE=yes.
 */
/** Host and database name from either URL style, '' for anything unreadable. */
function parseDatabaseUrl(url: string): { host: string; dbName: string } {
  if (/^postgres(ql)?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname.toLowerCase(),
        dbName: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
      };
    } catch {
      return { host: "", dbName: "" };
    }
  }
  // sqlserver://host:port;database=name;...
  return {
    host: (/^sqlserver:\/\/([^;:]+)/i.exec(url)?.[1] ?? "").trim().toLowerCase(),
    dbName: (/(?:^|;)\s*database=([^;]+)/i.exec(url)?.[1] ?? "").trim(),
  };
}

function assertSafe() {
  if (process.env.SEED_ALLOW_DESTRUCTIVE === "yes") {
    console.warn("SEED_ALLOW_DESTRUCTIVE=yes — proceeding against a non-development database.");
    return;
  }

  const url = process.env.DATABASE_URL ?? "";
  const problems: string[] = [];

  if (process.env.NODE_ENV === "production") {
    problems.push("NODE_ENV is production.");
  }

  // Parses postgresql:// URLs, and still understands the sqlserver://
  // key=value form in case a branch or an old .env is still on it. A URL
  // this cannot parse yields empty values, which fail both checks below —
  // failing closed is the whole point of this function.
  const { host, dbName } = parseDatabaseUrl(url);

  // Name-based check, deliberately conservative: the database must say it
  // is for development or testing.
  if (!/(dev|test|local)/i.test(dbName)) {
    problems.push(
      `the database is named "${dbName || "(could not be read from DATABASE_URL)"}", ` +
        'which does not contain "dev", "test" or "local".'
    );
  }

  // A remote host is not somewhere to run a destructive script by accident.
  const isLocal = ["localhost", "127.0.0.1", "::1", ".", "(local)"].includes(host);
  if (!isLocal) {
    problems.push(`the host is "${host || "(could not be read)"}", which is not local.`);
  }

  if (problems.length > 0) {
    console.error(
      "\nRefusing to seed — this would DELETE EVERY ROW, and:\n" +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\n\nIf you are certain (e.g. reseeding a staging database), re-run with\n" +
        "SEED_ALLOW_DESTRUCTIVE=yes\n"
    );
    process.exit(1);
  }
}

async function reset() {
  // Delete in foreign-key-safe order (children before parents).
  await prisma.notification.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.orderItem.deleteMany();
  // Before Booking: OffsetContribution holds a NoAction foreign key to it,
  // so deleting bookings first fails on the constraint. The test suite went
  // green while logging that failure, because afterAll swallowed it.
  await prisma.offsetContribution.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.order.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.product.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.committeeDecision.deleteMany();
  await prisma.communityFundEntry.deleteMany();
  await prisma.archiveEntry.deleteMany();
  await prisma.phrase.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  assertSafe();
  console.log("Seeding KNĂ dev database…");
  await reset();
  await populate(prisma);
  console.log(`Every demo account uses the password "${DEMO_PASSWORD}" — e.g. guest@example.kna`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
