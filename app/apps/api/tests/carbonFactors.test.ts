import { describe, expect, it } from "vitest";
import { computeKgCo2e } from "../src/lib/carbonFactors";

describe("computeKgCo2e", () => {
  it("scales travel and stay by guests", () => {
    // hcmc flight 150 + 1 night stay 4 + local 3, × 2 guests
    expect(
      computeKgCo2e({ origin: "hcmc", travelMode: "flight", nights: 1, guests: 2 })
    ).toBe(150 * 2 + 4 * 2 + 3 * 2);
  });

  it("rejects coach for international origins", () => {
    expect(() =>
      computeKgCo2e({ origin: "europe", travelMode: "coach", nights: 2, guests: 1 })
    ).toThrow(/not available/i);
  });
});
