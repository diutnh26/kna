import { useState, useRef, useEffect } from 'react';
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

/* ── Mocked replies ───────────────────────────────
   The prototype answers from a fixed script. Swap
   handleSend for a real call when the model is wired
   up; the shape of a message never changes.
   ─────────────────────────────────────────────── */

const OPENING = [
  {
    role: 'assistant',
    text: "I'm the KNĂ assistant. I can help you plan a route, explain what you'll see, or tell you how to behave somewhere so you don't cause offence without meaning to.",
  },
  {
    role: 'assistant',
    text: 'What I say about Ê Đê custom comes from the community archive, reviewed by elders. If I have not been told something, I will say so rather than guess.',
    quiet: true,
  },
];

const PROMPTS = [
  {
    icon: Handshake,
    label: 'How do I greet an elder?',
    reply:
      "Let the elder speak first. A short reply and a slight bow of the head is enough — Ê Đê greeting is not effusive, and a long enthusiastic introduction can read as pushy.\n\nIf you want a phrase, \u201cHê drei\u201d works at any hour. \u201cBơni\u201d is thank you.\n\nOne thing visitors often get wrong: in a matrilineal household the eldest woman is usually the person to address, even when a man greets you at the ladder.",
  },
  {
    icon: Camera,
    label: 'What can I photograph?',
    reply:
      "Most of daily life is fine to photograph if you ask first. Three things to avoid:\n\n• The ancestor shelf inside a longhouse. Not photographed, generally not discussed with visitors either.\n• Funeral gongs or a funeral in progress.\n• Children, without a parent present.\n\nCeremonies vary by household. If you booked through KNĂ, the house rule on your booking card tells you what that particular family has agreed to.",
  },
  {
    icon: Route,
    label: 'Plan me three days',
    reply:
      "Here is a shape that works for a first visit, low travel, one buôn per day:\n\nDay 1 — Arrive Buôn Ma Thuột, afternoon at Buôn Akô Dhông. Short walk, meet your host, eat with the household. Stay the night.\n\nDay 2 — Morning loom session with Amí Lan in Buôn Kli A. Afternoon free. Evening gong ensemble in Buôn Đôn if the harvest calendar has a date open.\n\nDay 3 — Forest edge walk with Y Wik, then the coffee co-op in the afternoon. Depart evening.\n\nWant me to check which dates actually have availability?",
  },
  {
    icon: BookOpen,
    label: 'What is Cồng Chiêng?',
    reply:
      "A set of tuned gongs, and the practice around them. UNESCO recognised the Space of Gong Culture in the Central Highlands in 2005.\n\nWhat matters more than the recognition: the gongs are not performed for an audience in the ordinary sense. A set is tuned to a family and played at births, harvests, and funerals. Listeners in the buôn can hear which occasion is being marked.\n\nThat is why KNĂ lists ceremony evenings only when the village is holding one anyway, rather than scheduling them for visitors.",
  },
];

const FALLBACK =
  "I don't have that in the community archive yet, so I'd rather not guess.\n\nYour host is the better person to ask, and asking is usually welcome. If it's something the community thinks visitors should know, it can be submitted to the Governance Committee for the archive.";

const GUARDRAILS = [
  {
    h: 'It cites, or it declines',
    b: 'Cultural answers come from the reviewed archive. Outside it, the assistant says so rather than filling the gap.',
  },
  {
    h: 'It never speaks for a household',
    b: 'House rules differ. The assistant points you to your host or your booking card instead of generalising.',
  },
  {
    h: 'It does not sell',
    b: 'Recommendations follow what you asked for and what is available, not what earns the platform more.',
  },
  {
    h: 'The community can correct it',
    b: 'Elders and the Governance Committee can flag an answer. Corrections go into the archive, not into a private model.',
  },
];

export default function Assistant() {
  const [messages, setMessages] = useState(OPENING);
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
      setMessages((m) => [...m, { role: 'assistant', text: reply ?? FALLBACK }]);
      setThinking(false);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="assistant" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>Travel assistant</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8">
            Ask the awkward questions here, not at the door.
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            Most visitors cause offence by accident, because nobody told them. The assistant is
            trained on the community archive and will tell you plainly what is expected.
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border border-[#F5EDDD]/15 p-6 flex gap-4">
            <AlertCircle className="w-4 h-4 text-[#B87333] shrink-0 mt-0.5" />
            <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
              This is a prototype. Answers come from a fixed script for now, and the four suggested
              questions are the ones wired up.
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
              Try one of these
            </div>
            <div className="space-y-3">
              {PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => send(p.label, p.reply)}
                  className="group w-full text-left border border-[#F5EDDD]/15 hover:border-[#F5EDDD]/40 p-5 flex items-start gap-4 transition"
                >
                  <p.icon className="w-4 h-4 text-[#B87333] shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed flex-1">{p.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#F5EDDD]/30 group-hover:text-[#F5EDDD]/70 group-hover:translate-x-0.5 transition shrink-0 mt-0.5" />
                </button>
              ))}
            </div>

            <p className="text-xs text-[#F5EDDD]/40 leading-relaxed mt-6">
              Anything else you type will get the assistant&rsquo;s &ldquo;I don&rsquo;t know&rsquo;
              answer, which is deliberate. Try it.
            </p>
          </aside>

          {/* Conversation */}
          <div className="lg:col-span-8 order-1 lg:order-2 border border-[#F5EDDD]/15 flex flex-col min-h-[620px]">

            <header className="border-b border-[#F5EDDD]/10 px-6 py-4 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-[#B87333]" />
              <span className="font-display text-lg">KNĂ assistant</span>
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-[#F5EDDD]/40">
                Archive-backed
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
                        ? 'bg-[#C8302E] text-[#F5EDDD]'
                        : m.quiet
                        ? 'border border-[#F5EDDD]/12 text-[#F5EDDD]/55'
                        : 'bg-[#F5EDDD]/[0.06] text-[#F5EDDD]/85'
                    }`}
                  >
                    {m.text}
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
              <label htmlFor="ask" className="sr-only">Ask the assistant</label>
              <input
                id="ask"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Ask about custom, a place, or your trip"
                className="flex-1 bg-transparent px-3 py-3 text-sm focus:outline-none placeholder:text-[#F5EDDD]/35"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="bg-[#C8302E] hover:bg-[#A82826] disabled:opacity-30 disabled:cursor-not-allowed px-5 py-3 transition"
                aria-label="Send"
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
              How it is bounded
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-8">
              An assistant that speaks about a culture needs limits.
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed">
              A model that answers confidently about Ê Đê custom without a source is just a faster
              way to spread a wrong idea. These four rules are design constraints, not settings.
            </p>
          </div>

          <div className="md:col-span-7 grid sm:grid-cols-2 gap-x-10 gap-y-10 pt-2">
            {GUARDRAILS.map((g) => (
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
            Ready to work out your footprint?
          </h2>
          <p className="text-[#F5EDDD]/70">
            The assistant can estimate it, or you can do it yourself in the impact tracker.
          </p>
        </div>
        <a
          href="#impact"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          Open the tracker
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
