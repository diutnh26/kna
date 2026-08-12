import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests share one SQLite file and reset it between runs,
    // so they must not run concurrently against each other.
    fileParallelism: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/globalSetup.ts"],
  },
});
