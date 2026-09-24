import { useTranslation } from 'react-i18next';

// Helpers for field-driven forms and tables: the admin console renders every
// resource from the field list the API describes (GET /admin/meta), and the
// provider catalogue uses the same shapes for listings and products.

const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')} ₫`;

/** "maxGuestsPerRoom" → "Max guests per room"; "priceVnd" → "Price (VND)". */
export function humanize(name) {
  const words = name
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/ vnd$/, ' (VND)')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A field's label, translated, falling back to its humanized name. */
export function useFieldLabel() {
  const { t } = useTranslation();
  return (name) => t(`admin.field.${name}`, { defaultValue: humanize(name) });
}

/** Reads "provider.displayName" out of a record. */
export function pick(record, path) {
  return path.split('.').reduce((v, key) => (v == null ? v : v[key]), record);
}

/** A value as text, for tables and the detail view. */
export function formatValue(field, record) {
  const raw = record?.[field.name];
  if (field.display) {
    const shown = pick(record, field.display);
    if (shown != null) return String(shown);
  }
  if (raw === null || raw === undefined || raw === '') return '—';
  switch (field.type) {
    case 'money':
      return vnd(raw);
    case 'boolean':
      return raw ? '✓' : '—';
    case 'date':
      return String(raw).slice(0, 10);
    case 'datetime':
      return new Date(raw).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    case 'json':
      return JSON.stringify(raw);
    default:
      return String(raw);
  }
}

/** The form's starting values: a record's, or empty for a new one. */
export function initialValues(fields, record) {
  return Object.fromEntries(
    fields.map((f) => {
      const v = record?.[f.name];
      if (f.type === 'boolean') return [f.name, Boolean(v)];
      if (f.type === 'date' && v) return [f.name, String(v).slice(0, 10)];
      if (v === null || v === undefined) return [f.name, ''];
      return [f.name, v];
    })
  );
}

/**
 * What to send: typed values, empty optional fields left out on create and
 * cleared (null) on edit, and on edit only what changed.
 */
export function toPayload(fields, values, original) {
  const out = {};
  for (const f of fields) {
    let v = values[f.name];
    if (f.type === 'number' || f.type === 'money') v = v === '' || v === null ? null : Number(v);
    if (typeof v === 'string') v = v.trim();
    if (v === '') v = null;
    if (original) {
      const before = initialValues([f], original)[f.name];
      const same = (before === '' ? null : before) === v || String(before) === String(v ?? '');
      if (same) continue;
      out[f.name] = v;
    } else if (v !== null) {
      out[f.name] = v;
    }
  }
  return out;
}
