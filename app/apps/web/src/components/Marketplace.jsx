import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ShieldCheck,
  ScanLine,
  MapPin,
  Search,
  ShoppingBag,
  Info,
} from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { useDebounced } from '../lib/useDebounced';
import ApiErrorNotice from './ApiErrorNotice';

const CATEGORIES = ['All', 'Textile', 'Woodwork', 'Basketry', 'Jewellery', 'Coffee'];

// The values above are state and are sent to the API as-is; only the label
// a shopper reads is translated. Translating the values would break both
// the query and the Product.category CHECK constraint behind it.
const CATEGORY_KEYS = {
  All: 'marketplace.filterAll',
  Textile: 'marketplace.categoryTextile',
  Woodwork: 'marketplace.categoryWoodwork',
  Basketry: 'marketplace.categoryBasketry',
  Jewellery: 'marketplace.categoryJewellery',
  Coffee: 'marketplace.categoryCoffee',
};

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

export default function Marketplace() {
  const { t } = useTranslation();
  const notes = t('marketplace.notes', { returnObjects: true });
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // orders[productId] = { qty, status: 'idle'|'submitting'|'done'|'error', error }
  const [orders, setOrders] = useState({});
  const { isAuthenticated, token, openAuthModal } = useAuth();

  // Deliberately doesn't flip back to 'loading' on every filter change —
  // the previous results stay on screen (stale-while-revalidate) until the
  // new ones are in, so picking a filter doesn't flash an empty state.
  useEffect(() => {
    let cancelled = false;
    api
      .products({
        category: category === 'All' ? undefined : category,
        q: debouncedSearch || undefined,
      })
      .then((data) => {
        if (!cancelled) {
          setProducts(data);
          setLoadState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [category, debouncedSearch]);

  // Headline counts — measured, not asserted.
  useEffect(() => {
    let cancelled = false;
    api
      .communityStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function qtyFor(product) {
    return orders[product.id]?.qty ?? 1;
  }

  function setQty(product, qty) {
    setOrders((o) => ({ ...o, [product.id]: { ...o[product.id], qty: Math.max(1, Math.min(qty, product.stock)) } }));
  }

  async function handleBuy(product) {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    const qty = qtyFor(product);
    setOrders((o) => ({ ...o, [product.id]: { ...o[product.id], qty, status: 'submitting', error: null } }));
    try {
      await api.createOrder({ items: [{ productId: product.id, quantity: qty }] }, token);
      setOrders((o) => ({ ...o, [product.id]: { ...o[product.id], qty, status: 'done', error: null } }));
      setProducts((ps) => ps.map((p) => (p.id === product.id ? { ...p, stock: p.stock - qty } : p)));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('marketplace.orderError');
      setOrders((o) => ({ ...o, [product.id]: { ...o[product.id], qty, status: 'error', error: message } }));
    }
  }

  const shown = products;

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="marketplace" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
            <span className="h-px w-12 bg-copper" />
            <span>{t('marketplace.eyebrow')}</span>
          </div>
          <h1 className="font-display page-title-sm font-medium leading-[1.05] tracking-tight mb-8">
            {t('marketplace.title')}
          </h1>
          <p className="text-lg text-bone/70 max-w-2xl leading-relaxed">
            {t('marketplace.intro')}
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border-l-2 border-copper pl-8 space-y-6">
            <div>
              <div className="font-display text-4xl font-medium text-copper">95%</div>
              <p className="text-sm text-bone/60">{t('marketplace.statArtisanShare')}</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-copper">
                {stats ? stats.verifiedArtisans : '—'}
              </div>
              <p className="text-sm text-bone/60">{t('marketplace.statMakers')}</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-copper">
                {stats ? stats.buonOnboarded : '—'}
              </div>
              <p className="text-sm text-bone/60">{t('marketplace.statBuon')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CERTIFICATE EXPLAINER ─────────────────── */}
      <section className="bg-bone text-ink">
        <div className="px-8 lg:px-12 xl:px-16 py-20 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-6">
            <div className="text-xs uppercase tracking-[0.25em] text-kteh mb-6">
              {t('marketplace.certEyebrow')}
            </div>
            <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-deep mb-8">
              {t('marketplace.certHeading')}
            </h2>
            <p className="text-lg text-ink/70 leading-relaxed mb-6">
              {t('marketplace.certBody')}
            </p>
            <p className="text-sm text-ink/55 leading-relaxed">
              {t('marketplace.certNote')}
            </p>
          </div>

          {/* Sample certificate */}
          <div className="md:col-span-6">
            <div className="bg-ink text-bone p-8 font-mono text-sm">
              <div className="flex items-center justify-between gap-4 mb-8">
                <span className="text-bone/40 text-xs uppercase tracking-wider">
                  {t('marketplace.certLabel')}
                </span>
                <ScanLine className="w-4 h-4 text-copper" />
              </div>

              <dl className="space-y-4 text-xs">
                {[
                  [t('marketplace.certReference'), 'KNA-TX-0114'],
                  [t('marketplace.certMaker'), t('marketplace.certMakerValue')],
                  [t('marketplace.certBuon'), 'Buôn Trấp, Đắk Lắk'],
                  [t('marketplace.certTechnique'), t('marketplace.certTechniqueValue')],
                  [t('marketplace.certTime'), t('marketplace.certTimeValue')],
                  [t('marketplace.certReviewedBy'), t('marketplace.certReviewedByValue')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 border-b border-bone/10 pb-3">
                    <dt className="text-bone/45 shrink-0">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-6 pt-1">
                  <dt className="text-bone/45 shrink-0">{t('marketplace.certToMaker')}</dt>
                  <dd className="text-amber">3,990,000 ₫ of 4,200,000 ₫</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER ────────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pt-16">
        <div className="border-y border-bone/10 py-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-bone/40 shrink-0" />
            <label htmlFor="mq" className="sr-only">{t('marketplace.searchLabel')}</label>
            <input
              id="mq"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('marketplace.searchPlaceholder')}
              className="bg-transparent text-sm w-full py-2 focus:outline-none placeholder:text-bone/35 border-b border-transparent focus:border-bone/30 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                  category === c
                    ? 'bg-bone text-ink border-bone'
                    : 'border-bone/25 hover:border-bone/60'
                }`}
              >
                {CATEGORY_KEYS[c] ? t(CATEGORY_KEYS[c]) : c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ──────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-12 pb-24">
        {loadState === 'loading' && (
          <div className="text-sm text-bone/50 py-20 text-center">{t('marketplace.loading')}</div>
        )}

        {loadState === 'error' && (
          <ApiErrorNotice />
        )}

        {loadState === 'ready' && (
          <>
            <div className="text-sm text-bone/50 mb-8">
              {t('marketplace.listed', { count: shown.length })}
            </div>

            {shown.length === 0 ? (
              <div className="border border-dashed border-bone/20 py-20 text-center">
                <p className="font-display text-2xl mb-3">{t('marketplace.emptyTitle')}</p>
                <p className="text-sm text-bone/60 mb-6">
                  {t('marketplace.emptyBody')}
                </p>
                <button
                  onClick={() => { setCategory('All'); setSearch(''); }}
                  className="text-sm text-amber underline underline-offset-4"
                >
                  {t('marketplace.seeEverything')}
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {shown.map((p) => {
                  const order = orders[p.id];
                  const soldOut = p.stock <= 0;
                  return (
                    <article
                      key={p.id}
                      className={`group border transition flex flex-col ${
                        soldOut
                          ? 'border-bone/10'
                          : 'border-bone/10 hover:border-bone/30'
                      }`}
                    >
                      <div className="relative">
                        {/* Dim the photograph, not the words. A sold piece
                            still has a maker and a story worth reading —
                            it just cannot be bought. */}
                        <div className={soldOut ? 'opacity-45' : ''}>
                          <ImageSlot
                            src={p.imageUrl}
                            ratio="aspect-square"
                            label={t('marketplace.photoLabel', { title: p.title, maker: p.provider.displayName })}
                            className="border-0 border-b border-dashed"
                          />
                        </div>
                        {soldOut ? (
                          <span className="absolute top-4 left-4 bg-ink text-bone/70 border border-bone/25 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5">
                            {t('marketplace.soldOut')}
                          </span>
                        ) : (
                          p.stock === 1 && (
                            <span className="absolute top-4 left-4 bg-kteh text-bone text-[10px] uppercase tracking-[0.15em] px-3 py-1.5">
                              {t('marketplace.oneOfAKind')}
                            </span>
                          )
                        )}
                      </div>

                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-copper">
                            {p.category}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber">
                            <ShieldCheck className="w-3 h-3" />
                            {t('marketplace.verifiedMaker')}
                          </span>
                        </div>

                        <h3 className="font-display text-xl font-medium leading-tight mb-3">
                          {p.title}
                        </h3>

                        <p className="text-sm text-bone/60 leading-relaxed mb-5 flex-1">
                          {p.note}
                        </p>

                        <dl className="text-xs text-bone/50 space-y-2 mb-5">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <dd>{p.provider.displayName} · {p.provider.buon}</dd>
                          </div>
                        </dl>

                        <div className="border-t border-bone/10 pt-4 mb-4">
                          <p className="text-[11px] text-bone/45">
                            <span className="text-copper">To the maker · </span>
                            {vnd(Math.round(p.priceVnd * 0.95))}
                          </p>
                        </div>

                        <div className="mt-auto space-y-4">
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <div className="font-display price-sm text-amber leading-none">
                                {vnd(p.priceVnd)}
                              </div>
                              <div className="text-[11px] text-bone/40 mt-1">
                                {soldOut
                                  ? t('marketplace.soldOut')
                                  : p.stock === 1
                                    ? t('marketplace.lastOne')
                                    : t('marketplace.available', { count: p.stock })}
                              </div>
                            </div>

                            {order?.status === 'done' ? (
                              <span className="text-xs text-amber uppercase tracking-wider">
                                {t('marketplace.ordered')}
                              </span>
                            ) : soldOut ? (
                              <span className="text-xs text-bone/40 uppercase tracking-wider">
                                {t('marketplace.soldOut')}
                              </span>
                            ) : (
                              <div className="flex items-center gap-3">
                                <label className="sr-only" htmlFor={`qty-${p.id}`}>{t('marketplace.quantity')}</label>
                                <input
                                  id={`qty-${p.id}`}
                                  type="number"
                                  min={1}
                                  max={p.stock}
                                  value={qtyFor(p)}
                                  onChange={(e) => setQty(p, Number(e.target.value))}
                                  className="w-14 bg-transparent border border-bone/25 text-sm text-center py-2 focus:outline-none focus:border-bone/60"
                                />
                                <button
                                  onClick={() => handleBuy(p)}
                                  disabled={order?.status === 'submitting'}
                                  className="group/btn inline-flex items-center gap-2 bg-kteh hover:bg-kteh-hover disabled:opacity-50 px-5 py-3 text-sm transition"
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                  {order?.status === 'submitting' ? t('marketplace.placing') : t('marketplace.buy')}
                                </button>
                              </div>
                            )}
                          </div>

                          {order?.status === 'error' && (
                            <p className="text-xs text-amber">{order.error}</p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── SHIPPING NOTE ─────────────────────────── */}
      <section className="bg-bone text-ink">
        <div className="px-8 lg:px-12 xl:px-16 py-20">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-4">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-kteh mb-6">
                <Info className="w-4 h-4" />
                {t('marketplace.notesEyebrow')}
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-medium leading-[1.1] tracking-tight text-deep">
                {t('marketplace.notesHeading')}
              </h2>
            </div>

            <div className="md:col-span-8 grid sm:grid-cols-2 gap-10 pt-2">
              {notes.map((n) => (
                <div key={n.h}>
                  <h3 className="font-display text-lg font-medium mb-2 text-copper">{n.h}</h3>
                  <p className="text-sm text-ink/65 leading-relaxed">{n.b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            {t('marketplace.handoffHeading')}
          </h2>
          <p className="text-bone/70">
            {t('marketplace.handoffBody')}
          </p>
        </div>
        <a
          href="#assistant"
          className="group inline-flex items-center gap-3 bg-kteh hover:bg-kteh-hover px-8 py-4 transition"
        >
          {t('marketplace.handoffCta')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
