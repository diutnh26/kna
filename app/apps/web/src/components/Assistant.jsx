import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import Navbar from './Navbar';


export default function Assistant() {
  const { t } = useTranslation();

  // The scripted replies live in the locale files, so the assistant
  // answers in the language the visitor is reading. Icons stay in code —
  // they are not content — and are paired with the prompts by position.
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
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, thinking]);

  const send = (text, reply) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'assistant', text: reply ?? t('assistant.fallback') }]);
      setThinking(false);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="assistant" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        {/* Eight columns rather than seven: the title needs about 900px to
            sit on one line, and seven gave it 793px at a 1536px viewport.
            Eight clears it, and the note beside it stays readable at four. */}
        <div className="md:col-span-8">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
            <span className="h-px w-12 bg-copper" />
            <span>{t('assistant.eyebrow')}</span>
          </div>
          <h1 className="font-display page-title-sm font-medium leading-[1.05] tracking-tight mb-8">
            {t('assistant.title')}
          </h1>
          <p className="text-lg text-bone/70 max-w-2xl leading-relaxed">
            {t('assistant.intro')}
          </p>
        </div>

        <div className="md:col-span-4">
          <div className="border border-bone/15 p-6 flex gap-4">
            <AlertCircle className="w-4 h-4 text-copper shrink-0 mt-0.5" />
            <p className="text-sm text-bone/70 leading-relaxed">
              {t('assistant.prototypeNote')}
            </p>
          </div>
        </div>
      </section>

      {/* ── CHAT ──────────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pb-24">
        <div className="grid lg:grid-cols-12 gap-8">

          {/* Suggested prompts */}
          <aside className="lg:col-span-4 order-2 lg:order-1">
            <div className="text-xs uppercase tracking-[0.2em] text-copper mb-5">
              {t('assistant.tryOne')}
            </div>
            <div className="space-y-3">
              {prompts.map((p) => (
                <button
                  key={p.label}
                  onClick={() => send(p.label, p.reply)}
                  className="group w-full text-left border border-bone/15 hover:border-bone/40 p-5 flex items-start gap-4 transition"
                >
                  <p.icon className="w-4 h-4 text-copper shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed flex-1">{p.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-bone/30 group-hover:text-bone/70 group-hover:translate-x-0.5 transition shrink-0 mt-0.5" />
                </button>
              ))}
            </div>

            <p className="text-xs text-bone/40 leading-relaxed mt-6">
              {t('assistant.fallbackNote')}
            </p>
          </aside>

          {/* Conversation */}
          <div className="lg:col-span-8 order-1 lg:order-2 border border-bone/15 flex flex-col min-h-[620px]">

            <header className="border-b border-bone/10 px-6 py-4 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-copper" />
              <span className="font-display text-lg">{t('assistant.assistantName')}</span>
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-bone/40">
                {t('assistant.archiveBacked')}
              </span>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-5 py-4 text-sm leading-relaxed whitespace-pre-line ${
                      m.role === 'user'
                        ? 'bg-kteh text-bone'
                        : m.quiet
                        ? 'border border-bone/12 text-bone/55'
                        : 'bg-bone/[0.06] text-bone/85'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="flex justify-start">
                  <div className="bg-bone/[0.06] px-5 py-4 flex gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-copper animate-pulse"
                        style={{ animationDelay: `${d * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-bone/10 p-4 flex gap-3">
              {/* Only a screen reader ever reaches this, which is exactly why
                  it was missed — it has to be translated like anything else. */}
              <label htmlFor="ask" className="sr-only">
                {t('assistant.inputLabel')}
              </label>
              <input
                id="ask"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder={t('assistant.inputPlaceholder')}
                className="flex-1 bg-transparent px-3 py-3 text-sm focus:outline-none placeholder:text-bone/35"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="bg-kteh hover:bg-kteh-hover disabled:opacity-30 disabled:cursor-not-allowed px-5 py-3 transition"
                aria-label={t('assistant.send')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── GUARDRAILS ────────────────────────────── */}
      <section className="bg-bone text-ink">
        <div className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <div className="text-xs uppercase tracking-[0.25em] text-kteh mb-6">
              {t('assistant.guardrailsEyebrow')}
            </div>
            <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-deep mb-8">
              {t('assistant.guardrailsHeading')}
            </h2>
            <p className="text-lg text-ink/70 leading-relaxed">
              {t('assistant.guardrailsBody')}
            </p>
          </div>

          <div className="md:col-span-7 grid sm:grid-cols-2 gap-x-10 gap-y-10 pt-2">
            {guardrails.map((g) => (
              <div key={g.h} className="border-t-2 border-copper pt-5">
                <h3 className="font-display text-lg font-medium mb-2">{g.h}</h3>
                <p className="text-sm text-ink/65 leading-relaxed">{g.b}</p>
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
          <p className="text-bone/70">
            {t('assistant.handoffBody')}
          </p>
        </div>
        <a
          href="#carbon"
          className="group inline-flex items-center gap-3 bg-kteh hover:bg-kteh-hover px-8 py-4 transition"
        >
          {t('assistant.handoffCta')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
