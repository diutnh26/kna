import { defineConfig } from "vitest/config";

// On-chain integration tests: need the compiled program (anchor build) and a
// Linux or macOS host for LiteSVM, so they are kept out of `npm test`.
export default defineConfig({
  test: {
    include: ["program-tests/**/*.test.ts"],
  },
});
