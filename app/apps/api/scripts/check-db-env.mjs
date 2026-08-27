#!/usr/bin/env node
/**
 * Validates the database environment before migrations run.
 *
 * Prisma's own failure for a malformed URL is P1013, "the scheme is not
 * recognized", which does not say which variable is wrong or what it
 * contained. On a deploy host that costs a round trip through the build
 * queue to diagnose. This says it plainly instead.
 *
 * Never prints a password: only scheme, host and database name.
 */

const PREFIX = "database env check:";

function describe(raw) {
  try {
    const u = new URL(raw);
    return {
      scheme: u.protocol.replace(":", ""),
      host: u.hostname,
      db: decodeURIComponent(u.pathname.replace(/^\//, "")) || "(none)",
      sslmode: u.searchParams.get("sslmode") ?? "(unset)",
    };
  } catch {
    return null;
  }
}

/** First 12 characters, enough to spot `psql '...` or a stray `DATABASE_URL=`. */
function peek(raw) {
  return JSON.stringify(raw.slice(0, 12) + (raw.length > 12 ? "…" : ""));
}

const problems = [];
const notes = [];

for (const name of ["DATABASE_URL", "DIRECT_DATABASE_URL"]) {
  const raw = (process.env[name] ?? "").trim();

  if (!raw) {
    problems.push(`${name} is not set.`);
    continue;
  }

  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    let hint = "";
    if (/^psql\b/i.test(raw)) {
      hint =
        " It looks like Neon's psql command was pasted. Copy only the URL inside the quotes.";
    } else if (/^[A-Z_]+=/.test(raw)) {
      hint = " It looks like the variable name was included. Paste only the value.";
    } else if (/^['"]/.test(raw)) {
      hint = " It starts with a quote. Render stores the value literally — drop the quotes.";
    }
    problems.push(`${name} must start with postgresql:// — got ${peek(raw)}.${hint}`);
    continue;
  }

  const info = describe(raw);
  if (!info) {
    problems.push(`${name} is not a parseable URL (${peek(raw)}).`);
    continue;
  }

  const remote = !["localhost", "127.0.0.1", "::1"].includes(info.host);
  if (remote && info.sslmode === "(unset)") {
    notes.push(`${name} has no sslmode; a managed host such as Neon usually requires sslmode=require.`);
  }

  console.log(`${PREFIX} ${name} -> ${info.scheme}://${info.host}/${info.db} (sslmode=${info.sslmode})`);
}

// The mistake most likely to reach production: the two swapped. Migrations
// cannot run through Neon's pooled endpoint, which is PgBouncer in
// transaction mode and has no session-level advisory locks.
const pooled = (process.env.DATABASE_URL ?? "").includes("-pooler");
const direct = (process.env.DIRECT_DATABASE_URL ?? "").includes("-pooler");
if (direct) {
  problems.push(
    "DIRECT_DATABASE_URL points at a pooled endpoint (-pooler). Migrations cannot run " +
      "through PgBouncer — use the direct host, without -pooler."
  );
}
if (!pooled && direct === false && process.env.DATABASE_URL?.includes("neon.tech")) {
  notes.push(
    "DATABASE_URL is not the pooled endpoint. That works, but the pooled host " +
      "(-pooler) is the better default for the running app."
  );
}

for (const n of notes) console.warn(`${PREFIX} note: ${n}`);

if (problems.length > 0) {
  console.error(`\n${PREFIX} refusing to run migrations:\n  - ${problems.join("\n  - ")}\n`);
  console.error("Set these on the service (Render: Environment tab). See docs/deployment.md.\n");
  process.exit(1);
}

console.log(`${PREFIX} ok`);
