import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/useAuth';

const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * What has happened that this person should know about.
 *
 * The API stores a key and its values rather than a sentence, so the text
 * is composed here — which is what lets a notification written while the
 * reader was using English render in Vietnamese the moment they switch.
 *
 * Roles differ only in which keys they receive. A household gets
 * BOOKING_RECEIVED, a coordinator BOOKING_AWAITING_DECISION, a guest
 * BOOKING_CONFIRMED; the component treats them identically.
 */
export default function NotificationBell({ theme = 'dark' }) {
  const { t } = useTranslation();
  const { token, isAuthenticated } = useAuth();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const { unread: n } = await api.unreadNotifications(token);
        // Guarded: a reply arriving after the panel unmounts, or after a
        // sign-out, must not write to a component that is gone.
        if (!cancelled) setUnread(n);
      } catch {
        // A bell that cannot count is not worth an error on screen.
      }
    };

    // Cheap and periodic rather than a socket: this is a pilot, and the
    // count is one indexed query. Sixty seconds is well inside the time it
    // takes a coordinator to notice anything anyway.
    void tick();
    const timer = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAuthenticated, token]);

  // Close on a click elsewhere, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    try {
      const data = await api.notifications(token);
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      setItems([]);
    }
  }

  async function markAllRead() {
    try {
      const { unread: n } = await api.readNotifications({}, token);
      setUnread(n);
      setItems((rows) => rows.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() })));
    } catch {
      // Leave the badge as it was; the next poll will correct it.
    }
  }

  const isDark = theme === 'dark';
  const surface = isDark
    ? 'bg-ink border-bone/20 text-bone'
    : 'bg-bone border-ink/20 text-ink';
  const rule = isDark ? 'border-bone/10' : 'border-ink/10';
  const btnBorder = isDark
    ? 'border-bone/25 hover:border-bone/60'
    : 'border-ink/25 hover:border-ink/60';

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label={t('notifications.title')}
        title={t('notifications.title')}
        className={`relative inline-flex items-center justify-center w-8 h-8 border ${btnBorder} transition`}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            // A count, not a dot: "3 waiting" and "12 waiting" are
            // different amounts of work for a coordinator.
            className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 bg-kteh text-bone text-[10px] font-medium leading-[1.1rem] text-center rounded-full"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] border ${surface} shadow-xl z-50`}
        >
          <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${rule}`}>
            <span className="text-xs uppercase tracking-[0.2em] text-copper">
              {t('notifications.title')}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs underline underline-offset-4 opacity-70 hover:opacity-100"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center opacity-60">{t('notifications.empty')}</p>
          ) : (
            <ul className="max-h-[24rem] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className={`border-b ${rule} last:border-0`}>
                  <a
                    href={n.href ?? '#account'}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 transition ${
                      isDark ? 'hover:bg-bone/5' : 'hover:bg-ink/5'
                    } ${n.readAt ? 'opacity-55' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-kteh shrink-0" />
                      )}
                      <div className={n.readAt ? 'pl-3.5' : ''}>
                        <p className="text-sm leading-snug">
                          {t(`notifications.type.${n.type}`, n.params ?? {})}
                        </p>
                        <p className="text-[11px] opacity-50 mt-1">{dmy(n.createdAt)}</p>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
