import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DB_URL = "file:./test.db";

/**
 * Builds the test database once per run, from the migrations — so the
 * suite fails if a migration is broken, not just if the code is. Done
 * here rather than in an npm script because setting an env var inline
 * isn't portable to Windows' cmd.exe.
 */
export async function setup() {
  const apiRoot = join(__dirname, "..");
  const dbFile = join(apiRoot, "prisma", "test.db");

  // Start from nothing, so a stale schema can't mask a missing migration.
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export async function teardown() {
  const dbFile = join(__dirname, "..", "prisma", "test.db");
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });
}
