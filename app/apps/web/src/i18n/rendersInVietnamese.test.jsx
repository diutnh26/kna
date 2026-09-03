import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import i18n from './index';
import { renderScreen, signIn } from '../test/helpers';
import { api } from '../lib/api';

import Travel from '../components/Travel';
import Marketplace from '../components/Marketplace';
import Explore from '../components/Explore';
import Community from '../components/Community';
import Assistant from '../components/Assistant';
import CarbonTracker from '../components/CarbonTracker';
import Account from '../components/Account';
import Landing from '../components/Landing';
import Navbar from '../components/Navbar';
import Dashboard from '../components/Dashboard';
import Review from '../components/Review';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/useAuth';

/**
 * AuthModal renders nothing until AuthContext says it is open, and it takes
 * no props — so mounting it alone tests an early return. This opens it the
 * way the navbar's sign-in button does.
 */
function OpenedAuthModal() {
  const { openAuthModal, modalOpen } = useAuth();
  if (!modalOpen) openAuthModal();
  return <AuthModal />;
}

/**
 * Proves the screens actually render Vietnamese, rather than merely having
 * Vietnamese keys defined.
 *
 * locales.test.js checks the two files agree. That is necessary and not
 * sufficient: for months every key here existed in Vietnamese while the
 * components ignored i18n entirely and rendered hardcoded English. Parity
 * would have passed the whole time.
 *
 * So each screen is mounted under the vi locale and asserted to show
 * Vietnamese text it can only produce by going through t().
 */
