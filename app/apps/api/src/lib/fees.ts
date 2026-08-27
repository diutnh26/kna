// Fee schedule from the business plan (Part VI, §6.1):
//   Booking: 10% total — 7% retained by the platform, 3% to the Community Fund.
//   Marketplace: 5% flat, artisans keep the other 95%.
// Centralized here so the split is computed exactly once, the same way,
// everywhere it's needed (booking creation, order creation, the public ledger).
export const BOOKING_PLATFORM_RATE = 0.07;
export const BOOKING_COMMUNITY_FUND_RATE = 0.03;
export const MARKETPLACE_FEE_RATE = 0.05;

export function splitBooking(totalVnd: number) {
  const platformFeeVnd = Math.floor(totalVnd * BOOKING_PLATFORM_RATE);
  const communityFundVnd = Math.floor(totalVnd * BOOKING_COMMUNITY_FUND_RATE);
  const providerPayoutVnd = totalVnd - platformFeeVnd - communityFundVnd;
  return { platformFeeVnd, communityFundVnd, providerPayoutVnd };
}

export function splitOrder(totalVnd: number) {
  const marketplaceFeeVnd = Math.round(totalVnd * MARKETPLACE_FEE_RATE);
  const artisanPayoutVnd = totalVnd - marketplaceFeeVnd;
  return { marketplaceFeeVnd, artisanPayoutVnd };
}
