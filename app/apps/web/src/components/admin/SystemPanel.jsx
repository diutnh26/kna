import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';

function Row({ name, value, mono }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 py-2 border-b border-bone/10 text-sm">
      <span className="text-bone/60">{name}</span>
      <span className={`${mono ? 'font-mono text-xs' : ''} break-all text-right`}>{value ?? '—'}</span>
    </div>
  );
}

/**
 * How the platform is set up, read-only: which keys are configured (never
 * the keys), the chain it talks to, and what is queued. On-chain settings
 * change with the upgrade key, which never lives on the server.
 */
export default function SystemPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .adminSystem()
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-kteh">{error}</p>;
  if (!data) return <p className="text-sm text-bone/50">{t('admin.loading')}</p>;
  const pc = data.chain.paymentConfig;

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <section>
        <h3 className="text-xs uppercase tracking-wider text-copper mb-3">{t('admin.system.configured')}</h3>
        <ul className="space-y-2 text-sm">
          {Object.entries(data.configured).map(([key, ok]) => (
            <li key={key} className="flex items-center gap-2">
              {ok ? <CheckCircle2 className="w-4 h-4 text-sage" /> : <XCircle className="w-4 h-4 text-kteh" />}
              {t(`admin.system.key.${key}`, { defaultValue: key })}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-copper mb-3">{t('admin.system.chain')}</h3>
        <Row name={t('admin.system.cluster')} value={data.cluster} />
        <Row name={t('admin.system.program')} value={data.programId} mono />
        <Row name={t('admin.system.registrar')} value={data.registrar} mono />
        <Row
          name={t('admin.system.registrarSol')}
          value={data.chain.registrarSol === null ? null : `${data.chain.registrarSol} SOL`}
        />
        <Row name={t('admin.system.mint')} value={data.mint} mono />
        <Row name={t('admin.system.platformWallet')} value={pc?.platformWallet} mono />
        <Row name={t('admin.system.communityWallet')} value={pc?.communityWallet ?? data.committeeVault} mono />
        <Row name={t('admin.system.worker')} value={data.workerEnabled ? t('admin.yes') : t('admin.no')} />
        {data.chain.error ? <p className="text-xs text-kteh mt-2">{data.chain.error}</p> : null}
        {!pc && data.solanaEnabled && !data.chain.error ? (
          <p className="text-xs text-bone/50 mt-2">{t('admin.system.noPaymentConfig')}</p>
        ) : null}
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-copper mb-3">{t('admin.system.queue')}</h3>
        {Object.keys(data.counts.outbox).length === 0 ? (
          <p className="text-sm text-bone/50">{t('admin.empty')}</p>
        ) : (
          Object.entries(data.counts.outbox).map(([status, n]) => <Row key={status} name={status} value={n} />)
        )}
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-copper mb-3">{t('admin.system.counts')}</h3>
        <Row name={t('admin.resource.users')} value={data.counts.users} />
        <Row name={t('admin.resource.providers')} value={data.counts.providers} />
        {Object.entries(data.counts.bookings).map(([status, n]) => (
          <Row key={status} name={`${t('admin.resource.bookings')} · ${status}`} value={n} />
        ))}
      </section>
    </div>
  );
}
