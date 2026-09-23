import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The committed dev secret can mint a token for any account, including a
 * Committee seat-holder. Booting production with it would hand an outsider
 * the one authority the governance model exists to protect — so the
 * process must refuse to start instead.
 */
describe("assertProductionConfig", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  async function load() {
    vi.resetModules();
    return (await import("../src/lib/config")).assertProductionConfig;
  }

  it("does nothing outside production", async () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "dev-only-change-me";
    const assert = await load();
    expect(() => assert()).not.toThrow();
  });

  it("refuses to start in production with the committed dev secret", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "dev-only-change-me";
    process.env.DATABASE_URL = "sqlserver://real";
    process.env.CORS_ORIGIN = "https://kna.example";
    const assert = await load();
    expect(() => assert()).toThrow(/development default/);
  });

  it("refuses a short secret", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "too-short";
    process.env.DATABASE_URL = "sqlserver://real";
    process.env.CORS_ORIGIN = "https://kna.example";
    const assert = await load();
    expect(() => assert()).toThrow(/32 characters/);
  });

  it("refuses to fall back to a localhost CORS origin in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a".repeat(48);
    process.env.DATABASE_URL = "sqlserver://real";
    delete process.env.CORS_ORIGIN;
    const assert = await load();
    expect(() => assert()).toThrow(/CORS_ORIGIN/);
  });

  it("accepts a properly configured production environment", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a".repeat(48);
    process.env.DATABASE_URL = "sqlserver://real";
    process.env.CORS_ORIGIN = "https://kna.example";
    process.env.WALLET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const assert = await load();
    expect(() => assert()).not.toThrow();
  });

  it("refuses production without a real wallet encryption key", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a".repeat(48);
    process.env.DATABASE_URL = "sqlserver://real";
    process.env.CORS_ORIGIN = "https://kna.example";
    delete process.env.WALLET_ENCRYPTION_KEY;
    let assert = await load();
    expect(() => assert()).toThrow(/WALLET_ENCRYPTION_KEY is unset/);

    process.env.WALLET_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");
    assert = await load();
    expect(() => assert()).toThrow(/32 random bytes/);
  });
});
