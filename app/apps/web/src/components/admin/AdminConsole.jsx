import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, ShieldAlert } from 'lucide-react';
import Navbar from '../Navbar';
import { api } from '../../lib/api';
import { useAuth } from '../../context/useAuth';
import ApiErrorNotice from '../ApiErrorNotice';
import ResourceTable from './ResourceTable';
import RecordView from './RecordView';
import RecordForm from './RecordForm';
import SystemPanel from './SystemPanel';

const GROUPS = ['people', 'catalog', 'money', 'governance', 'chain', 'system'];

/** `#admin?r=listings&id=…` → { r, id, mode } */
function readRoute() {
  const i = window.location.hash.indexOf('?');
  const params = new URLSearchParams(i < 0 ? '' : window.location.hash.slice(i + 1));
  return { r: params.get('r') ?? 'system', id: params.get('id'), mode: params.get('mode') };
}

function go(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  window.location.hash = `#admin${qs ? `?${qs}` : ''}`;
}

/**
 * The admin console (ADMIN only; the API enforces it too). Every area of the
 * platform, as the API describes it: content, catalogue and people can be
 * created, edited and removed; money and chain records only through their
 * actions; audit logs and on-chain settings are read-only.
 */
export default function AdminConsole() {
  const { t } = useTranslation();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [meta, setMeta] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [route, setRoute] = useState(readRoute);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    api
      .adminMeta()
      .then((res) => !cancelled && setMeta(res.resources))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const resource = meta?.find((r) => r.name === route.r);
  const refTitles = Object.fromEntries((meta ?? []).map((r) => [r.name, r.titleField]));

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="admin" theme="dark" />

      <section className="px-4 sm:px-8 lg:px-12 xl:px-16 pt-16 pb-8">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-6">
          <span className="h-px w-12 bg-copper" />
          <span>{t('admin.eyebrow')}</span>
        </div>
        <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight">{t('admin.title')}</h1>
      </section>

      {!isAuthenticated ? (
        <section className="px-4 sm:px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-bone/20 py-16 text-center">
            <button onClick={openAuthModal} className="bg-kteh hover:bg-kteh-hover px-6 py-3 text-sm uppercase tracking-wider">
              {t('admin.signIn')}
            </button>
          </div>
        </section>
      ) : !isAdmin ? (
        <section className="px-4 sm:px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-bone/20 py-16 px-8 text-center">
            <ShieldAlert className="w-6 h-6 mx-auto mb-3 text-kteh" />
            <p className="font-display text-2xl">{t('admin.notAdmin')}</p>
          </div>
        </section>
      ) : loadError ? (
        <section className="px-4 sm:px-8 lg:px-12 xl:px-16 pb-24">
          <ApiErrorNotice />
        </section>
      ) : (
        <section className="px-4 sm:px-8 lg:px-12 xl:px-16 pb-24 grid lg:grid-cols-[14rem_1fr] gap-8">
          <nav aria-label={t('admin.title')} className="space-y-5 text-sm">
            {GROUPS.map((group) => (
              <div key={group}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-copper mb-2">{t(`admin.group.${group}`)}</div>
                <ul className="flex flex-wrap lg:block gap-x-3 gap-y-1">
                  {group === 'system' ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => go({ r: 'system' })}
                        className={`py-1 ${route.r === 'system' ? 'text-amber' : 'text-bone/70 hover:text-bone'}`}
                      >
                        {t('admin.resource.system')}
                      </button>
                    </li>
                  ) : null}
                  {(meta ?? [])
                    .filter((r) => r.group === group)
                    .map((r) => (
                      <li key={r.name}>
                        <button
                          type="button"
                          onClick={() => go({ r: r.name })}
                          className={`py-1 text-left ${route.r === r.name ? 'text-amber' : 'text-bone/70 hover:text-bone'}`}
                        >
                          {t(`admin.resource.${r.name}`, { defaultValue: r.name })}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </nav>

          <main className="min-w-0 space-y-5">
            <h2 className="font-display text-2xl font-medium">
              {t(`admin.resource.${route.r}`, { defaultValue: route.r })}
            </h2>
            {resource?.notice ? (
              <p className="flex items-start gap-2 text-sm text-amber border border-amber/30 bg-amber/5 px-4 py-3">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                {t(`admin.notice.${resource.name}`, { defaultValue: resource.notice })}
              </p>
            ) : null}
            {route.r === 'system' ? (
              <SystemPanel />
            ) : !meta ? (
              <p className="text-sm text-bone/50">{t('admin.loading')}</p>
            ) : !resource ? (
              <p className="text-sm text-bone/50">{t('admin.unknown')}</p>
            ) : route.mode === 'new' && resource.canCreate ? (
              <RecordForm
                fields={resource.fields}
                mode="create"
                refTitles={refTitles}
                onCancel={() => go({ r: resource.name })}
                onSubmit={async (payload) => {
                  const created = await api.adminCreate(resource.name, payload);
                  go(created?.id ? { r: resource.name, id: created.id } : { r: resource.name });
                }}
              />
            ) : route.id ? (
              <RecordView key={route.id} resource={resource} id={route.id} go={go} refTitles={refTitles} />
            ) : (
              <ResourceTable key={resource.name} resource={resource} go={go} />
            )}
          </main>
        </section>
      )}
    </div>
  );
}
