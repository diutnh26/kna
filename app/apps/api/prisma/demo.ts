// Loads the KNĂ demonstration dataset WITHOUT deleting anything.
//
// `npm run db:seed` wipes every table first, and refuses to run against
// anything that is not a local development database. That guard exists for
// a good reason and must not be weakened to populate a deployed
// environment — one stray run later would erase real pilot data.
//
// So this is the other door: purely additive, safe to point at Neon, and
// it refuses rather than duplicating if the dataset is already loaded.
//
// What it inserts is demonstration material, not field data. It shows how
// the platform presents information — a ledger row, a household's earnings,
// a moderation queue — using the households and listings the original
// mockup carried. Real records arrive when the field trip does.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, populate } from "./dataset";

const prisma = new PrismaClient();

function describeTarget() {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const u = new URL(raw);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  // Idempotent by refusal rather than by upsert. The dataset creates rows
  // with generated ids, so a second run would silently double every
  // listing and every ledger figure — which on a transparency ledger is
  // worse than an error message.
  const existing = await prisma.user.count({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN } },
  });
  if (existing > 0) {
    console.error(
      `The demonstration dataset is already loaded (${existing} ${DEMO_EMAIL_DOMAIN} accounts ` +
        `on ${describeTarget()}).\n` +
        "Running again would duplicate every listing and double every ledger figure.\n" +
        "To reload it, remove the existing demo records first — see docs/demo-data.md."
    );
    process.exit(1);
  }

  // Refuse to be the thing that first populates a database holding real
  // accounts. Mixing demonstration figures into a live ledger is the
  // failure this whole script is shaped to avoid.
  const realUsers = await prisma.user.count({
    where: { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } },
  });
  if (realUsers > 0 && process.env.DEMO_ALLOW_ALONGSIDE_REAL !== "yes") {
    console.error(
      `${describeTarget()} already holds ${realUsers} account(s) that are not demonstration ` +
        "records.\n" +
        "Adding demo listings and ledger rows beside real ones would make the public ledger " +
        "untrustworthy, which is the one thing this platform cannot afford.\n" +
        "If this is genuinely what you want, set DEMO_ALLOW_ALONGSIDE_REAL=yes."
    );
    process.exit(1);
  }

  console.log(`Loading the demonstration dataset into ${describeTarget()}…`);
  await populate(prisma);

  console.log(
    "\nDone. This is demonstration material, not field data — the app shows a banner " +
      "saying so for as long as these records exist.\n" +
      `Accounts use the password "${DEMO_PASSWORD}", e.g. guest@example.kna, ` +
      "coordinator@example.kna, ami.hbia@example.kna."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
