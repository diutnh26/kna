import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { useWallet } from '../wallet/WalletProvider';
import { vnToday } from '../lib/dates';

const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')} ₫`;
const day = (iso) => (iso ? String(iso).slice(0, 10) : '');

const STATUS_CLASS = {
  CONFIRMED: 'text-amber border-amber/40',
  UNPAID: 'text-kteh border-kteh/50',
  COMPLETED: 'text-sage border-sage/40',
  CANCELLED: 'text-bone/40 border-bone/20',
  PENDING: 'text-copper border-copper/40',
};

/**
 * The guest's stays: booked (dates held), then paid on the check-out date
 * from their wallet. Pay opens on that date; before check-in a stay can be
 * cancelled. Every stay links to its public trace.
 */
export default function MyTrips() {
  const { t } = useTranslation();
  const { signAndSendTransaction, connect, connected } = useWallet();
  const [bookings, setBookings] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [errors, setErrors] = useState({});

  const refresh = useCallback(async () => setBookings(await api.myBookings()), []);
  useEffect(() => {
    refresh().catch(() => setBookings([]));
  }, [refresh]);

  async function act(id, fn) {
    setBusyId(id);
    setErrors((e) => ({ ...e, [id]: null }));
    try {
      await fn();
      await refresh();
    } catch (err) {
      const needsTopUp = err instanceof ApiError && err.status === 402;
      setErrors((e) => ({
        ...e,
        [id]: { text: err.message ?? t('trips.actionError'), needsTopUp },
      }));
    } finally {
      setBusyId(null);
    }
  }

  const pay = (id) =>
    act(id, async () => {
      const res = await api.payBooking(id);
      if (res?.needsSignature) {
        if (!connected) await connect();
        const signature = await signAndSendTransaction(res.transactionBase64);
        await api.confirmBookingPayment(id, signature);
      }
    });

  const cancel = (id) => act(id, () => api.cancelBooking(id));

  if (!bookings) return null;
  const today = vnToday();

  return (
    <section aria-label={t('trips.title')} className="space-y-4">
      <h2 className="font-display text-3xl font-medium">{t('trips.title')}</h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-bone/60 border border-dashed border-bone/20 py-10 text-center">
          {t('trips.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const checkOut = day(b.checkOut);
            const payable = b.status === 'CONFIRMED' || b.status === 'UNPAID';
            const open = payable && checkOut && today >= checkOut;
            const cancellable = b.status === 'CONFIRMED' && today < day(b.checkIn);
            const err = errors[b.id];
            return (
              <li key={b.id} className="border border-bone/15 p-5 flex flex-wrap items-start gap-5 text-sm">
                <span
                  className={`text-[10px] uppercase tracking-[0.15em] border px-3 py-1.5 shrink-0 ${STATUS_CLASS[b.status] ?? ''}`}
                >
                  {t(`trips.status.${b.status}`)}
                </span>
                <div className="flex-1 min-w-[220px] space-y-1">
                  <div>{b.listing?.title}</div>
                  <div className="text-xs text-bone/50">
                    {t('trips.dates', { checkIn: day(b.checkIn), checkOut })} ·{' '}
                    {t('trips.rooms', { count: b.rooms ?? 1 })}
                  </div>
                  {payable && !open && checkOut ? (
                    <div className="text-xs text-bone/50">{t('trips.payOpens', { date: checkOut })}</div>
                  ) : null}
                  {b.status === 'UNPAID' ? <div className="text-xs text-kteh">{t('trips.unpaidNote')}</div> : null}
                  <a href={`#trace?q=${b.id}`} className="text-xs underline text-bone/60">
                    {t('trips.trace')}
                  </a>
                </div>
                <div className="text-right shrink-0 space-y-2">
                  <div className="font-mono text-amber">{vnd(b.totalVnd)}</div>
                  <div className="flex gap-2 justify-end">
                    {payable ? (
                      <button
                        type="button"
                        onClick={() => pay(b.id)}
                        disabled={!open || busyId === b.id}
                        className="bg-kteh hover:bg-kteh-hover disabled:opacity-40 px-4 py-2 text-xs uppercase tracking-wider"
                      >
                        {busyId === b.id ? t('trips.paying') : t('trips.pay')}
                      </button>
                    ) : null}
                    {cancellable ? (
                      <button
                        type="button"
                        onClick={() => cancel(b.id)}
                        disabled={busyId === b.id}
                        className="border border-bone/25 px-3 py-2 text-xs disabled:opacity-40"
                      >
                        {t('trips.cancel')}
                      </button>
                    ) : null}
                  </div>
                </div>
                {err ? (
                  <p className="w-full text-xs text-kteh">
                    {err.text}{' '}
                    {err.needsTopUp ? (
                      <span className="text-bone/60">{t('trips.topUpHint')}</span>
                    ) : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
