import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { api, ApiError } from '../lib/api';

const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

/**
 * The provider verifies their calendar here: open a range of days (at the
 * listing's rooms, or seats for an experience) or close it. Guests book open
 * days instantly — this is the only approval there is. Closing never takes
 * back a room that is already booked.
 */
function ListingCalendar({ listing }) {
  const { t } = useTranslation();
  const start = todayUtc();
  const [days, setDays] = useState([]);
  const [from, setFrom] = useState(ymd(start));
  const [to, setTo] = useState(ymd(addDays(start, 29)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const first = ymd(start);

  useEffect(() => {
    let cancelled = false;
    api
      .listingAvailability(listing.id, first, ymd(addDays(new Date(`${first}T00:00:00Z`), 29)))
      .then((res) => !cancelled && setDays(res.days))
      .catch(() => !cancelled && setDays([]));
    return () => {
      cancelled = true;
    };
  }, [listing.id, first, reload]);

  async function set(open) {
    setBusy(true);
    setError('');
    try {
      await api.setAvailability(listing.id, { from, to, open });
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('calendar.error'));
    } finally {
      setBusy(false);
    }
  }

  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const strip = Array.from({ length: 30 }, (_, i) => ymd(addDays(start, i)));

  return (
    <article className="border border-bone/15 p-5 space-y-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg">{listing.title}</h3>
        <span className="text-xs text-bone/50">
          {listing.unit === 'per night'
            ? t('calendar.rooms', { count: listing.inventory ?? 1 })
            : t('calendar.seats', { count: listing.inventory ?? 1 })}
        </span>
      </div>

      <div className="grid grid-cols-10 sm:grid-cols-[repeat(15,minmax(0,1fr))] gap-1" role="list" aria-label={t('calendar.next30')}>
        {strip.map((date) => {
          const d = byDate[date];
          const cls = !d
            ? 'border-bone/10 text-bone/25'
            : d.available === 0
              ? 'border-kteh/50 text-kteh'
              : 'border-sage/40 text-sage';
          return (
            <div
              key={date}
              role="listitem"
              title={d ? t('calendar.dayTitle', { date, available: d.available, capacity: d.capacity }) : t('calendar.closedDay', { date })}
              className={`border text-center py-1 text-[10px] leading-tight ${cls}`}
            >
              <div>{date.slice(8)}</div>
              <div>{d ? d.available : '–'}</div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-bone/45">{t('calendar.legend')}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs">
          <span className="block text-bone/60">{t('calendar.from')}</span>
          <input type="date" value={from} min={ymd(start)} onChange={(e) => setFrom(e.target.value)} className="bg-transparent border border-bone/25 px-2 py-1 [color-scheme:dark]" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block text-bone/60">{t('calendar.to')}</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="bg-transparent border border-bone/25 px-2 py-1 [color-scheme:dark]" />
        </label>
        <button type="button" disabled={busy} onClick={() => set(true)} className="bg-[#3F6146] hover:bg-[#35543B] px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-50">
          {t('calendar.open')}
        </button>
        <button type="button" disabled={busy} onClick={() => set(false)} className="border border-kteh/50 text-kteh px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-50">
          {t('calendar.close')}
        </button>
      </div>
      {error ? <p className="text-xs text-kteh">{error}</p> : null}
    </article>
  );
}

export default function ProviderCalendar({ listings }) {
  const { t } = useTranslation();
  if (!listings?.length) return null;
  return (
    <section aria-label={t('calendar.title')} className="space-y-4">
      <h2 className="font-display text-3xl font-medium flex items-center gap-3">
        <CalendarDays className="w-6 h-6 text-copper" />
        {t('calendar.title')}
      </h2>
      <p className="text-sm text-bone/55 max-w-2xl">{t('calendar.intro')}</p>
      {listings.map((l) => (
        <ListingCalendar key={l.id} listing={l} />
      ))}
    </section>
  );
}
