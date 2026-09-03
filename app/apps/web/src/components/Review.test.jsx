import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Review from './Review';
import { api, ApiError } from '../lib/api';
import { renderScreen, signIn } from '../test/helpers';

const pending = (over = {}) => ({
  id: 'a1',
  type: 'Craft record',
  title: 'Dyeing indigo, three vats',
  meta: 'Photo essay · 26 frames',
  keeperBuon: 'Buôn Trấp',
  pillar: 'Weaving',
  createdAt: '2026-08-01T00:00:00.000Z',
  contributedBy: { fullName: 'Amí Lan' },
  ...over,
});

/**
 * The review console is where "reviewed by elders before publication" stops
 * being a claim. These tests guard the gate: who sees the queue, and that a
 * refusal cannot be filed without a reason.
 */
describe('Review', () => {
  it('asks an anonymous visitor to sign in, and does not fetch the queue', async () => {
    const queue = vi.spyOn(api, 'reviewQueue');
    renderScreen(<Review />);
    expect(await screen.findByText(/Sign in to continue/)).toBeInTheDocument();
    expect(queue).not.toHaveBeenCalled();
  });

  it('refuses a signed-in guest, explaining that seats are nominated by a buôn', async () => {
    signIn();
    const queue = vi.spyOn(api, 'reviewQueue');
    renderScreen(<Review />);
    expect(await screen.findByText(/This queue belongs to the Committee/)).toBeInTheDocument();
    expect(screen.getByText(/nominated by each buôn/)).toBeInTheDocument();
    expect(queue).not.toHaveBeenCalled();
  });

  it('admits a provider who holds a seat, even though their role is PROVIDER', async () => {
    signIn({ role: 'PROVIDER', isCommitteeMember: true, committeeRole: 'Chair · elder' });
    vi.spyOn(api, 'reviewQueue').mockResolvedValue([pending()]);
    vi.spyOn(api, 'reviewedEntries').mockResolvedValue([]);

    renderScreen(<Review />);

    expect(await screen.findByRole('heading', { name: /Dyeing indigo/ })).toBeInTheDocument();
    expect(screen.getByText(/Chair · elder/)).toBeInTheDocument();
  });

  it('publishes an entry and refreshes the queue', async () => {
    signIn({ isCommitteeMember: true, committeeRole: 'Chair · elder' });
    vi.spyOn(api, 'reviewQueue').mockResolvedValueOnce([pending()]).mockResolvedValueOnce([]);
    vi.spyOn(api, 'reviewedEntries').mockResolvedValue([]);
    const review = vi.spyOn(api, 'reviewEntry').mockResolvedValue({ id: 'a1', moderationStatus: 'PUBLISHED' });

    renderScreen(<Review />);
    await screen.findByRole('heading', { name: /Dyeing indigo/ });

    await userEvent.click(screen.getByRole('button', { name: /Publish to the archive/ }));

    await waitFor(() => expect(review).toHaveBeenCalled());
    const [id, payload] = review.mock.calls[0];
    expect(id).toBe('a1');
    expect(payload.decision).toBe('publish');
  });

  it('sends the reason with a refusal, and surfaces the server error if it is missing', async () => {
    signIn({ isCommitteeMember: true });
    vi.spyOn(api, 'reviewQueue').mockResolvedValue([pending()]);
    vi.spyOn(api, 'reviewedEntries').mockResolvedValue([]);
    const review = vi
      .spyOn(api, 'reviewEntry')
      .mockRejectedValue(new ApiError('A reason is required when refusing an entry.', 400));

    renderScreen(<Review />);
    await screen.findByRole('heading', { name: /Dyeing indigo/ });

    await userEvent.click(screen.getByRole('button', { name: /Refuse/ }));

    expect(
      await screen.findByText('A reason is required when refusing an entry.')
    ).toBeInTheDocument();
    expect(review.mock.calls[0][1].decision).toBe('reject');
  });

  it('passes the typed reason through to the API', async () => {
    signIn({ isCommitteeMember: true });
    vi.spyOn(api, 'reviewQueue').mockResolvedValue([pending()]);
    vi.spyOn(api, 'reviewedEntries').mockResolvedValue([]);
    const review = vi.spyOn(api, 'reviewEntry').mockResolvedValue({ moderationStatus: 'REJECTED' });

    renderScreen(<Review />);
    await screen.findByRole('heading', { name: /Dyeing indigo/ });

    await userEvent.type(screen.getByLabelText(/Reason/i), 'Ceremonial content.');
    await userEvent.click(screen.getByRole('button', { name: /Refuse/ }));

    await waitFor(() => expect(review).toHaveBeenCalled());
    expect(review.mock.calls[0][1].note).toBe('Ceremonial content.');
  });

  it('shows refusals in the decided record, with their reason', async () => {
    signIn({ isCommitteeMember: true });
    vi.spyOn(api, 'reviewQueue').mockResolvedValue([]);
    vi.spyOn(api, 'reviewedEntries').mockResolvedValue([
      {
        id: 'a9',
        type: 'Recording',
        title: 'Funeral gongs, slow cycle',
        keeperBuon: 'Buôn Trấp',
        moderationStatus: 'REJECTED',
        moderatedAt: '2026-05-14T00:00:00.000Z',
        moderatedBy: { fullName: "Amí H'Bia" },
        moderationNote: 'Funeral practice is not published material.',
      },
    ]);

    renderScreen(<Review />);

    expect(await screen.findByText('Refused')).toBeInTheDocument();
    expect(screen.getByText(/Funeral practice is not published material/)).toBeInTheDocument();
  });
});
