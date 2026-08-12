import { describe, expect, it } from "vitest";
import { splitBooking, splitOrder } from "../src/lib/fees";

/**
 * The fee split is the single highest-stakes calculation in the codebase:
 * it decides what reaches a household, and it is published on a ledger the
 * community is invited to audit. These tests exist mostly to guard the
 * property that matters — the parts always sum to the whole, with no
 * rounding dust silently accruing to the platform.
 */
describe("splitBooking — 7% platform / 3% Community Fund / 90% provider", () => {
  it("splits a clean figure exactly", () => {
    expect(splitBooking(1_000_000)).toEqual({
      platformFeeVnd: 70_000,
      communityFundVnd: 30_000,
      providerPayoutVnd: 900_000,
    });
  });

  it("never loses or invents a đồng to rounding", () => {
    // Awkward amounts where 7% and 3% both land off a whole đồng.
    for (const total of [1, 7, 13, 99, 333, 12_345, 999_999, 1_234_567, 7_777_777]) {
      const { platformFeeVnd, communityFundVnd, providerPayoutVnd } = splitBooking(total);
      expect(platformFeeVnd + communityFundVnd + providerPayoutVnd).toBe(total);
    }
  });

  it("gives the rounding remainder to the provider, never the platform", () => {
    // 13 * 0.07 = 0.91 -> 1, 13 * 0.03 = 0.39 -> 0, so the provider
    // absorbs the difference rather than the fees being rounded up.
    const { platformFeeVnd, communityFundVnd, providerPayoutVnd } = splitBooking(13);
    expect(platformFeeVnd + communityFundVnd).toBeLessThanOrEqual(Math.ceil(13 * 0.1));
    expect(providerPayoutVnd).toBe(13 - platformFeeVnd - communityFundVnd);
  });

  it("keeps the provider's share at or above 89% for realistic bookings", () => {
    for (const total of [300_000, 500_000, 850_000, 1_200_000, 4_200_000]) {
      const { providerPayoutVnd } = splitBooking(total);
      expect(providerPayoutVnd / total).toBeGreaterThanOrEqual(0.89);
    }
  });

  it("handles zero without producing negative payouts", () => {
    expect(splitBooking(0)).toEqual({
      platformFeeVnd: 0,
      communityFundVnd: 0,
      providerPayoutVnd: 0,
    });
  });
});

describe("splitOrder — 5% marketplace fee, artisan keeps 95%", () => {
  it("splits a clean figure exactly", () => {
    expect(splitOrder(950_000)).toEqual({
      marketplaceFeeVnd: 47_500,
      artisanPayoutVnd: 902_500,
    });
  });

  it("never loses or invents a đồng to rounding", () => {
    for (const total of [1, 7, 99, 12_345, 999_999, 4_200_000]) {
      const { marketplaceFeeVnd, artisanPayoutVnd } = splitOrder(total);
      expect(marketplaceFeeVnd + artisanPayoutVnd).toBe(total);
    }
  });

  it("keeps the artisan's share at or above 95%", () => {
    for (const total of [320_000, 780_000, 1_650_000, 2_800_000, 4_200_000]) {
      const { artisanPayoutVnd } = splitOrder(total);
      expect(artisanPayoutVnd / total).toBeGreaterThanOrEqual(0.95);
    }
  });
});
