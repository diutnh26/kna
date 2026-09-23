import { useTranslation } from 'react-i18next';

const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')} ₫`;
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * The end of the traveller's path: where this booking's money goes, whether
 * it has moved yet, and how far its proof has got. Same figures the public
 * ledger shows, for this one booking.
 *
 * `status` is the booking's money state (awaiting | confirmed | cancelled);
 * `proof` is the attestation, when there is one ({ state, explorerUrl }).
 */
export default function ImpactReceipt({
  totalVnd,
  providerVnd,
  communityFundVnd,
  platformFeeVnd,
  provider,
  status,
  proof,
  compact = false,
}) {
  const { t } = useTranslation();
  const rows = [
    { key: 'provider', label: t('receipt.toProvider', { provider }), amount: providerVnd },
    { key: 'fund', label: t('receipt.toFund'), amount: communityFundVnd },
    { key: 'platform', label: t('receipt.toPlatform'), amount: platformFeeVnd },
  ];

  const proofText =
    proof?.state === 'FINALIZED'
      ? t('receipt.proofFinalized')
      : proof?.state === 'AWAITING_COMMITTEE'
        ? t('receipt.proofAwaitingCommittee')
        : proof?.state === 'CANCELLED'
          ? t('receipt.proofWithdrawn')
          : t('receipt.proofAfterConfirm');

  return (
    <section
      aria-label={t('receipt.title')}
      className={`border border-sage/30 text-xs space-y-2 ${compact ? 'p-2' : 'p-3'}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="uppercase tracking-wider text-sage">{t('receipt.title')}</h4>
        <span className="font-mono text-amber">{vnd(totalVnd)}</span>
      </div>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between gap-3">
            <dt className="text-bone/70">
              {row.label} <span className="text-bone/40">· {pct(row.amount, totalVnd)}%</span>
            </dt>
            <dd className="font-mono text-bone/85 whitespace-nowrap">{vnd(row.amount)}</dd>
          </div>
        ))}
      </dl>
      <p className={status === 'cancelled' ? 'text-kteh' : 'text-bone/55'}>
        {t(`receipt.status.${status}`)}
      </p>
      {status !== 'cancelled' ? (
        <p className="text-bone/45">
          {proofText}
          {proof?.explorerUrl ? (
            <>
              {' '}
              <a href={proof.explorerUrl} target="_blank" rel="noreferrer" className="underline text-amber">
                {t('wallet.viewExplorer')}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
