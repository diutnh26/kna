# The KNĂ assistant

A LangChain.js agent that answers visitors' questions about Ê Đê culture,
etiquette and trips — under the four guardrails the Assistant screen has
shipped with from the start: **it cites or it declines · it never speaks
for a household · it does not sell · the community can correct it.**

Two providers, selected in `config.ts`: **gemini** (Google's API — the
default whenever `GEMINI_API_KEY` is set; `gemini-flash-latest` +
`gemini-embedding-001`) and **ollama** (self-hosted, the original pilot
setup). The graph, retrieval, prompts and guardrails are identical under
both; `llm.ts` is the only file that knows which is running.

## The design decision everything else follows from

This is **not a free agent**. There is no ReAct loop in which the model
reasons about whether to consult the archive. The pipeline is a LangGraph
state machine with deterministic routing; retrieval always runs, an
evidence threshold always applies, and every road that fails it converges
on a refusal. The model runs only *inside* a route the graph has already
chosen.

Three reasons, in order:

1. **Guardrail one is a mechanism here, not a prompt.** A tool the model
   may call is a tool the model may skip, and "the model decided not to
   look" is exactly the failure the platform cannot afford.
2. **The model is small.** A 3B model on a 4 GB laptop GPU follows tool
   schemas well enough, and multi-step self-directed reasoning badly. The
   graph asks it only for the two things it is good at: choosing between
   two typed tools, and writing short grounded prose.
3. **Every model call costs seconds on this hardware.** ReAct spends
   3–6 calls per answer; this graph spends 1 (plus one embedding, plus at
   most one repair pass).

## The graph (`graph.ts`)

```
START → condense → curated ──A──────────────────────→ respond
                     │
                     ├─ no model reachable ─────→ refuse ─┐
                     ├─ trip intent → planTrip ─┬─ generate
                     └─ otherwise   → retrieve ─┘    │
                                        │ no evidence┆
                                        └──────→ refuse
                                             verify ─┬─ B → respond → END
                                                     ├─ missing markers, first
                                                     │  offence → repair → verify
                                                     └─ otherwise → refuse
```

Three tiers come out:

| Tier | What it is | Can it hallucinate? |
|---|---|---|
| **A** | A published `KnowledgeCard` matched the question above `AI_CURATED_THRESHOLD`; its Committee-approved answer is returned **verbatim** | No — nothing is generated |
| **B** | Generated strictly from retrieved passages, cited `[#n]`, checked by the verifier | Caught if it does — an unverifiable draft is replaced by the refusal *after* streaming, which is why the client renders `done.answer`, never its own token accumulation |
| **C** | The refusal. The **default**, not the error case | — |

**Memory** is LangGraph's checkpointer (`MemorySaver`): each browser
session is a thread, the transcript lives in graph state, and the last
`AI_MEMORY_WINDOW` messages are replayed into prompts. Short follow-ups
("what about the first one?") additionally pass through `condense`, one
model call that rewrites them into standalone questions so retrieval has
something to embed. In-process on purpose: transcripts never touch disk,
which is a privacy stance as much as a simplification.

**Tools** (`tools.ts`) follow two trust models. `search_archive` is a real
LangChain `tool()` but the graph runs it as an always-on node (see
reason 1). `find_listings` and `check_availability` are offered to the
model via `bindTools` in the trip branch only — they read live booking
tables where the worst wrong call returns no rows, and their results join
the same numbered-sources prompt, so the citation verifier covers them
too. If the model fumbles the tool-call format, the fallback is
deterministic: list what is bookable.

## Retrieval without pgvector (`vector.ts`, `retrieval.ts`)

Embeddings are raw float32 in a `BYTEA` column, compared exactly in the
application. At a few hundred documents an exact scan is faster *and* more
correct than an approximate index — and pgvector is absent from CI's
`postgres:17` image and from the portable Windows build development uses,
so adopting it would recreate the dev/prod divergence the API README's
"One engine everywhere" section warns about. Revisit past ~50k documents.

Search is hybrid: cosine (60%) + accent-folded lexical overlap (40%).
The lexical share is what makes Vietnamese typed without diacritics work —
bge-m3 reads "cach chao hoi nguoi gia" as badly degraded text, but the
folded tokens still match. The weights and both thresholds were set from a
calibration run (`npm run ai:calibrate`), not taste; re-run it whenever the
embedding model or the corpus changes shape.

## What the assistant may know (`corpus.ts`, `syncKnowledgeBase.ts`)

Only published, moderated content: `KnowledgeCard` (written for the
assistant, bilingual in one row so the Committee reviews one thing),
`ArchiveEntry` **only when it has a `body`** (most are catalogue cards for
media and would poison retrieval), `Phrase`, and `Listing` (whose
`customs` field is how guardrail two is honoured — the household's own
rule, quoted, never a generalisation). Prices are excluded from embedded
text and carried in metadata; the trip tools quote live prices instead.

`npm run ai:sync` rebuilds the knowledge base and **reconciles**: any
document whose source is no longer published is deleted. That is the
mechanism behind Committee withdrawals actually withdrawing. Run it after
seeding and after moderation decisions; it skips unchanged documents, so
re-running is cheap.

## Operations

```bash
# Gemini (default once GEMINI_API_KEY is in apps/api/.env):
npm run ai:sync        # after db:seed, after moderation changes, and after ANY provider/embedder change
npm run ai:calibrate   # prints real scores; read before touching thresholds

# Self-hosted instead: set AI_PROVIDER=ollama, then
ollama pull bge-m3 qwen2.5:3b-instruct-q4_K_M   # once
```

`GET /chat/health` reports whether the model backend is reachable and how
many documents are searchable; the Assistant screen adjusts its promise
accordingly. With `AI_PROVIDER=off` — or whenever the backend stops
answering — the assistant serves tiers A and C only: narrower, never
wrong.

One more note on `queue.ts`: it holds generation to one at a time. Under
Ollama that is physics (one 4 GB GPU); under Gemini it is a spending cap
on an unauthenticated endpoint, and `AI_CONCURRENCY` can be raised.

## Swapping the model

`llm.ts` is the seam, playing the role `payments/gateway.ts` plays for
money — it is where the Gemini/Ollama branch lives, and everything
downstream types against its exports, so any future host the community
approves is an edit to that one file. Changing the *embedding* model also
means updating `AI_EMBED_DIMENSIONS` and re-running the sync; retrieval
refuses to compare vectors across models, so a forgotten sync degrades to
refusals rather than to nonsense. The two thresholds are per-embedding-
model too — `config.ts` carries calibrated defaults for both providers
(bge-m3: 2026-09-04 run; gemini-embedding-001: 2026-09-08 run).
