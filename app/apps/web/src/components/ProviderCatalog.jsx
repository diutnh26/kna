import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { LISTING_FIELDS, PRODUCT_FIELDS, PROFILE_FIELDS } from '../lib/catalogFields';
import RecordForm from './admin/RecordForm';
import ImageSlot from './ImageSlot';

const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')} ₫`;

/** One list of the provider's own things (listings or products), with create/edit/remove. */
function CatalogList({ kind, items, fields, onChanged, verified }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [confirming, setConfirming] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const calls =
    kind === 'listings'
      ? { create: api.createMyListing, update: api.updateMyListing, remove: api.deleteMyListing }
      : { create: api.createMyProduct, update: api.updateMyProduct, remove: api.deleteMyProduct };

  async function remove(item) {
    setError('');
    try {
      const res = await calls.remove(item.id);
      setMessage(t(`catalog.outcome.${res.outcome}`, { title: item.title }));
      setConfirming(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.saveError'));
    }
  }

  return (
    <section aria-label={t(`catalog.${kind}`)} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-medium">{t(`catalog.${kind}`)}</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 bg-kteh hover:bg-kteh-hover px-4 py-2 text-xs uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          {t(kind === 'listings' ? 'catalog.newListing' : 'catalog.newProduct')}
        </button>
      </div>
      {!verified ? <p className="text-xs text-amber">{t('catalog.notVerified')}</p> : null}
      {message ? <p className="text-sm text-sage">{message}</p> : null}
      {error ? <p className="text-sm text-kteh">{error}</p> : null}

      {editing === 'new' ? (
        <div className="border border-bone/20 p-5">
          <RecordForm
            fields={fields}
            mode="create"
            onCancel={() => setEditing(null)}
            onSubmit={async (payload) => {
              await calls.create(payload);
              setEditing(null);
              setMessage(t('catalog.created'));
              onChanged();
            }}
          />
        </div>
      ) : null}

      {items.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-bone/60 border border-dashed border-bone/20 py-10 text-center">{t('catalog.empty')}</p>
      ) : null}

      <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <li key={item.id} className={`border border-bone/15 ${editing?.id === item.id ? 'md:col-span-2 xl:col-span-3' : ''}`}>
            {editing?.id === item.id ? (
              <div className="p-5">
                <RecordForm
                  fields={fields}
                  record={item}
                  mode="edit"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (payload) => {
                    await calls.update(item.id, payload);
                    setEditing(null);
                    setMessage(t('admin.saved'));
                    onChanged();
                  }}
                />
              </div>
            ) : (
              <>
                <ImageSlot src={item.imageUrl} label={item.title} ratio="aspect-[16/9]" showCaption={false} />
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium">{item.title}</h3>
                    <span
                      className={`text-[10px] uppercase tracking-[0.15em] border px-2 py-1 shrink-0 ${
                        item.published ? 'text-sage border-sage/40' : 'text-bone/50 border-bone/20'
                      }`}
                    >
                      {item.published ? t('catalog.published') : t('catalog.draft')}
                    </span>
                  </div>
                  <div className="text-xs text-bone/55">
                    {vnd(item.priceVnd)}
                    {kind === 'listings'
                      ? ` · ${item.unit} · ${t('catalog.inventory', { count: item.inventory })}`
                      : ` · ${t('catalog.stock', { count: item.stock })}`}
                  </div>
                  {confirming === item.id ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs text-bone/70">{t('catalog.confirmRemove')}</span>
                      <button type="button" onClick={() => remove(item)} className="bg-kteh px-3 py-1.5 text-xs">
                        {t('admin.confirm')}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="border border-bone/25 px-3 py-1.5 text-xs">
                        {t('admin.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="inline-flex items-center gap-1.5 border border-bone/25 px-3 py-1.5 text-xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t('admin.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(item.id)}
                        className="inline-flex items-center gap-1.5 border border-kteh/50 text-kteh px-3 py-1.5 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('admin.remove')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The provider's own catalogue: their household profile, listings and
 * products, photographs included. Publishing needs a verified household;
 * removing something with bookings or orders unpublishes it instead.
 */
export default function ProviderCatalog({ provider, listings, products, onChanged }) {
  const { t } = useTranslation();
  const [editingProfile, setEditingProfile] = useState(false);

  return (
    <div className="space-y-12">
      <section aria-label={t('catalog.profile')} className="border border-bone/15 p-5 flex flex-wrap gap-5 items-start">
        {editingProfile ? (
          <div className="flex-1 min-w-0">
            <RecordForm
              fields={PROFILE_FIELDS}
              record={provider}
              mode="edit"
              onCancel={() => setEditingProfile(false)}
              onSubmit={async (payload) => {
                await api.updateProviderProfile(payload);
                setEditingProfile(false);
                onChanged();
              }}
            />
          </div>
        ) : (
          <>
            <div className="w-28 shrink-0">
              <ImageSlot src={provider.imageUrl} label={provider.displayName} ratio="aspect-square" showCaption={false} />
            </div>
            <div className="flex-1 min-w-[200px] space-y-1 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-copper">{t('catalog.profile')}</div>
              <div className="font-medium">{provider.displayName}</div>
              <p className="text-bone/60">{provider.bio || t('catalog.noBio')}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className="inline-flex items-center gap-1.5 border border-bone/25 px-3 py-1.5 text-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('admin.edit')}
            </button>
          </>
        )}
      </section>

      <CatalogList kind="listings" items={listings} fields={LISTING_FIELDS} onChanged={onChanged} verified={provider.verified} />
      <CatalogList kind="products" items={products} fields={PRODUCT_FIELDS} onChanged={onChanged} verified={provider.verified} />
    </div>
  );
}
