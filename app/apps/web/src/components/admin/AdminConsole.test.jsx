import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminConsole from './AdminConsole';
import { api } from '../../lib/api';
import { renderScreen, signIn, signOut } from '../../test/helpers';

const LISTINGS = {
  name: 'listings',
  group: 'catalog',
  titleField: 'title',
  fields: [
    { name: 'imageUrl', type: 'image', list: true, create: true, edit: true },
    { name: 'title', type: 'text', list: true, create: true, edit: true, required: true },
    { name: 'priceVnd', type: 'money', list: true, create: true, edit: true, required: true },
    { name: 'published', type: 'boolean', list: true, create: true, edit: true },
  ],
  search: ['title'],
  filters: ['published'],
  notice: null,
  canCreate: true,
  canUpdate: true,
  canRemove: true,
  actions: [],
};
const BOOKINGS = {
  name: 'bookings',
  group: 'money',
  titleField: 'id',
  fields: [
    { name: 'id', type: 'mono', list: true },
    { name: 'status', type: 'select', options: ['CONFIRMED', 'CANCELLED'], list: true },
  ],
  search: ['id'],
  filters: ['status'],
  notice: null,
  canCreate: false,
  canUpdate: false,
  canRemove: false,
  actions: [{ name: 'cancel', fields: [], reason: true, danger: true }],
};

beforeEach(() => {
  window.location.hash = '#admin?r=listings';
  vi.spyOn(api, 'adminMeta').mockResolvedValue({ resources: [LISTINGS, BOOKINGS] });
});
afterEach(() => {
  signOut();
  window.location.hash = '';
});

describe('AdminConsole', () => {
  it('is not shown to anyone but an admin', async () => {
    signIn({ role: 'COORDINATOR' });
    renderScreen(<AdminConsole />);
    expect(await screen.findByText(/This console is for KNĂ admins/)).toBeInTheDocument();
    expect(api.adminMeta).not.toHaveBeenCalled();
  });

  it('lists a resource and creates a record from its fields', async () => {
    const user = userEvent.setup();
    signIn({ role: 'ADMIN' });
    vi.spyOn(api, 'adminList').mockResolvedValue({
      rows: [{ id: 'l1', title: 'Longhouse', priceVnd: 500000, published: true, imageUrl: null }],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const create = vi.spyOn(api, 'adminCreate').mockResolvedValue({ id: 'l2' });

    renderScreen(<AdminConsole />);
    expect(await screen.findByText('Longhouse')).toBeInTheDocument();
    expect(screen.getByText('500.000 ₫')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /New/ }));
    await user.type(await screen.findByLabelText(/Title/), 'River room');
    await user.type(screen.getByLabelText(/Price \(VND\)/), '400000');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith('listings', { title: 'River room', priceVnd: 400000, published: false }));
    await waitFor(() => expect(window.location.hash).toBe('#admin?r=listings&id=l2'));
  });

  it('runs a money action only with a reason, and never offers edit or delete', async () => {
    const user = userEvent.setup();
    signIn({ role: 'ADMIN' });
    window.location.hash = '#admin?r=bookings&id=b1';
    vi.spyOn(api, 'adminGet').mockResolvedValue({ record: { id: 'b1', status: 'CONFIRMED' }, actions: ['cancel'] });
    vi.spyOn(api, 'adminHistory').mockResolvedValue([]);
    const action = vi.spyOn(api, 'adminAction').mockResolvedValue({ ok: true });

    renderScreen(<AdminConsole />);
    const main = await screen.findByRole('main');
    await within(main).findByRole('heading', { name: 'b1' });
    expect(within(main).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(within(main).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();

    await user.click(within(main).getByRole('button', { name: 'Cancel' }));
    await user.type(screen.getByLabelText(/Reason/), 'Host emergency');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith('bookings', 'b1', 'cancel', { reason: 'Host emergency' })
    );
  });
});
