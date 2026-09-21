import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, History } from 'lucide-react';
import { api } from '../lib/api';

const vnd = (n) => (n ?? 0).toLocaleString('vi-VN') + ' ₫';
const dmy = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/**
 * Shared demo mint history for every role — Guest, Provider, Coordinator.
 * Sourced from GET /payments/demo-history (PAID bookings + Explorer sigs).
 */
export default function DemoTxHistory({ tone = 'dark', limit = 8 } = {}) {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .demoHistory()
        .then((data) => {
          if (!cancelled) {
            setItems(Array.isArray(data?.items) ? data.items : []);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setItems([]);
            setError(true);
          }
        });
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (items === null) {
    return (
      <div className={`border border-[#F5EDDD]/15 p-5 text-xs opacity-50`}>
        {t('wallet.demoHistoryLoading')}
      </div>
    );
  }

  const light = tone === 'light';
  const border = light ? 'border-[#1A1614]/15' : 'border-[#F5EDDD]/15';
  const muted = light ? 'text-[#1A1614]/55' : 'text-[#F5EDDD]/55';
  const accent = light ? 'text-[#6B1A1A]' : 'text-[#E8A33D]';
  const link = light ? 'text-[#B87333]' : 'text-[#8FA37B]';
  const title = light ? 'text-[#1A1614]' : 'text-[#F5EDDD]';
  const chipBorder = light ? 'border-[#1A1614]/20' : 'border-[#F5EDDD]/20';

  const shown = items.slice(0, limit);

  return (
    <div className={`border ${border} p-5 sm:p-6 space-y-5`}>
      <header className="space-y-1.5">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.2em] ${accent}`}>
          <History className="w-3.5 h-3.5 shrink-0" />
          {t('wallet.demoHistoryTitle')}
        </div>
        <p className={`text-xs leading-relaxed max-w-2xl ${muted}`}>{t('wallet.demoHistoryIntro')}</p>
      </header>

      {error ? (
        <p className={`text-xs ${muted}`}>{t('wallet.demoHistoryError')}</p>
      ) : shown.length === 0 ? (
        <p className={`text-xs ${muted}`}>{t('wallet.demoHistoryEmpty')}</p>
      ) : (
        <ul className="divide-y divide-current/10">
          {shown.map((row) => (
            <li key={row.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm leading-snug ${title}`}>{row.title}</div>
                  <div className={`text-xs mt-1 ${muted}`}>
                    {row.guestName}
                    <span className="opacity-40 mx-1.5">→</span>
                    {row.providerName}
                    {row.buon ? <span className="opacity-60"> · {row.buon}</span> : null}
                  </div>
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mt-1.5 ${muted}`}>
                    <span>{dmy(row.at)}</span>
                    {row.paymentRef ? (
                      <span className="font-mono opacity-80">ref {row.paymentRef}</span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-display text-lg leading-none tabular-nums ${accent}`}>
                    {vnd(row.totalVnd)}
                  </div>
                  <div className={`text-[11px] mt-1.5 tabular-nums ${muted}`}>
                    {vnd(row.providerPayoutVnd)}
                    <span className="opacity-40 mx-1">+</span>
                    {vnd(row.communityFundVnd)} fund
                  </div>
                </div>
              </div>

              {row.demoTxSigs?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.demoTxSigs.slice(0, 3).map((sig, i) => (
                    <a
                      key={sig}
                      href={
                        row.explorer?.[i] ||
                        `https://explorer.solana.com/tx/${sig}?cluster=devnet`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1.5 border ${chipBorder} px-2.5 py-1 text-[11px] ${link} hover:opacity-80`}
                    >
                      {t('travel.viewDemoTx')}
                      <span className="font-mono opacity-70">{String(sig).slice(0, 6)}…</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  ))}
                </div>
              ) : row.paymentStatus === 'PAID' ? (
                <p className={`text-[11px] ${muted} mt-2`}>{t('travel.demoTokensSkipped')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
