import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationBell from './NotificationBell';
import { api } from '../lib/api';
import { renderScreen, signIn } from '../test/helpers';

/**
 * The bell.
 *
 * The property worth pinning: the API stores a key and its values, and the
 * sentence is composed here. That is what lets a notification written
 * while the reader used English render in Vietnamese once they switch —
 * and it means a missing key shows as a raw type rather than silently
 * rendering nothing.
 */
const aNotification = (over = {}) => ({
  id: 'n1',
  type: 'BOOKING_CONFIRMED',
  params: { listing: "Two nights in Amí H'Bia's longhouse", date: '2026-09-01' },
  href: '#account',
  readAt: null,
  createdAt: '2026-08-15T00:00:00.000Z',
  ...over,
});

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.spyOn(api, 'unreadNotifications').mockResolvedValue({ unread: 2 });
    vi.spyOn(api, 'notifications').mockResolvedValue({ items: [aNotification()], unread: 2 });
  });

  it('renders nothing at all for a signed-out visitor, and asks for no count', async () => {
    renderScreen(<NotificationBell />);
    expect(screen.queryByRole('button', { name: /Notifications/i })).not.toBeInTheDocument();
    expect(api.unreadNotifications).not.toHaveBeenCalled();
  });

  it('shows the unread count on the bell', async () => {
    signIn();
    renderScreen(<NotificationBell />);
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('caps the badge rather than letting it stretch the button', async () => {
    signIn();
    api.unreadNotifications.mockResolvedValue({ unread: 47 });
    renderScreen(<NotificationBell />);
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('fetches the list only when the panel is opened', async () => {
    signIn();
    renderScreen(<NotificationBell />);
    await screen.findByText('2');
    expect(api.notifications).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    await waitFor(() => expect(api.notifications).toHaveBeenCalled());
  });

  it('composes the sentence from the key and its values', async () => {
    signIn();
    renderScreen(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/i }));

    // Not a stored string: both values are interpolated into the key here.
    const line = await screen.findByText(/Your booking for/);
    expect(line.textContent).toContain("Two nights in Amí H'Bia's longhouse");
    expect(line.textContent).toContain('2026-09-01');
    expect(line.textContent).toMatch(/is confirmed/);
  });

  it('links each notification to where it can be acted on', async () => {
    signIn();
    api.notifications.mockResolvedValue({
      items: [aNotification({ type: 'BOOKING_AWAITING_DECISION', href: '#dashboard' })],
      unread: 1,
    });
    renderScreen(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/i }));

    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '#dashboard');
  });

  it('marks everything read and clears the badge', async () => {
    signIn();
    vi.spyOn(api, 'readNotifications').mockResolvedValue({ marked: 2, unread: 0 });
    renderScreen(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Mark all read/i }));

    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument());
  });

  it('says so plainly when there is nothing', async () => {
    signIn();
    api.unreadNotifications.mockResolvedValue({ unread: 0 });
    api.notifications.mockResolvedValue({ items: [], unread: 0 });
    renderScreen(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/i }));

    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });

  it('stays quiet when the count cannot be fetched', async () => {
    signIn();
    api.unreadNotifications.mockRejectedValue(new Error('offline'));
    renderScreen(<NotificationBell />);

    // The bell is there; it simply carries no badge.
    expect(await screen.findByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});