describe('screens render in Vietnamese', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  const withVietnamese = async (ui) => {
    await i18n.changeLanguage('vi');
    renderScreen(ui);
  };

  it('Travel', async () => {
    vi.spyOn(api, 'listings').mockResolvedValue([]);
    await withVietnamese(<Travel />);
    expect(await screen.findByText(/Trải nghiệm tại Đắk Lắk/)).toBeInTheDocument();
    expect(screen.getByText(/“Đã xác minh” ở đây nghĩa là gì/)).toBeInTheDocument();
  });

  it('Marketplace', async () => {
    vi.spyOn(api, 'products').mockResolvedValue([]);
    vi.spyOn(api, 'communityStats').mockResolvedValue({ verifiedArtisans: 5, buonOnboarded: 4 });
    await withVietnamese(<Marketplace />);
    expect(await screen.findByText(/Chợ cộng đồng/)).toBeInTheDocument();
    expect(screen.getByText(/ở lại với nghệ nhân/)).toBeInTheDocument();
  });

  it('Explore', async () => {
    vi.spyOn(api, 'archiveTypes').mockResolvedValue([]);
    vi.spyOn(api, 'archivePillars').mockResolvedValue([]);
    vi.spyOn(api, 'archivePhrases').mockResolvedValue([]);
    vi.spyOn(api, 'archiveStats').mockResolvedValue({ publishedEntries: 6, contributingBuon: 4 });
    vi.spyOn(api, 'archive').mockResolvedValue([]);
    await withVietnamese(<Explore />);
    expect(await screen.findByText(/Kho lưu trữ di sản văn hoá số/)).toBeInTheDocument();
  });

  it('Community', async () => {
    vi.spyOn(api, 'communityStats').mockResolvedValue({ committeeMembers: 6 });
    vi.spyOn(api, 'committee').mockResolvedValue([]);
    vi.spyOn(api, 'fund').mockResolvedValue([]);
    vi.spyOn(api, 'decisions').mockResolvedValue([]);
    vi.spyOn(api, 'ledger').mockResolvedValue([]);
    await withVietnamese(<Community />);
    expect(await screen.findByText(/Không gian cộng đồng/)).toBeInTheDocument();
  });

  it('Assistant, including its scripted replies', async () => {
    await withVietnamese(<Assistant />);
    expect(await screen.findByText(/Trợ lý du lịch/)).toBeInTheDocument();
    // The canned prompts are content, not chrome — they must translate too.
    expect(screen.getByText(/Tôi nên chào người lớn tuổi thế nào/)).toBeInTheDocument();
  });

  it('Account', async () => {
    // Signed out is enough: the sign-in prompt is the screen's own copy.
    await withVietnamese(<Account />);
    expect(await screen.findByText(/Tài khoản của bạn/)).toBeInTheDocument();
    expect(screen.getByText(/Đăng nhập để xem tài khoản của bạn/)).toBeInTheDocument();
  });

  it('CarbonTracker, including its offset projects', async () => {
    await withVietnamese(<CarbonTracker />);
    expect(await screen.findByText(/Theo dõi carbon/)).toBeInTheDocument();
    // Appears twice: the project card and the sample ledger entry.
    expect(screen.getAllByText(/Trồng lại vùng đệm Yok Đôn/).length).toBeGreaterThan(0);
  });

  /**
   * The check that would have caught the three leftovers this file missed.
   *
   * Asserting one Vietnamese string per screen only proves the screen went
   * through t() at all. It cannot see a paragraph that was never wired —
   * and three survived: two tails left behind when a multi-line English
   * paragraph was regex-replaced by only its first lines, and one whole
   * paragraph in the assistant that no key ever covered.
   *
   * Every API call is stubbed empty, so anything rendered is the screen's
   * own chrome. English function words are the tell: Vietnamese uses none
   * of them, so " the " appearing under the vi locale means untranslated
   * source text, not data.
   */
  it.each([
    ['Travel', () => <Travel />, 200],
    ['Marketplace', () => <Marketplace />, 200],
    ['Explore', () => <Explore />, 200],
    ['Community', () => <Community />, 200],
    ['Assistant', () => <Assistant />, 200],
    ['CarbonTracker', () => <CarbonTracker />, 200],
    ['Account', () => <Account />, 200],
    ['Landing', () => <Landing />, 200],
    // Chrome, not a page: a handful of labels is the whole component.
    ['Navbar', () => <Navbar />, 40],
    // Signed in as somebody who sees the coordination queue, otherwise the
    // screen is just its sign-in gate.
    ['Dashboard', () => <Dashboard />, 200, () => signIn({ role: 'COORDINATOR' })],
    ['Review', () => <Review />, 200, () => signIn({ isCommitteeMember: true, committeeRole: 'Chair' })],
    // Two tabs, two field labels and a button — that is the whole form.
    ['AuthModal', () => <OpenedAuthModal />, 40],
  ])('%s renders no untranslated English', async (_name, render, floor = 200, arrange) => {
    arrange?.();
    for (const method of Object.keys(api)) {
      // `me` is left alone: renderScreen gives it a session-aware stub, and
      // overriding it here leaves AuthProvider waiting forever — which
      // renders an empty tree that passes an English check trivially.
      if (method !== 'me' && typeof api[method] === 'function') {
        vi.spyOn(api, method).mockResolvedValue([]);
      }
    }
    // The few that must be objects rather than arrays.
    vi.spyOn(api, 'communityStats').mockResolvedValue({});
    vi.spyOn(api, 'archiveStats').mockResolvedValue({});
    vi.spyOn(api, 'unreadNotifications').mockResolvedValue({ unread: 0 });

    await withVietnamese(render());
    // Long enough for the session lookup and the screen's own fetches to
    // settle; findBy* is no use here because there is no one known string.
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(floor));

    const text = ` ${document.body.textContent.replace(/\s+/g, ' ')} `;
    const english = [' the ', ' and ', ' with ', ' that ', ' your ', ' from ', ' this ', ' they '];
    // Without this the check is vacuous: a screen that renders nothing —
    // an auth gate, a failed mock — contains no English either, and would
    // pass while testing nothing at all.
    expect(text.length, `${_name} rendered almost nothing`).toBeGreaterThan(floor);

    const hits = english.filter((w) => text.includes(w));

    expect(hits, `untranslated English in ${_name}: ${hits.join(', ')}`).toEqual([]);
  });

});
