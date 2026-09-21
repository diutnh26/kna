import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Wallet } from 'lucide-react';
import { api } from '../lib/api';

function formatBalance(uiAmount) {
  if (uiAmount == null || Number.isNaN(uiAmount)) return null;
  if (uiAmount === 0) return '0';
  if (Number.isInteger(uiAmount)) return String(uiAmount);
  return uiAmount.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatVnd(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n).toLocaleString('vi-VN');
}

function shortKey(pubkey) {
  if (!pubkey || pubkey.length < 12) return pubkey || '';
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}

/**
 * Hackathon panel: guest / provider / community fund wallets + demo mint
 * with live dKNA balances and Solana Explorer (devnet) links.
 * Data from GET /chain/status.
 */
export default function DemoWalletPanel({ tone = 'dark' } = {}) {
  const { t } = useTranslation();
  const [demo, setDemo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .chainStatus()
        .then((s) => {
          if (!cancelled) setDemo(s?.demoToken ?? null);
        })
        .catch(() => {
          if (!cancelled) setDemo(null);
        });
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!demo?.mint && !demo?.wallets?.guest) return null;

  const light = tone === 'light';
  const border = light ? 'border-[#1A1614]/15' : 'border-[#F5EDDD]/15';
  const muted = light ? 'text-[#1A1614]/55' : 'text-[#F5EDDD]/55';
  const accent = light ? 'text-[#6B1A1A]' : 'text-[#E8A33D]';
  const link = light ? 'text-[#B87333]' : 'text-[#8FA37B]';
  const balColor = light ? 'text-[#1A1614]' : 'text-[#F5EDDD]';
  const cardBg = light ? 'bg-[rgba(26,22,20,0.03)]' : 'bg-[rgba(245,237,221,0.04)]';

  const bal = demo.balances;
  const symbol = bal?.symbol || 'dKNA';

  const wallets = [
    {
      key: 'guest',
      label: t('wallet.demoGuest'),
      pubkey: demo.wallets?.guest,
      href: demo.explorer?.guest,
      balance: bal?.guest,
    },
    {
      key: 'provider',
      label: t('wallet.demoProvider'),
      pubkey: demo.wallets?.provider,
      href: demo.explorer?.provider,
      balance: bal?.provider,
    },
    {
      key: 'community',
      label: t('wallet.demoCommunity'),
      pubkey: demo.wallets?.community,
      href: demo.explorer?.community,
      balance: bal?.community,
    },
  ].filter((r) => r.pubkey);

  const mint = demo.mint
    ? { pubkey: demo.mint, href: demo.explorer?.mint, label: t('wallet.demoMint') }
    : null;

  return (
    <div className={`border ${border} p-5 sm:p-6 space-y-5`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.2em] ${accent}`}>
            <Wallet className="w-3.5 h-3.5 shrink-0" />
            {t('wallet.demoWalletsTitle')}
          </div>
          <p className={`text-xs leading-relaxed ${muted}`}>
            {demo.disclaimer || t('wallet.demoDisclaimer')}
          </p>
        </div>
        {bal?.vndPerToken ? (
          <p className={`text-[11px] tabular-nums shrink-0 ${muted}`}>
            {t('wallet.demoRate', { rate: bal.vndPerToken, symbol })}
          </p>
        ) : null}
      </header>

      <div className="grid sm:grid-cols-3 gap-3">
        {wallets.map((row) => {
          const amount = formatBalance(row.balance?.uiAmount);
          const vnd = formatVnd(row.balance?.approxVnd);
          return (
            <div
              key={row.key}
              className={`border ${border} ${cardBg} p-4 flex flex-col h-full min-h-[120px]`}
            >
              <div className={`text-[10px] uppercase tracking-[0.16em] ${muted}`}>{row.label}</div>
              <div className="flex-1 flex items-center py-2">
                {amount != null ? (
                  <div className={balColor}>
                    <div className="font-display text-2xl leading-none tracking-tight tabular-nums">
                      {amount}{' '}
                      <span className={`text-xs font-sans uppercase tracking-wider ${muted}`}>
                        {row.balance?.symbol || symbol}
                      </span>
                    </div>
                    <div className={`text-xs mt-1.5 tabular-nums ${muted}`}>
                      {vnd != null ? `≈ ${vnd} ₫` : '\u00A0'}
                    </div>
                  </div>
                ) : (
                  <div className={`text-xs ${muted}`}>—</div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-current/10">
                <span className={`font-mono text-[11px] ${muted}`} title={row.pubkey}>
                  {shortKey(row.pubkey)}
                </span>
                {row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 text-[11px] shrink-0 ${link} hover:opacity-80`}
                  >
                    {t('wallet.viewExplorer')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {mint ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 pt-1 border-t ${border} text-xs`}
        >
          <div className="min-w-0">
            <span className={`uppercase tracking-wider text-[10px] ${muted}`}>{mint.label}</span>
            <span className={`font-mono ml-2 ${muted}`} title={mint.pubkey}>
              {shortKey(mint.pubkey)}
            </span>
          </div>
          {mint.href ? (
            <a
              href={mint.href}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 ${link} hover:opacity-80`}
            >
              {t('wallet.viewExplorer')}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
