/**
 * Assistant configuration.
 *
 * Every value here is an environment variable with a default that works on
 * the development machine. Two providers are supported and the default is
 * chosen from what is configured:
 *
 *   gemini   Google's Gemini API via @langchain/google-genai. Picked
 *            automatically when GEMINI_API_KEY is set. Nothing to install
 *            or host, works on Render's free tier, and the models are far
 *            stronger than anything a 4 GB laptop GPU can seat.
 *   ollama   Self-hosted models on localhost. The original pilot setup,
 *            sized for the machine this was built on — 8 GB RAM, RTX 3050
 *            with 4 GB VRAM:
 *              qwen2.5:3b-instruct-q4_K_M   ~1.9 GB
 *              bge-m3                       ~1.2 GB   1024-dim
 *
 * Set AI_PROVIDER explicitly to override the autodetection.
 */

import path from "node:path";

function num(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const geminiApiKey = process.env.GEMINI_API_KEY ?? "";

const provider = (process.env.AI_PROVIDER ?? (geminiApiKey ? "gemini" : "ollama")) as
  | "gemini"
  | "ollama"
  | "off";

/** Provider-dependent defaults; env vars still override every one of them. */
const gemini = provider === "gemini";

export const AI = {
  /**
   * "gemini" | "ollama" | "off".
   *
   * "off" is not a broken state. It is Tier A + Tier C: the assistant
   * answers from Committee-approved cards and declines everything else,
   * which is a legitimate way to run in front of an audience with no model
   * to hand. The graph routes around the model automatically — see
   * src/ai/graph.ts. This is also what the tests run under.
   */
  provider,

  /** Read once here so llm.ts never touches process.env directly. */
  geminiApiKey,

  ollamaUrl: (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, ""),

  embedModel: process.env.AI_EMBED_MODEL ?? (gemini ? "gemini-embedding-001" : "bge-m3"),
  // gemini-flash-latest: Google's rolling alias for the newest Flash
  // model. Chosen over a pinned name because, as of 2026-09, Google 404s
  // the older 1.5/2.x flash models and closes 2.5-flash to new API keys —
  // a pinned default rots; the alias does not. Pin AI_CHAT_MODEL (e.g.
  // "gemini-3.6-flash") if a model change ever shifts answer behaviour.
  chatModel:
    process.env.AI_CHAT_MODEL ?? (gemini ? "gemini-flash-latest" : "qwen2.5:3b-instruct-q4_K_M"),

  /**
   * Must match the embedding model above. Recorded on every
   * KnowledgeDocument row so that changing the model invalidates the old
   * vectors rather than silently comparing them against new ones — cosine
   * between two different embedding spaces is a number, just not a
   * meaningful one. gemini-embedding-001 emits 3072 dims; bge-m3 1024.
   */
  embedDimensions: num("AI_EMBED_DIMENSIONS", gemini ? 3072 : 1024),

  /**
   * How similar a question must be to a card's *question* before the
   * card's approved answer is returned verbatim (tier A).
   *
   * High on purpose. A false positive here answers the wrong question with
   * total confidence, which is the one failure this platform cannot
   * afford. The scale depends on the embedding model; 0.82 was calibrated
   * for bge-m3 (2026-09-04) and re-verified for gemini-embedding-001
   * (2026-09-08: exact card phrasings score 0.91+, paraphrases 0.69 —
   * which fall through to tier B, as designed — and off-topic questions
   * top out at 0.47).
   */
  curatedThreshold: num("AI_CURATED_THRESHOLD", 0.82),

  /**
   * How similar a passage must be before it counts as evidence at all
   * (tier B). Below this for every passage, the assistant declines.
   *
   * This threshold *is* the scope classifier. There is no separate "is
   * this question about Ê Đê culture" model: a question the corpus cannot
   * support is out of scope by definition.
   *
   * Per-embedding-model, because different models put their scores on
   * different scales:
   *
   *   bge-m3 (0.45): from the 2026-09-04 run — off-topic probes topped
   *   out at 0.42, real questions cleared 0.48.
   *
   *   gemini-embedding-001 (0.66): re-calibrated 2026-09-09, after the
   *   reference documents (apps/api/data) joined the corpus. Their bulk of
   *   generic English competition-form prose lifted the off-topic lexical
   *   floor: "What is the capital of France?" now scores 0.641 against a
   *   form chunk (it was nowhere near before), while real questions' best
   *   passages still clear 0.71 — culture questions 0.72–0.92, project
   *   questions 0.71–0.73, one typed without diacritics 0.75. The old 0.60
   *   (2026-09-08, eight-card corpus) would answer France from a
   *   registration form.
   *
   * The margin is thin either way, which is a fact about the corpus being
   * eight cards, not about the threshold: more published cards widen it
   * from the top. Re-run `npm run ai:calibrate` before touching these.
   */
  evidenceThreshold: num("AI_EVIDENCE_THRESHOLD", gemini ? 0.66 : 0.45),

  /** How many passages reach the prompt. Small — the context window is not the constraint, the GPU is. */
  retrieveTopK: num("AI_TOP_K", 5),

  /** Longest question accepted. A chat box is not a file upload. */
  maxQuestionChars: num("AI_MAX_QUESTION_CHARS", 500),

  /**
   * Cap on generated tokens, so one runaway answer cannot hold the GPU
   * (or the bill) forever. Higher under Gemini because its 3.x models
   * count internal "thinking" tokens against this cap — 700 was enough to
   * truncate a one-sentence answer mid-price during bring-up.
   */
  maxAnswerTokens: num("AI_MAX_ANSWER_TOKENS", gemini ? 2048 : 700),

  /**
   * How much conversation memory reaches the model: the last N messages of
   * the thread. Memory is held by LangGraph's checkpointer keyed on the
   * visitor's session id; this cap is what keeps an afternoon-long
   * conversation from growing the prompt past what the GPU can seat.
   */
  memoryWindow: num("AI_MEMORY_WINDOW", 6),

  /**
   * A follow-up shorter than this, in a thread with history, goes through
   * the condense step — one extra model call that rewrites "và ở đó thì
   * sao?" into a question retrieval can actually embed. Longer questions
   * skip it: they tend to stand alone, and on this hardware every model
   * call is seconds, not milliseconds.
   */
  condenseUnderChars: num("AI_CONDENSE_UNDER_CHARS", 60),

  /**
   * How many generations may run at once, and how many may wait.
   *
   * One at a time, because there is one GPU with 4 GB on it. Two
   * concurrent generations do not run at half speed each — they contend
   * for VRAM and Ollama evicts and reloads models. Requests beyond the
   * queue limit are refused rather than parked forever.
   */
  concurrency: num("AI_CONCURRENCY", 1),
  queueLimit: num("AI_QUEUE_LIMIT", 4),

  /** Milliseconds before giving up on the model backend. A local 3B model runs 5–20s; Gemini is faster but remote. */
  requestTimeoutMs: num("AI_REQUEST_TIMEOUT_MS", 90_000),
  healthTimeoutMs: num("AI_HEALTH_TIMEOUT_MS", gemini ? 5_000 : 2_000),

  /** How long the in-process corpus cache is trusted before it re-reads. */
  corpusCacheMs: num("AI_CORPUS_CACHE_MS", 60_000),

  /**
   * Folder of PDF/DOCX reference documents the sync ingests alongside the
   * database corpus. Empty string disables ingestion entirely — the test
   * suite sets that, so its document counts stay machine-independent.
   * Defaults to apps/api/data whether running from src (tsx) or dist.
   */
  referenceDir:
    process.env.AI_REFERENCE_DIR !== undefined
      ? process.env.AI_REFERENCE_DIR
      : path.join(__dirname, "..", "..", "data"),
} as const;
