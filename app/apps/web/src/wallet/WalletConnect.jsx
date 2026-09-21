import { useTranslation } from 'react-i18next';
import { useWallet } from './WalletProvider';

export default function WalletConnectButton({ className = '' }) {
  const { t } = useTranslation();
  const { connected, pubkey, connecting, connect, disconnect, error } = useWallet();

  if (connected) {
    return (
      <button
        type="button"
        onClick={disconnect}
        className={`text-xs uppercase tracking-wider border border-amber/40 px-3 py-1.5 ${className}`}
        title={pubkey}
      >
        {t('wallet.connectedShort', { short: pubkey?.slice(0, 4) })}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={connecting}
        onClick={connect}
        className={`text-xs uppercase tracking-wider border border-amber/40 px-3 py-1.5 disabled:opacity-50 ${className}`}
      >
        {connecting ? t('wallet.connecting') : t('wallet.connect')}
      </button>
      {error ? <span className="text-[10px] text-kteh max-w-[12rem] text-right">{error}</span> : null}
    </div>
  );
}

export function OperatorWalletBar() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 border border-amber/20 bg-ink/80 px-4 py-2 text-xs">
      <span className="text-bone/70">{t('wallet.operatorHint')}</span>
      <WalletConnectButton />
    </div>
  );
}
