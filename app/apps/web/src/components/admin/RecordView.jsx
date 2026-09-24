import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, History, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatValue, useFieldLabel } from '../../lib/adminFields';
import RecordForm, { FieldInput } from './RecordForm';

/** Asks for the action's inputs (and a reason, when one is required), then runs it. */
function ActionPanel({ resource, id, action, onDone, onCancel }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const [values, setValues] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...values, ...(action.reason ? { reason } : {}) };
      await onDone(action.name === '__remove' ? await api.adminRemove(resource, id, reason) : await api.adminAction(resource, id, action.name, body));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.saveError'));
    } finally {
      setBusy(false);
    }
  }

  const title = action.name === '__remove' ? t('admin.remove') : t(`admin.action.${action.name}`, { defaultValue: action.name });
  return (
    <form onSubmit={run} className="border border-bone/20 p-5 space-y-4">
      <h3 className="font-display text-xl">{title}</h3>
      {action.name === '__remove' ? <p className="text-sm text-bone/60">{t('admin.removeExplainer')}</p> : null}
      {action.fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={`field-${f.name}`} className="block text-xs uppercase tracking-wider text-bone/60 mb-1.5">
            {label(f.name)}
          </label>
          <FieldInput field={f} value={values[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
        </div>
      ))}
      {action.reason ? (
        <div>
          <label htmlFor="action-reason" className="block text-xs uppercase tracking-wider text-bone/60 mb-1.5">
            {t('admin.reason')}
          </label>
          <textarea
            id="action-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-transparent border border-bone/25 px-3 py-2 text-sm"
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-kteh">{error}</p> : null}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className={`${action.danger ? 'bg-kteh hover:bg-kteh-hover' : 'bg-[#3F6146] hover:bg-[#35543B]'} disabled:opacity-50 px-5 py-2.5 text-xs uppercase tracking-wider`}
        >
          {busy ? t('admin.working') : t('admin.confirm')}
        </button>
        <button type="button" onClick={onCancel} className="border border-bone/25 px-5 py-2.5 text-xs uppercase tracking-wider">
          {t('admin.cancel')}
        </button>
      </div>
    </form>
  );
}

/**
 * One record: every field, what can be done to it (edit, remove, the
 * resource's actions that apply right now), and its audit history.
 */
export default function RecordView({ resource, id, go, refTitles }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [panel, setPanel] = useState(null); // null | 'edit' | action
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.adminGet(resource.name, id), api.adminHistory(resource.name, id)])
      .then(([record, trail]) => {
        if (cancelled) return;
        setData(record);
        setHistory(trail);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [resource.name, id, reload]);

  function done(msg) {
    setPanel(null);
    setMessage(msg);
    setReload((n) => n + 1);
  }

  if (error && !data) return <p className="text-sm text-kteh">{error}</p>;
  if (!data) return <p className="text-sm text-bone/50">{t('admin.loading')}</p>;
  const record = data.record;
  const actions = resource.actions.filter((a) => data.actions.includes(a.name));
  const title = record[resource.titleField] ?? record.id;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => go({ r: resource.name })}
        className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-bone/60 hover:text-bone"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('admin.back')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="font-display text-3xl font-medium break-all">{String(title)}</h2>
        <div className="flex flex-wrap gap-2">
          {resource.canUpdate ? (
            <button
              type="button"
              onClick={() => setPanel('edit')}
              className="inline-flex items-center gap-2 border border-bone/30 px-4 py-2 text-xs uppercase tracking-wider"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('admin.edit')}
            </button>
          ) : null}
          {actions.map((a) => (
            <button
              key={a.name}
              type="button"
              onClick={() => setPanel(a)}
              className={`border px-4 py-2 text-xs uppercase tracking-wider ${a.danger ? 'border-kteh/60 text-kteh' : 'border-amber/50 text-amber'}`}
            >
              {t(`admin.action.${a.name}`, { defaultValue: a.name })}
            </button>
          ))}
          {resource.canRemove ? (
            <button
              type="button"
              onClick={() => setPanel({ name: '__remove', fields: [], reason: true, danger: true })}
              className="inline-flex items-center gap-2 border border-kteh/60 text-kteh px-4 py-2 text-xs uppercase tracking-wider"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('admin.remove')}
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-sm text-sage">{message}</p> : null}

      {panel === 'edit' ? (
        <RecordForm
          fields={resource.fields}
          record={record}
          mode="edit"
          refTitles={refTitles}
          onCancel={() => setPanel(null)}
          onSubmit={async (payload) => {
            await api.adminUpdate(resource.name, id, payload);
            done(t('admin.saved'));
          }}
        />
      ) : panel ? (
        <ActionPanel
          resource={resource.name}
          id={id}
          action={panel}
          onCancel={() => setPanel(null)}
          onDone={(res) => {
            if (panel.name === '__remove') {
              if (res?.outcome === 'deleted') {
                go({ r: resource.name });
                return;
              }
              done(t(`admin.outcome.${res?.outcome}`, { defaultValue: res?.outcome, reason: res?.reason ?? '' }));
              return;
            }
            done(t('admin.actionDone'));
          }}
        />
      ) : null}

      <dl className="grid md:grid-cols-2 gap-x-8 gap-y-4 border-t border-bone/10 pt-6 text-sm">
        {resource.fields
          .filter((f) => f.type !== 'password')
          .map((f) => (
            <div key={f.name} className={['textarea', 'json', 'image'].includes(f.type) ? 'md:col-span-2' : ''}>
              <dt className="text-[11px] uppercase tracking-wider text-bone/50 mb-1">{label(f.name)}</dt>
              <dd className={`break-words ${f.type === 'mono' ? 'font-mono text-xs' : ''}`}>
                {f.type === 'image' && record[f.name] ? (
                  <img src={record[f.name]} alt="" className="max-h-56 border border-bone/10" />
                ) : f.type === 'json' ? (
                  <pre className="text-xs bg-bone/5 p-3 overflow-x-auto">{JSON.stringify(record[f.name], null, 2)}</pre>
                ) : f.type === 'ref' && record[f.name] && f.ref ? (
                  <button type="button" onClick={() => go({ r: f.ref, id: record[f.name] })} className="underline text-amber text-left">
                    {formatValue(f, record)}
                  </button>
                ) : (
                  formatValue(f, record)
                )}
              </dd>
            </div>
          ))}
      </dl>

      <section className="border-t border-bone/10 pt-6">
        <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-bone/60 mb-3">
          <History className="w-4 h-4" />
          {t('admin.history')}
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-bone/50">{t('admin.noHistory')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-bone/15 pl-3">
                <div>
                  <span className="text-amber">{h.action}</span> · {h.actorEmail ?? h.actorUserId} ·{' '}
                  <span className="text-bone/50">{new Date(h.createdAt).toLocaleString('en-GB')}</span>
                </div>
                {h.reason ? <div className="text-bone/70">{h.reason}</div> : null}
                {h.changes && Object.keys(h.changes).length ? (
                  <div className="text-xs text-bone/50 font-mono break-all">
                    {Object.entries(h.changes)
                      .map(([k, v]) =>
                        v && typeof v === 'object' && 'before' in v
                          ? `${k}: ${JSON.stringify(v.before)} → ${JSON.stringify(v.after)}`
                          : `${k}: ${JSON.stringify(v)}`
                      )
                      .join(' · ')}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
