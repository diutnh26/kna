import { useCallback, useEffect, useState } from 'react';
import { Check, X, Clock, MapPin, ShieldCheck } from 'lucide-react';
import Navbar from './Navbar';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/useAuth';
import ApiErrorNotice from './ApiErrorNotice';
import { useTranslation } from 'react-i18next';
import { OperatorWalletBar } from '../wallet/WalletConnect';
import { CommitteeFinalizePanel, ProofExplainer } from '../wallet/AttestationPanel';

const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The Community Governance Committee's review console.
 *
 * This is the screen that makes "reviewed by elders before publication"
 * a mechanism rather than a claim: nothing reaches the public archive
 * without someone here deciding, and a refusal cannot be recorded without
 * a reason.
 */
export default function Review() {
  const { t } = useTranslation();
  const { user, token, isAuthenticated, openAuthModal } = useAuth();
  const [queue, setQueue] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [phrases, setPhrases] = useState([]);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [errors, setErrors] = useState({});
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // A seat, and only a seat: publishing is the Committee's decision, and
  // the admin role does not stand in for one (the API enforces the same).
  const mayReview = Boolean(user?.isCommitteeMember);

  const fetchAll = useCallback(
    () => Promise.all([api.reviewQueue(token), api.reviewedEntries(token), api.phraseQueue()]),
    [token]
  );

  const apply = useCallback(([queueData, reviewedData, phraseData]) => {
    setQueue(queueData);
    setReviewed(reviewedData);
    setPhrases(phraseData);
    setLoadState('ready');
  }, []);

  useEffect(() => {
    if (!mayReview) return;
    let cancelled = false;
    fetchAll()
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [mayReview, fetchAll, apply]);

  async function decide(entry, decision) {
    setErrors((e) => ({ ...e, [entry.id]: null }));
    setBusyId(entry.id);
    try {
      await api.reviewEntry(entry.id, { decision, note: notes[entry.id] ?? '' }, token);
      setNotes((n) => ({ ...n, [entry.id]: '' }));
      apply(await fetchAll());
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t('review.decisionError');
      setErrors((e) => ({ ...e, [entry.id]: message }));
    } finally {
      setBusyId(null);
    }
  }

  async function decidePhrase(phrase, decision) {
    const key = `phrase-${phrase.id}`;
    setErrors((e) => ({ ...e, [key]: null }));
    setBusyId(key);
    try {
      await api.reviewPhrase(phrase.id, { decision, note: notes[key] ?? '' });
      setNotes((n) => ({ ...n, [key]: '' }));
      apply(await fetchAll());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('review.decisionError');
      setErrors((e) => ({ ...e, [key]: message }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="review" theme="dark" />

      {mayReview && (
        <section className="px-8 lg:px-12 xl:px-16 pt-6 max-w-5xl space-y-4">
          <OperatorWalletBar />
          <p className="text-xs text-bone/50">{t('wallet.committeeFinalize')}</p>
          <CommitteeFinalizePanel />
        </section>
      )}

      {/* Full-bleed, like every other screen and like the decided list at
          the foot of this one — which was already full width, so the header
          and the queue were reading narrower than the table beneath them.
          The padding is the only margin; nothing here is clamped. */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
          <span className="h-px w-12 bg-copper" />
          <span>{t('review.eyebrow')}</span>
        </div>
        <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight text-balance mb-8">
          {t('review.title')}
        </h1>
        <p className="text-lg text-bone/70 leading-relaxed">
          {t('review.intro')}
        </p>
      </section>

      {!isAuthenticated && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-bone/20 py-16 text-center">
            <p className="font-display text-2xl mb-4">{t('review.signInPrompt')}</p>
            <button
              onClick={openAuthModal}
              className="bg-kteh hover:bg-kteh-hover px-6 py-3 text-sm uppercase tracking-wider transition"
            >
              {t('review.signIn')}
            </button>
          </div>
        </section>
      )}

      {isAuthenticated && !mayReview && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-bone/20 py-16 px-8 text-center">
            <p className="font-display text-2xl mb-3">{t('review.notCommitteeTitle')}</p>
            <p className="text-sm text-bone/60 max-w-lg mx-auto leading-relaxed">
              {t('review.notCommitteeBody')}
            </p>
          </div>
        </section>
      )}

      {mayReview && (
        <>
          <section className="px-8 lg:px-12 xl:px-16 pb-16">
            <div className="flex items-center gap-3 text-sm text-amber border border-amber/30 bg-amber/5 px-5 py-3 mb-12">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {t('review.signedInAs', { name: user.fullName })}
              {user.committeeRole ? ` · ${user.committeeRole}` : ` · ${t('review.platformStaff')}`}
            </div>

            <h2 className="font-display text-3xl font-medium mb-2">
              {t('review.waiting')}
              <span className="text-copper ml-3 text-2xl">{queue.length}</span>
            </h2>
            <p className="text-sm text-bone/50 mb-8">{t('review.oldestFirst')}</p>

            {loadState === 'loading' && (
              <p className="text-sm text-bone/50 py-12">{t('review.loading')}</p>
            )}

            {loadState === 'error' && (
              <ApiErrorNotice className="py-16" />
            )}

            {loadState === 'ready' && queue.length === 0 && (
              <div className="border border-dashed border-bone/20 py-16 text-center">
                <p className="font-display text-2xl mb-2">{t('review.emptyTitle')}</p>
                <p className="text-sm text-bone/60">{t('review.emptyBody')}</p>
              </div>
            )}

            <div className="space-y-6">
              {queue.map((entry) => (
                <article key={entry.id} className="border border-bone/15 p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-copper mb-2">
                        {entry.type}
                        {entry.pillar ? ` · ${entry.pillar}` : ''}
                      </div>
                      <h3 className="font-display text-2xl font-medium leading-tight mb-2">
                        {entry.title}
                      </h3>
                      <p className="text-sm text-bone/60">{entry.meta}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] border border-copper/40 text-copper px-3 py-1.5 shrink-0">
                      <Clock className="w-3 h-3" />
                      {t('review.submitted', { date: dmy(entry.createdAt) })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-bone/50 mb-6">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      {entry.keeperBuon}
                    </span>
                    {entry.contributedBy && <span>{t('review.submittedBy', { name: entry.contributedBy.fullName })}</span>}
                  </div>

                  {entry.body && (
                    <p className="text-sm text-bone/70 leading-relaxed border-l-2 border-bone/15 pl-4 mb-6">
                      {entry.body}
                    </p>
                  )}

                  <label
                    htmlFor={`note-${entry.id}`}
                    className="block text-xs uppercase tracking-wider text-bone/50 mb-2"
                  >
                    {t('review.reasonLabel')}
                  </label>
                  <textarea
                    id={`note-${entry.id}`}
                    rows={2}
                    value={notes[entry.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [entry.id]: e.target.value }))}
                    className="w-full bg-transparent border border-bone/25 px-3 py-2.5 text-sm focus:outline-none focus:border-bone/60 transition mb-4"
                  />

                  {errors[entry.id] && (
                    <p className="text-sm text-amber mb-4">{errors[entry.id]}</p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => decide(entry, 'publish')}
                      disabled={busyId === entry.id}
                      className="inline-flex items-center gap-2 bg-[#3F6146] hover:bg-[#35543B] disabled:opacity-50 px-5 py-3 text-sm transition"
                    >
                      <Check className="w-4 h-4" />
                      {t('review.publish')}
                    </button>
                    <button
                      onClick={() => decide(entry, 'reject')}
                      disabled={busyId === entry.id}
                      className="inline-flex items-center gap-2 border border-kteh text-kteh hover:bg-kteh hover:text-bone disabled:opacity-50 px-5 py-3 text-sm transition"
                    >
                      <X className="w-4 h-4" />
                      {t('review.refuse')}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* ── PHRASES ─────────────────────────────── */}
            {phrases.length > 0 && (
              <div className="mt-16">
                <h2 className="font-display text-3xl font-medium mb-2">
                  {t('review.phrasesWaiting')}
                  <span className="text-copper ml-3 text-2xl">{phrases.length}</span>
                </h2>
                <p className="text-sm text-bone/50 mb-8">{t('review.phrasesBody')}</p>
                <div className="space-y-4">
                  {phrases.map((phrase) => {
                    const key = `phrase-${phrase.id}`;
                    return (
                      <article key={phrase.id} className="border border-bone/15 p-6">
                        <div className="font-display text-2xl mb-1">{phrase.ede}</div>
                        <div className="text-sm text-bone/70 mb-2">{phrase.en}</div>
                        {phrase.note && <p className="text-xs text-bone/50 mb-4">{phrase.note}</p>}
                        <label htmlFor={`note-${key}`} className="block text-xs uppercase tracking-wider text-bone/50 mb-2">
                          {t('review.reasonLabel')}
                        </label>
                        <textarea
                          id={`note-${key}`}
                          rows={2}
                          value={notes[key] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                          className="w-full bg-transparent border border-bone/25 px-3 py-2.5 text-sm focus:outline-none focus:border-bone/60 transition mb-4"
                        />
                        {errors[key] && <p className="text-sm text-amber mb-4">{errors[key]}</p>}
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => decidePhrase(phrase, 'publish')}
                            disabled={busyId === key}
                            className="inline-flex items-center gap-2 bg-[#3F6146] hover:bg-[#35543B] disabled:opacity-50 px-5 py-3 text-sm transition"
                          >
                            <Check className="w-4 h-4" />
                            {t('review.publish')}
                          </button>
                          <button
                            onClick={() => decidePhrase(phrase, 'reject')}
                            disabled={busyId === key}
                            className="inline-flex items-center gap-2 border border-kteh text-kteh hover:bg-kteh hover:text-bone disabled:opacity-50 px-5 py-3 text-sm transition"
                          >
                            <X className="w-4 h-4" />
                            {t('review.refuse')}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ── DECIDED ─────────────────────────────── */}
          <section className="bg-bone text-ink">
            <div className="px-8 lg:px-12 xl:px-16 py-20">
              <h2 className="font-display text-3xl font-medium mb-2 text-deep">
                {t('review.decidedTitle')}
              </h2>
              <p className="text-sm text-ink/60 mb-8 leading-relaxed">
                {t('review.decidedBody')}
              </p>

              <div className="space-y-px bg-ink/10">
                {reviewed.map((entry) => {
                  const published = entry.moderationStatus === 'PUBLISHED';
                  return (
                    <article key={entry.id} className="bg-bone p-6 flex flex-wrap gap-6">
                      <div className="w-32 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] border px-3 py-1.5 ${
                            published
                              ? 'text-[#3F6146] border-[#3F6146]/40'
                              : 'text-kteh border-kteh/50'
                          }`}
                        >
                          {published ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {published ? t('review.published') : t('review.refused')}
                        </span>
                        {entry.moderatedAt && (
                          <div className="text-xs text-ink/45 mt-3">
                            {dmy(entry.moderatedAt)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-[260px]">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-copper mb-1">
                          {entry.type}
                        </div>
                        <h3 className="font-display text-xl font-medium leading-tight mb-2">
                          {entry.title}
                        </h3>
                        <p className="text-xs text-ink/50 mb-2">
                          {entry.keeperBuon}
                          {entry.moderatedBy ? ` · decided by ${entry.moderatedBy.fullName}` : ''}
                        </p>
                        {entry.moderationNote && (
                          <p className="text-sm text-ink/70 leading-relaxed">
                            {entry.moderationNote}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
