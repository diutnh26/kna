import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, Wallet } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useWallet } from '../wallet/WalletProvider';
import { GuestReceiptPanel } from '../wallet/AttestationPanel';

const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')} ₫`;
const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');

/**
 * The account's wallet: one fixed public address, made at sign-up and
 * registered on-chain, which pays bookings at check-out. Funded by VietQR
 * top-up or (devnet) the demo faucet. A linked Phantom can be made the
 * paying wallet instead; the fixed address never changes.
 */
export default function WalletCard() {
  const { t } = useTranslation();
  const { signAndSendTransaction, connect, connected } = useWallet();
  const [account, setAccount] = useState(null);
  const [topUps, setTopUps] = useState([]);
  const [amount, setAmount] = useState(1_000_000);
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [reload, setReload] = useState(0);
  const refresh = () => setReload((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.walletAccount(), api.walletTopUps()])
      .then(([acct, history]) => {
        if (cancelled) return;
        setAccount(acct);
        setTopUps(history);
      })
      .catch(() => !cancelled && setError(t('walletCard.loadError')));
    return () => {
      cancelled = true;
    };
  }, [reload, t]);

  async function run(kind, fn) {
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message ?? t('walletCard.actionError'));
    } finally {
      setBusy('');
    }
  }

  const faucet = () =>
    run('faucet', async () => {
      await api.walletFaucet();
      setMessage(t('walletCard.faucetDone'));
    });

  const topUp = (event) => {
    event.preventDefault();
    return run('topup', async () => {
      const res = await api.walletTopUp(Number(amount));
      setQr(res.payment);
    });
  };

  const payWithPhantom = () =>
    run('payer', async () => {
      if (!connected) await connect();
      const prepared = await api.paymentWalletPrepare();
      const signature = await signAndSendTransaction(prepared.transactionBase64);
      await api.paymentWalletConfirm(signature);
      setMessage(t('walletCard.payerPhantom'));
    });

  const payWithFixed = () =>
    run('payer', async () => {
      await api.paymentWalletReset();
      setMessage(t('walletCard.payerFixed'));
    });

  if (!account) {
    return error ? <p className="text-sm text-kteh">{error}</p> : null;
  }

  const payingIsPhantom = account.linked?.isDefault;

  return (
    <section aria-label={t('walletCard.title')} className="border border-bone/15 p-6 space-y-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 uppercase tracking-wider text-xs text-copper">
            <Wallet className="w-4 h-4" />
            {t('walletCard.title')}
          </div>
          <div className="flex items-center gap-2 font-mono text-bone/85 break-all">
            <span title={account.address}>{account.address}</span>
            <button
              type="button"
              aria-label={t('walletCard.copy')}
              onClick={() => navigator.clipboard?.writeText(account.address)}
              className="text-bone/50 hover:text-bone"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <a href={account.explorer} target="_blank" rel="noreferrer" className="underline text-amber inline-flex items-center gap-1">
              {t('wallet.viewExplorer')} <ExternalLink className="w-3 h-3" />
            </a>
            <a href={`#trace?q=${account.address}`} className="underline text-bone/60">
              {t('walletCard.trace')}
            </a>
            <span className={account.registered ? 'text-sage' : 'text-bone/50'}>
              {account.registered ? t('walletCard.registered') : t('walletCard.registering')}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display price-sm text-amber leading-none">
            {account.balance ? vnd(account.balance.approxVnd) : '—'}
          </div>
          <div className="text-[11px] text-bone/45 mt-1">
            {account.balance
              ? t('walletCard.balance', { amount: account.balance.uiAmount, wallet: short(account.paymentWallet) })
              : t('walletCard.balanceUnknown')}
          </div>
        </div>
      </div>

      <p className="text-xs text-bone/55 leading-relaxed">{t('walletCard.explainer')}</p>

      <div className="grid md:grid-cols-2 gap-5">
        <form onSubmit={topUp} className="space-y-2">
          <label className="block text-xs uppercase tracking-wider text-bone/60" htmlFor="topup-amount">
            {t('walletCard.topUpLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="topup-amount"
              type="number"
              min={10000}
              step={10000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border border-bone/25 px-3 py-2"
            />
            <button type="submit" disabled={busy === 'topup'} className="bg-kteh hover:bg-kteh-hover disabled:opacity-50 px-4 py-2">
              {t('walletCard.topUp')}
            </button>
          </div>
          {qr?.qrUrl ? (
            <div className="space-y-1">
              <img src={qr.qrUrl} alt={t('walletCard.topUpQr')} className="w-40 h-40 bg-white p-1" />
              <p className="text-xs text-bone/50">{t('walletCard.topUpQrHint', { ref: qr.paymentRef })}</p>
            </div>
          ) : qr ? (
            <p className="text-xs text-bone/50">{qr.instructions}</p>
          ) : null}
        </form>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-bone/60">{t('walletCard.faucetLabel')}</div>
          <button
            type="button"
            onClick={faucet}
            disabled={busy === 'faucet'}
            className="border border-sage/50 text-sage px-4 py-2 disabled:opacity-50"
          >
            {t('walletCard.faucet')}
          </button>
          <p className="text-xs text-bone/45">{t('walletCard.faucetHint')}</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-bone/10 pt-4">
        <div className="text-xs uppercase tracking-wider text-bone/60">{t('walletCard.payerLabel')}</div>
        <p className="text-xs text-bone/70">
          {payingIsPhantom
            ? t('walletCard.payingFrom', { wallet: short(account.linked.pubkey), kind: 'Phantom' })
            : t('walletCard.payingFrom', { wallet: short(account.address), kind: t('walletCard.fixedWallet') })}
        </p>
        {account.linked ? (
          payingIsPhantom ? (
            <button type="button" onClick={payWithFixed} disabled={busy === 'payer'} className="border border-bone/25 px-3 py-1.5 text-xs disabled:opacity-50">
              {t('walletCard.useFixed')}
            </button>
          ) : (
            <button type="button" onClick={payWithPhantom} disabled={busy === 'payer'} className="border border-amber/40 px-3 py-1.5 text-xs disabled:opacity-50">
              {t('walletCard.usePhantom', { wallet: short(account.linked.pubkey) })}
            </button>
          )
        ) : (
          <GuestReceiptPanel />
        )}
      </div>

      {topUps.length > 0 && (
        <ul className="space-y-1 text-xs text-bone/60 border-t border-bone/10 pt-4">
          {topUps.slice(0, 5).map((row) => (
            <li key={row.id} className="flex justify-between gap-3">
              <span>
                {row.source === 'FAUCET' ? t('walletCard.faucetRow') : t('walletCard.topUpRow')} ·{' '}
                {t(`walletCard.topUpStatus.${row.status}`)}
              </span>
              <span className="font-mono">
                {vnd(row.amountVnd)}
                {row.explorer ? (
                  <a href={row.explorer} target="_blank" rel="noreferrer" className="underline text-amber ml-2">
                    tx
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {message ? <p className="text-sage text-xs">{message}</p> : null}
      {error ? <p className="text-kteh text-xs">{error}</p> : null}
    </section>
  );
}
