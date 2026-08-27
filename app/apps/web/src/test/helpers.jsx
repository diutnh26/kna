import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from '../context/AuthProvider';
import { WalletProvider } from '../wallet/WalletProvider';
import { api, ApiError } from '../lib/api';
import '../i18n';

/**
 * Renders a screen inside the providers App.jsx would give it.
 */
export function renderScreen(ui) {
  if (!vi.isMockFunction(api.me)) {
    vi.spyOn(api, 'me').mockImplementation(async () => {
      const stored = localStorage.getItem('kna-auth');
      if (!stored) throw new ApiError('Sign in required.', 401);
      return { user: JSON.parse(stored).user };
    });
  }
  if (!vi.isMockFunction(api.walletMe)) {
    vi.spyOn(api, 'walletMe').mockResolvedValue(null);
  }
  return render(
    <WalletProvider>
      <AuthProvider>{ui}</AuthProvider>
    </WalletProvider>
  );
}

/** Puts a signed-in session in localStorage before AuthProvider reads it. */
export function signIn(user = {}) {
  localStorage.setItem(
    'kna-auth',
    JSON.stringify({
      token: 'test-token',
      user: {
        id: 'u1',
        email: 'demo@example.kna',
        fullName: 'Demo Traveler',
        role: 'GUEST',
        locale: 'en',
        isCommitteeMember: false,
        committeeRole: null,
        provider: null,
        ...user,
      },
    })
  );
}

export const aListing = (over = {}) => ({
  id: 'l1',
  category: 'STAY',
  title: "Two nights in Amí H'Bia's longhouse",
  blurb: 'A working family home, not a guesthouse.',
  priceVnd: 500000,
  unit: 'per night',
  duration: '2 nights',
  groupSize: 'Up to 4 guests',
  carbonRating: 'Low',
  customs: 'Remove shoes at the ladder.',
  provider: { displayName: "Amí H'Bia", buon: 'Buôn Akô Dhông' },
  ...over,
});

export const aProduct = (over = {}) => ({
  id: 'p1',
  category: 'Basketry',
  title: 'Gùi carrying basket, rattan and bamboo',
  note: 'The everyday shape, still made the everyday way.',
  priceVnd: 950000,
  stock: 6,
  provider: { displayName: 'Y Blă Êban', buon: 'Buôn Đôn' },
  ...over,
});

export const aLedgerEntry = (over = {}) => ({
  id: 'le1',
  bookingId: 'b1',
  orderId: null,
  fromLabel: 'Traveler #4821',
  toLabel: "Amí H'Bia",
  totalVnd: 1000000,
  platformFeeVnd: 70000,
  communityFundVnd: 30000,
  createdAt: '2026-08-14T07:22:00.000Z',
  ...over,
});
