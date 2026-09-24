import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { formatValue, useFieldLabel } from '../../lib/adminFields';

/**
 * One resource as a table: search, filters, sort, pages. A row opens the
 * record; "New" opens the create form when the resource allows it.
 */
export default function ResourceTable({ resource, go }) {
  const { t } = useTranslation();
  const label = useFieldLabel();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const columns = resource.fields.filter((f) => f.list);
  const filterFields = resource.filters
    .map((name) => resource.fields.find((f) => f.name === name))
    .filter((f) => f && ['select', 'boolean', 'text'].includes(f.type));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(q), 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    api
      .adminList(resource.name, { q: search, page, ...filters, ...(sort ?? {}) })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [resource.name, search, page, filters, sort]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function toggleSort(name) {
    setSort((s) => (s?.sort === name ? { sort: name, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { sort: name, dir: 'asc' }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-bone/40" />
          <input
            type="search"
            aria-label={t('admin.search')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t('admin.searchPlaceholder')}
            className="w-full bg-transparent border border-bone/25 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-bone/60"
          />
        </div>
        {filterFields.map((f) => (
          <label key={f.name} className="text-xs text-bone/60 space-y-1">
            <span className="block uppercase tracking-wider">{label(f.name)}</span>
            {f.type === 'text' ? (
              <input
                value={filters[f.name] ?? ''}
                onChange={(e) => {
                  setFilters((s) => ({ ...s, [f.name]: e.target.value }));
                  setPage(1);
                }}
                className="bg-transparent border border-bone/25 px-2 py-2 text-sm w-36"
              />
            ) : (
              <select
                value={filters[f.name] ?? ''}
                onChange={(e) => {
                  setFilters((s) => ({ ...s, [f.name]: e.target.value }));
                  setPage(1);
                }}
                className="bg-ink border border-bone/25 px-2 py-2 text-sm"
              >
                <option value="">{t('admin.all')}</option>
                {(f.type === 'boolean' ? ['true', 'false'] : f.options).map((o) => (
                  <option key={o} value={o}>
                    {f.type === 'boolean' ? t(`admin.${o === 'true' ? 'yes' : 'no'}`) : t(`admin.option.${o}`, { defaultValue: o })}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
        {resource.canCreate ? (
          <button
            type="button"
            onClick={() => go({ r: resource.name, mode: 'new' })}
            className="inline-flex items-center gap-2 bg-kteh hover:bg-kteh-hover px-4 py-2 text-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            {t('admin.new')}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-kteh">{error}</p> : null}

      <div className="border border-bone/15 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-bone/50 border-b border-bone/15">
            <tr>
              {columns.map((f) => (
                <th key={f.name} className="px-3 py-2.5 font-normal whitespace-nowrap">
                  {f.type === 'image' ? (
                    <span className="sr-only">{label(f.name)}</span>
                  ) : (
                    <button type="button" onClick={() => toggleSort(f.name)} className="uppercase tracking-wider hover:text-bone">
                      {label(f.name)}
                      {sort?.sort === f.name ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bone/10">
            {data?.rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => go({ r: resource.name, id: row.id })}
                className="hover:bg-bone/5 cursor-pointer"
              >
                {columns.map((f) => (
                  <td key={f.name} className="px-3 py-2.5 align-middle">
                    {f.type === 'image' ? (
                      row[f.name] ? (
                        <img src={row[f.name]} alt="" className="w-14 h-10 object-cover border border-bone/10" />
                      ) : (
                        <span className="block w-14 h-10 border border-dashed border-bone/15" />
                      )
                    ) : (
                      <span
                        className={`block max-w-[22rem] truncate ${f.type === 'mono' ? 'font-mono text-xs' : ''}`}
                        title={formatValue(f, row)}
                      >
                        {formatValue(f, row)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {data && data.rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-bone/50">
                  {t('admin.empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-bone/60">
        <span>{data ? t('admin.total', { count: data.total }) : t('admin.loading')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('admin.prev')}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="border border-bone/25 p-1.5 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            type="button"
            aria-label={t('admin.next')}
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="border border-bone/25 p-1.5 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
