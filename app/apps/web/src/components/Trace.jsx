import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Search } from 'lucide-react';
import Navbar from './Navbar';
import { api, ApiError } from '../lib/api';

const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')} ₫`;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** `#trace?q=…` — a wallet address or a booking reference. */
function queryFromHash() {
  const i = window.location.hash.indexOf('?');
  return i < 0 ? '' : new URLSearchParams(window.location.hash.slice(i + 1)).get('q') ?? '';
}

function Link({ href, children }) {
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="underline text-amber inline-flex items-center gap-1 break-all">
      {children} <ExternalLink className="w-3 h-3 shrink-0" />
    </a>
  ) : (
    <span className="text-bone/40">—</span>
  );
}

function BookingTrace({ data }) {
  const { t } = useTranslation();
  const rows = [
    ['guest', data.wallets.guest],
    ['provider', data.wallets.provider],
    ['communityFund', data.wallets.communityFund],
    ['platform', data.wallets.platform],
  ];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">{data.listing}</h2>
        <p className="text-sm text-bone/60">
          {data.host} · {String(data.checkIn).slice(0, 10)} → {String(data.checkOut).slice(0, 10)} ·{' '}
          {t(`trips.status.${data.status}`)}
        </p>
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <dt className="text-bone/60">{t('trace.total')}</dt>
        <dd className="font-mono">{vnd(data.split.totalVnd)}</dd>
        <dt className="text-bone/60">{t('trace.toProvider')}</dt>
        <dd className="font-mono">{vnd(data.split.providerVnd)}</dd>
        <dt className="text-bone/60">{t('trace.toFund')}</dt>
        <dd className="font-mono">{vnd(data.split.communityFundVnd)}</dd>
        <dt className="text-bone/60">{t('trace.toPlatform')}</dt>
        <dd className="font-mono">{vnd(data.split.platformVnd)}</dd>
      </dl>
      <div className="space-y-2 text-sm">
        <h3 className="uppercase tracking-wider text-xs text-copper">{t('trace.wallets')}</h3>
        {rows.map(([key, w]) => (
          <div key={key} className="flex flex-wrap gap-3">
            <span className="w-40 text-bone/60">{t(`trace.wallet.${key}`)}</span>
            {w ? <a href={`#trace?q=${w.address}`} className="font-mono underline break-all">{w.address}</a> : <span className="text-bone/40">—</span>}
          </div>
        ))}
      </div>
      <div className="space-y-2 text-sm">
        <h3 className="uppercase tracking-wider text-xs text-copper">{t('trace.transactions')}</h3>
        {['recorded', 'paid', 'attested', 'finalized'].map((k) => (
          <div key={k} className="flex flex-wrap gap-3">
            <span className="w-40 text-bone/60">{t(`trace.tx.${k}`)}</span>
            <Link href={data.transactions[k]?.explorer}>{data.transactions[k]?.signature.slice(0, 16)}…</Link>
          </div>
        ))}
      </div>
      {data.onchain ? (
        <p className={`text-sm ${data.onchain.matchesLedger ? 'text-sage' : 'text-kteh'}`}>
          {data.onchain.matchesLedger
            ? t('trace.matches', { status: data.onchain.status })
            : t('trace.mismatch')}
        </p>
      ) : (
        <p className="text-sm text-bone/50">{t('trace.notOnchain')}</p>
      )}
    </div>
  );
}

function WalletTrace({ data }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5 text-sm">
      <div>
        <h2 className="font-mono text-lg break-all">{data.address}</h2>
        <p className="text-bone/60">
          {t(`trace.role.${data.role}`)} ·{' '}
          {data.registered ? t('trace.registered') : t('trace.notRegistered')}
          {data.balance ? ` · ${vnd(data.balance.approxVnd)}` : ''}
        </p>
        <Link href={data.explorer}>{t('wallet.viewExplorer')}</Link>
      </div>
      <div className="space-y-1">
        <h3 className="uppercase tracking-wider text-xs text-copper">{t('trace.recent')}</h3>
        {data.transactions.length === 0 ? (
          <p className="text-bone/50">{t('trace.none')}</p>
        ) : (
          data.transactions.map((tx) => (
            <div key={tx.signature} className="flex flex-wrap gap-3">
              <span className="w-44 text-bone/50">{tx.at ? tx.at.replace('T', ' ').slice(0, 19) : `slot ${tx.slot}`}</span>
              <Link href={tx.explorer}>{tx.signature.slice(0, 20)}…</Link>
              {tx.failed ? <span className="text-kteh">{t('trace.failed')}</span> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Public trace: every wallet has one public address and every booking and
 * payment is a KNĂ program transaction — look any of them up here.
 */
export default function Trace() {
  const { t } = useTranslation();
  const [q, setQ] = useState(queryFromHash());
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const shown = useRef(null);

  async function lookUp(value) {
    const query = value.trim();
    // The mount and the hashchange that opened the page ask for the same
    // thing: answer once, rather than blanking and redrawing the result.
    if (query === shown.current) return;
    shown.current = query;
    setError('');
    setResult(null);
    if (!query) return;
    try {
      setResult(
        BASE58.test(query)
          ? { kind: 'wallet', data: await api.traceWallet(query) }
          : { kind: 'booking', data: await api.traceBooking(query) }
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('trace.error'));
    }
  }

  useEffect(() => {
    const onHash = () => {
      const next = queryFromHash();
      setQ(next);
      lookUp(next);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="trace" theme="dark" />
      <section className="px-8 lg:px-12 xl:px-16 py-20 max-w-5xl space-y-8">
        <div>
          <h1 className="font-display page-title font-medium leading-[1.05] mb-4">{t('trace.title')}</h1>
          <p className="text-bone/60 max-w-2xl">{t('trace.intro')}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.location.hash = `#trace?q=${encodeURIComponent(q.trim())}`;
          }}
          className="flex gap-2"
        >
          <label htmlFor="trace-q" className="sr-only">{t('trace.placeholder')}</label>
          <input
            id="trace-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('trace.placeholder')}
            className="flex-1 min-w-0 bg-transparent border border-bone/25 px-3 py-2 font-mono text-sm"
          />
          <button type="submit" className="bg-kteh hover:bg-kteh-hover px-4 py-2 inline-flex items-center gap-2">
            <Search className="w-4 h-4" /> {t('trace.search')}
          </button>
        </form>
        {error ? <p className="text-kteh text-sm">{error}</p> : null}
        {result?.kind === 'booking' ? <BookingTrace data={result.data} /> : null}
        {result?.kind === 'wallet' ? <WalletTrace data={result.data} /> : null}
      </section>
    </div>
  );
}
