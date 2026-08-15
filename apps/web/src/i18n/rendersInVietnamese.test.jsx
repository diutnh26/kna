import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import i18n from './index';
import { renderScreen } from '../test/helpers';
import { api } from '../lib/api';

import Travel from '../components/Travel';
import Marketplace from '../components/Marketplace';
import Explore from '../components/Explore';
import Community from '../components/Community';
import Assistant from '../components/Assistant';
import CarbonTracker from '../components/CarbonTracker';

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

  it('CarbonTracker, including its offset projects', async () => {
    await withVietnamese(<CarbonTracker />);
    expect(await screen.findByText(/Theo dõi carbon/)).toBeInTheDocument();
    // Appears twice: the project card and the sample ledger entry.
    expect(screen.getAllByText(/Trồng lại vùng đệm Yok Đôn/).length).toBeGreaterThan(0);
  });
});
