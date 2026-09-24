import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Search, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { initialValues, toPayload, useFieldLabel } from '../../lib/adminFields';

const input =
  'w-full bg-transparent border border-bone/25 px-3 py-2 text-sm focus:outline-none focus:border-bone/60 transition';

/**
 * A photograph: shows it, uploads a new one (JPEG, PNG or WebP, up to
 * 3 MB) to the API, or takes a URL/path directly.
 */
export function ImageField({ id, value, onChange }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file) {
    if (!file) return;
    setError('');
    if (file.size > 3 * 1024 * 1024) {
      setError(t('admin.image.tooLarge'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.uploadImage(file);
      onChange(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.image.failed'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-28 h-20 shrink-0 border border-bone/15 bg-bone/5 overflow-hidden flex items-center justify-center">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-5 h-5 text-bone/30" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="border border-amber/50 text-amber px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {busy ? t('admin.image.uploading') : t('admin.image.upload')}
            </button>
            {value ? (
              <button type="button" onClick={() => onChange('')} className="border border-bone/25 px-3 py-1.5 text-xs">
                {t('admin.image.remove')}
              </button>
            ) : null}
          </div>
          <input
            id={id}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('admin.image.urlPlaceholder')}
            className={`${input} text-xs font-mono`}
          />
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid={`${id}-file`}
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {error ? <p className="text-xs text-kteh">{error}</p> : null}
    </div>
  );
}

/** Picks a record of another resource (a provider, a user) by searching it. */
export function RefPicker({ id, value, resource, titleField, initialLabel, onChange }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState(initialLabel ?? '');

  useEffect(() => {
    if (!q.trim()) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .adminList(resource, { q, pageSize: 8 })
        .then((res) => !cancelled && setRows(res.rows))
        .catch(() => !cancelled && setRows([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, resource]);

  if (value) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="border border-bone/25 px-3 py-2 flex-1 min-w-0 truncate">{label || value}</span>
        <button
          type="button"
          aria-label={t('admin.clear')}
          onClick={() => {
            onChange('');
            setLabel('');
          }}
          className="border border-bone/25 p-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-bone/40" />
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.searchPlaceholder')}
          className={`${input} pl-9`}
        />
      </div>
      {q.trim() && rows.length > 0 ? (
        <ul className="border border-bone/15 divide-y divide-bone/10 text-sm">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(row.id);
                  setLabel(String(row[titleField] ?? row.id));
                  setQ('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-bone/5"
              >
                {String(row[titleField] ?? row.id)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FieldInput({ field, value, onChange, refTitles = {}, refLabel }) {
  const { t } = useTranslation();
  const id = `field-${field.name}`;
  switch (field.type) {
    case 'textarea':
      return <textarea id={id} rows={4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={input} />;
    case 'number':
    case 'money':
      return (
        <input
          id={id}
          type="number"
          step={field.type === 'money' ? 1000 : 1}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
      );
    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-amber"
        />
      );
    case 'select':
      return (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${input} bg-ink`}>
          <option value="">{t('admin.choose')}</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {t(`admin.option.${o}`, { defaultValue: o })}
            </option>
          ))}
        </select>
      );
    case 'date':
      return <input id={id} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={input} />;
    case 'password':
      return (
        <input
          id={id}
          type="password"
          autoComplete="new-password"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
      );
    case 'image':
      return <ImageField id={id} value={value} onChange={onChange} />;
    case 'ref':
      return (
        <RefPicker
          id={id}
          value={value}
          resource={field.ref}
          titleField={refTitles[field.ref] ?? 'id'}
          initialLabel={refLabel}
          onChange={onChange}
        />
      );
    default:
      return <input id={id} type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={input} />;
  }
}

/**
 * A create or edit form built from a field list. On edit only the fields
 * that changed are sent. `onSubmit` receives the payload and may throw an
 * ApiError, whose message is shown.
 */
export default function RecordForm({ fields, record, mode, onSubmit, onCancel, refTitles, submitLabel }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const shown = fields.filter((f) => (mode === 'create' ? f.create : f.edit));
  const [values, setValues] = useState(() => initialValues(shown, record));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(toPayload(shown, values, mode === 'edit' ? record : null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.saveError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-5">
        {shown.map((f) => (
          <div
            key={f.name}
            className={['textarea', 'image'].includes(f.type) ? 'md:col-span-2' : f.type === 'boolean' ? 'flex items-center gap-3' : ''}
          >
            <label htmlFor={`field-${f.name}`} className="block text-xs uppercase tracking-wider text-bone/60 mb-1.5">
              {label(f.name)}
              {f.required && mode === 'create' ? <span className="text-kteh"> *</span> : null}
            </label>
            <FieldInput
              field={f}
              value={values[f.name]}
              onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
              refTitles={refTitles}
              refLabel={f.display && record ? f.display.split('.').reduce((o, k) => o?.[k], record) : undefined}
            />
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-kteh">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-kteh hover:bg-kteh-hover disabled:opacity-50 px-5 py-2.5 text-xs uppercase tracking-wider"
        >
          {busy ? t('admin.saving') : submitLabel ?? (mode === 'create' ? t('admin.create') : t('admin.save'))}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="border border-bone/25 px-5 py-2.5 text-xs uppercase tracking-wider">
            {t('admin.cancel')}
          </button>
        ) : null}
      </div>
    </form>
  );
}
