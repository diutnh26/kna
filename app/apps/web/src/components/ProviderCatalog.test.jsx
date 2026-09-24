import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProviderCatalog from './ProviderCatalog';
import { api } from '../lib/api';
import '../i18n';

const provider = { id: 'p1', displayName: "H'Bia household", buon: 'Buôn Akô Dhông', verified: true, bio: null, imageUrl: null };
const listing = {
  id: 'l1',
  title: 'Longhouse room',
  category: 'STAY',
  priceVnd: 500000,
  unit: 'per night',
  inventory: 2,
  maxGuestsPerRoom: 2,
  published: true,
  blurb: 'A room.',
  duration: '1 night',
  groupSize: 'Up to 2',
  carbonRating: 'Low',
  imageUrl: null,
};

describe('ProviderCatalog', () => {
  it('uploads a photograph for a listing and saves only what changed', async () => {
    const user = userEvent.setup();
    const upload = vi.spyOn(api, 'uploadImage').mockResolvedValue({ url: 'https://api.example/images/img1' });
    const update = vi.spyOn(api, 'updateMyListing').mockResolvedValue({ ...listing });
    const changed = vi.fn();
    render(<ProviderCatalog provider={provider} listings={[listing]} products={[]} onChanged={changed} />);

    await user.click(screen.getAllByRole('button', { name: /Edit/ })[1]);
    const file = new File(['x'], 'room.png', { type: 'image/png' });
    await user.upload(screen.getByTestId('field-imageUrl-file'), file);
    await waitFor(() => expect(upload).toHaveBeenCalledWith(file));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('l1', { imageUrl: 'https://api.example/images/img1' }));
    expect(changed).toHaveBeenCalled();
  });

  it('explains when removing a booked listing only unpublished it', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'deleteMyListing').mockResolvedValue({ outcome: 'unpublished' });
    render(<ProviderCatalog provider={provider} listings={[listing]} products={[]} onChanged={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: /Remove/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText(/has bookings or orders, so it was unpublished/)).toBeInTheDocument();
  });

  it('tells an unverified household why it cannot publish yet', () => {
    render(
      <ProviderCatalog provider={{ ...provider, verified: false }} listings={[]} products={[]} onChanged={vi.fn()} />
    );
    expect(screen.getAllByText(/not verified yet/)).toHaveLength(2);
  });
});
