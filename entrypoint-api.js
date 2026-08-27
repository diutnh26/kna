/**
 * Start the snapshot API: migrate, seed once if empty, then listen.
 * Lives in kna-docker only — the original kna repo is not touched.
 */
const { execSync, spawn } = require("node:child_process");
const path = require("node:path");

const apiRoot = "/app/apps/api";
process.chdir(apiRoot);

function run(command, extraEnv = {}) {
  execSync(command, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

async function main() {
  console.log("KNĂ docker: applying migrations…");
  run("npx prisma migrate deploy");

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const users = await prisma.user.count();
  await prisma.$disconnect();

  if (users === 0) {
    console.log("KNĂ docker: empty database — loading demo data…");
    run("npx tsx prisma/seed.ts", {
      NODE_ENV: "development",
      SEED_ALLOW_DESTRUCTIVE: "yes",
    });
  } else {
    console.log(`KNĂ docker: database already has ${users} users — skipping seed.`);
  }

  console.log("KNĂ docker: starting API on port", process.env.PORT || 4000);
  const child = spawn("node", [path.join(apiRoot, "dist", "index.js")], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
