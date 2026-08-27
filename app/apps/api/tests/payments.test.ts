import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualSettlementGateway } from "../src/payments/gateway";

describe("payment gateway seam", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  async function loadGetter() {
    vi.resetModules();
    return (await import("../src/payments/gateway")).getPaymentGateway;
  }

  it("defaults to manual settlement, which is how the pilot actually runs", async () => {
    delete process.env.PAYMENT_PROVIDER;
    const get = await loadGetter();
    const gateway = get();
    expect(gateway.name).toBe("manual");
    expect(gateway.settlesAutomatically).toBe(false);
  });

  it("fails loudly on an unknown provider rather than silently falling back", async () => {
    process.env.PAYMENT_PROVIDER = "vnpay";
    const get = await loadGetter();
    expect(() => get()).toThrow(/Unknown PAYMENT_PROVIDER/);
  });

  it("tells the guest the truth: nothing is charged through the site", async () => {
    const instruction = await new ManualSettlementGateway().createIntent({
      reference: "booking-1",
      amountVnd: 500_000,
      description: "test",
    });
    expect(instruction.status).toBe("AWAITING_PAYMENT");
    expect(instruction.instructions).toMatch(/nothing is charged/i);
  });

  it("refuses to pretend it can verify a callback", async () => {
    await expect(new ManualSettlementGateway().verifyCallback({})).rejects.toThrow(
      /no gateway callback/i
    );
  });
});
