import { execFileSync } from "node:child_process";
import { join } from "node:path";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres@localhost:5432/kna_test";

/**
 * Brings the test database up to the current migrations before the suite
 * runs, so a broken migration fails the build rather than only broken
 * code. That matters more since the move to SQL Server, where the
 * migrations carry the CHECK constraints standing in for the enums Prisma
 * can't express.
 *
 * `migrate deploy`, not `migrate reset`: deploy only applies pending
 * migrations and destroys nothing. Row-level cleanup between suites is
 * already handled by resetDb() in each test file, so there is no reason to
 * drop the schema — and no reason for the test command to be capable of
 * destroying a database it was pointed at by mistake.
 *
 * Done here rather than in an npm script because setting an env var inline
 * isn't portable to Windows' cmd.exe.
 */
export async function setup() {
  const apiRoot = join(__dirname, "..");

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export async function teardown() {
  // Nothing to tear down: the database is left in place deliberately, since
  // inspecting it after a failure is often how you work out what went wrong.
}
