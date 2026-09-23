import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Send,
  Sparkles,
  BookOpen,
  Handshake,
  Camera,
  Route,
  AlertCircle,
  Flag,
  Check,
} from 'lucide-react';
import Navbar from './Navbar';
import { api, chatStream } from '../lib/api';
import { useAuth } from '../context/useAuth';

/**
 * One id per browser, so the assistant can hold a conversation — it is the
 * server-side memory thread. localStorage can be unavailable (private
 * windows, cleared site data); a fresh id per visit is the graceful floor.
 */
function sessionId() {
  try {
    const existing = localStorage.getItem('kna.assistant.session');
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem('kna.assistant.session', fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const locale = i18n.language?.startsWith('vi') ? 'vi' : 'en';

  // The prompts stay in the locale files — they are the labels of the four
  // suggested questions. Their canned `reply` fields are no longer read:
  // the same texts now live in the moderated KnowledgeCard table, and the
  // server returns them verbatim when a question matches (tier A).
  const PROMPT_ICONS = [Handshake, Camera, Route, BookOpen];
  const prompts = t('assistant.prompts', { returnObjects: true }).map((p, i) => ({
    ...p,
    icon: PROMPT_ICONS[i],
  }));
  const guardrails = t('assistant.guardrails', { returnObjects: true });
  const opening = t('assistant.opening', { returnObjects: true }).map((text, i) => ({
    role: 'assistant',
    text,
    quiet: i > 0,
  }));

  const [messages, setMessages] = useState(opening);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  // null while checking; then { model: boolean } from /chat/health. Decides
  // the notice under the title: full answers, or approved-answers only.
  const [health, setHealth] = useState(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const session = useMemo(() => sessionId(), []);

  useEffect(() => {
    let cancelled = false;
    api
      .chatHealth()
      .then((h) => !cancelled && setHealth(h))
      .catch(() => !cancelled && setHealth({ model: false, documents: { en: 0, vi: 0 } }));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, thinking]);

  const send = useCallback(
    async (text) => {
      const question = text.trim();
      if (!question || thinking) return;

      setMessages((m) => [...m, { role: 'user', text: question }]);
      setInput('');
      setThinking(true);

      const abort = new AbortController();
      abortRef.current = abort;

      // The draft grows token by token; `done` then replaces it wholesale.
      // The replacement matters: a draft that fails the server's grounding
      // check streams first and is refused after, and what the visitor
      // keeps must be the refusal, not the draft.
      let draft = '';
      const showDraft = () => {
        // The [#n] markers are the server's internal grounding notation;
        // the final answer arrives without them, so the live draft hides
        // them too — including a marker still half-typed at the tail.
        const visible = draft.replace(/\s*\[#\d+\]/g, '').replace(/\s*\[#?\d*$/, '');
        setMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          if (last?.streaming) copy[copy.length - 1] = { ...last, text: visible };
          else copy.push({ role: 'assistant', streaming: true, text: visible });
          return copy;
        });
      };

      try {
        await chatStream({
          message: question,
          sessionId: session,
          locale,
          signal: abort.signal,
          onToken: (tok) => {
            draft += tok;
            showDraft();
          },
          onDone: (done) => {
            setMessages((m) => [
              ...m.filter((msg) => !msg.streaming),
              {
                role: 'assistant',
                text: done.answer,
                tier: done.tier,
                sources: done.sources ?? [],
                question,
              },
            ]);
          },
          onError: (err) => {
            setMessages((m) => [
              ...m.filter((msg) => !msg.streaming),
              {
                role: 'assistant',
                text: err.code === 'busy' ? t('assistant.busy') : t('assistant.failed'),
                quiet: true,
              },
            ]);
          },
        });
      } catch {
        if (!abort.signal.aborted) {
          setMessages((m) => [
            ...m.filter((msg) => !msg.streaming),
            { role: 'assistant', text: t('assistant.failed'), quiet: true },
          ]);
        }
      } finally {
        setThinking(false);
      }
    },
    [thinking, session, locale, t]
  );

  /** Guardrail four, as a button: the reader can hand an answer to the Committee. */
  const flag = useCallback(
    async (index) => {
      const message = messages[index];
      if (!message || message.flagged) return;
      try {
        await api.flagAnswer(
          {
            question: message.question ?? '',
            answer: message.text,
            tier: message.tier ?? 'B',
            sourceIds: (message.sources ?? []).map((s) => s.sourceId),
          },
          token ?? undefined
        );
        setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, flagged: true } : msg)));
      } catch {
        // A failed report should not interrupt the conversation; the
        // button simply stays available to try again.
      }
    },
    [messages, token]
  );

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="assistant" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        {/* Eight columns rather than seven: the title needs about 900px to
            sit on one line, and seven gave it 793px at a 1536px viewport.
            Eight clears it, and the note beside it stays readable at four. */}
        <div className="md:col-span-8">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>{t('assistant.eyebrow')}</span>
          </div>
          <h1 className="font-display page-title-sm font-medium leading-[1.05] tracking-tight mb-8">
            {t('assistant.title')}
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            {t('assistant.intro')}
          </p>
        </div>

        <div className="md:col-span-4">
          <div className="border border-[#F5EDDD]/15 p-6 flex gap-4">
            <AlertCircle className="w-4 h-4 text-[#B87333] shrink-0 mt-0.5" />
            <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
              {health === null
                ? t('assistant.statusChecking')
                : health.model
                ? t('assistant.statusLive')
                : t('assistant.statusCurated')}
            </p>
          </div>
        </div>
      </section>

      {/* ── CHAT ──────────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pb-24">
        <div className="grid lg:grid-cols-12 gap-8">

          {/* Suggested prompts */}
          <aside className="lg:col-span-4 order-2 lg:order-1">
            <div className="text-xs uppercase tracking-[0.2em] text-[#B87333] mb-5">
              {t('assistant.tryOne')}
            </div>
            <div className="space-y-3">
              {prompts.map((p) => (
                <button
                  key={p.label}
                  onClick={() => send(p.label)}
                  disabled={thinking}
                  className="group w-full text-left border border-[#F5EDDD]/15 hover:border-[#F5EDDD]/40 disabled:opacity-50 p-5 flex items-start gap-4 transition"
                >
                  <p.icon className="w-4 h-4 text-[#B87333] shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed flex-1">{p.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#F5EDDD]/30 group-hover:text-[#F5EDDD]/70 group-hover:translate-x-0.5 transition shrink-0 mt-0.5" />
                </button>
              ))}
            </div>

            <p className="text-xs text-[#F5EDDD]/40 leading-relaxed mt-6">
              {t('assistant.fallbackNote')}
            </p>
          </aside>

          {/* Conversation */}
          <div className="lg:col-span-8 order-1 lg:order-2 border border-[#F5EDDD]/15 flex flex-col min-h-[620px]">

            <header className="border-b border-[#F5EDDD]/10 px-6 py-4 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-[#B87333]" />
              <span className="font-display text-lg">{t('assistant.assistantName')}</span>
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-[#F5EDDD]/40">
                {t('assistant.archiveBacked')}
              </span>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`px-5 py-4 text-sm leading-relaxed whitespace-pre-line ${
                        m.role === 'user'
                          ? 'bg-[#C8302E] text-[#F5EDDD]'
                          : m.quiet
                          ? 'border border-[#F5EDDD]/12 text-[#F5EDDD]/55'
                          : 'bg-[#F5EDDD]/[0.06] text-[#F5EDDD]/85'
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* A tier D answer came from the model's general
                        knowledge, not the reviewed archive — the label IS
                        the honesty, so it must be impossible to miss. */}
                    {m.role === 'assistant' && m.tier === 'D' && (
                      <div className="mt-2 px-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-[#F5EDDD]/45">
                          {t('assistant.tierD')}
                        </span>
                        <button
                          onClick={() => flag(i)}
                          disabled={m.flagged}
                          className="inline-flex items-center gap-1.5 text-[11px] text-[#F5EDDD]/45 hover:text-[#C8302E] disabled:text-[#B87333] transition"
                          title={t('assistant.flagTitle')}
                        >
                          {m.flagged ? <Check className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
                          {m.flagged ? t('assistant.flagged') : t('assistant.flag')}
                        </button>
                      </div>
                    )}

                    {/* Where the answer came from, and the door to correct it.
                        Only real answers (tier A and B) carry either — an
                        opening line or a refusal has no source to show and
                        nothing to report. */}
                    {m.role === 'assistant' && (m.tier === 'A' || m.tier === 'B') && (
                      <div className="mt-2 px-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-[#B87333]">
                          {m.tier === 'A' ? t('assistant.tierA') : t('assistant.tierB')}
                        </span>
                        {(m.sources ?? []).map((s) => (
                          <a
                            key={s.id}
                            href={s.href || '#explore'}
                            className="text-[11px] text-[#F5EDDD]/45 hover:text-[#F5EDDD]/80 underline decoration-[#B87333]/40 underline-offset-2 transition"
                          >
                            {s.title}
                          </a>
                        ))}
                        <button
                          onClick={() => flag(i)}
                          disabled={m.flagged}
                          className="inline-flex items-center gap-1.5 text-[11px] text-[#F5EDDD]/45 hover:text-[#C8302E] disabled:text-[#B87333] transition"
                          title={t('assistant.flagTitle')}
                        >
                          {m.flagged ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Flag className="w-3 h-3" />
                          )}
                          {m.flagged ? t('assistant.flagged') : t('assistant.flag')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="flex justify-start">
                  <div className="bg-[#F5EDDD]/[0.06] px-5 py-4 flex gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-[#B87333] animate-pulse"
                        style={{ animationDelay: `${d * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-[#F5EDDD]/10 p-4 flex gap-3">
              {/* Only a screen reader ever reaches this, which is exactly why
                  it was missed — it has to be translated like anything else. */}
              <label htmlFor="ask" className="sr-only">
                {t('assistant.inputLabel')}
              </label>
              <input
                id="ask"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter inside a Vietnamese IME composition commits the
                  // character; it must not send the message.
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(input);
                }}
                placeholder={t('assistant.inputPlaceholder')}
                className="flex-1 bg-transparent px-3 py-3 text-sm focus:outline-none placeholder:text-[#F5EDDD]/35"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || thinking}
                className="bg-[#C8302E] hover:bg-[#A82826] disabled:opacity-30 disabled:cursor-not-allowed px-5 py-3 transition"
                aria-label={t('assistant.send')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── GUARDRAILS ────────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              {t('assistant.guardrailsEyebrow')}
            </div>
            <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-8">
              {t('assistant.guardrailsHeading')}
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed">
              {t('assistant.guardrailsBody')}
            </p>
          </div>

          <div className="md:col-span-7 grid sm:grid-cols-2 gap-x-10 gap-y-10 pt-2">
            {guardrails.map((g) => (
              <div key={g.h} className="border-t-2 border-[#B87333] pt-5">
                <h3 className="font-display text-lg font-medium mb-2">{g.h}</h3>
                <p className="text-sm text-[#1A1614]/65 leading-relaxed">{g.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            {t('assistant.handoffHeading')}
          </h2>
          <p className="text-[#F5EDDD]/70">
            {t('assistant.handoffBody')}
          </p>
        </div>
        <a
          href="#carbon"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          {t('assistant.handoffCta')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
