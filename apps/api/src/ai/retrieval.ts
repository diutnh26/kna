import { prisma } from "../lib/prisma";
import { AI } from "./config";
import {
  buildIdf,
  lexicalScore,
  similarity,
  tokenize,
  unpackEmbedding,
} from "./vector";

/**
 * Finding the passages that may be quoted, and deciding when there are none.
 *
 * That second half is the part that matters. This module is the
 * assistant's scope classifier: there is no separate model asking "is this
 * question about Ê Đê culture", because a question the corpus cannot
 * support is out of scope by definition. Everything below the evidence
 * threshold gets declined, and declining is the default rather than the
 * error case.
 *
 * In LangChain terms this is a retriever, and `tools.ts` wraps it as a
 * Tool — but the graph calls it as an always-run node, never as something
 * the model may choose to invoke. A tool the model may call is also a tool
 * the model may skip, and "the model decided not to look" is precisely the
 * failure mode guardrail one exists to prevent.
 */

export interface IndexedDocument {
  id: string;
  sourceType: string;
  sourceId: string;
  kind: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  href: string | null;
  vector: Float32Array;
  tokens: Set<string>;
}

export interface Match {
  document: IndexedDocument;
  score: number;
  /** Kept apart from the blend so a calibration run can see both. */
  vectorScore: number;
  lexicalScore: number;
}

interface LocaleIndex {
  documents: IndexedDocument[];
  idf: Map<string, number>;
  loadedAt: number;
}

/**
 * How much of the ranking is dense retrieval versus word overlap.
 *
 * Dense retrieval handles paraphrase; the lexical share covers what
 * embeddings are worst at — rare proper nouns like "Akô Dhông", and
 * above all Vietnamese typed without diacritics, which bge-m3 reads as
 * badly degraded text. Calibration (ai:calibrate, 2026-09-04) put a real
 * accent-less question at vector 0.33 but lexical 0.71; at 75/25 it fell
 * below any workable threshold, at 60/40 it clears the evidence bar while
 * every off-topic probe stays under it.
 */
const VECTOR_WEIGHT = 0.6;
const LEXICAL_WEIGHT = 0.4;

const cache = new Map<string, LocaleIndex>();

/**
 * Drops the cached index.
 *
 * The sync runs as its own process, so in development it cannot reach this
 * — the TTL is what makes new cards appear. This exists for the test
 * suite and for a future in-process sync triggered by moderation.
 */
export function invalidateCorpus() {
  cache.clear();
}

async function loadIndex(locale: string): Promise<LocaleIndex> {
  const cached = cache.get(locale);
  if (cached && Date.now() - cached.loadedAt < AI.corpusCacheMs) return cached;

  const rows = await prisma.knowledgeDocument.findMany({
    where: {
      locale,
      // Vectors from a different embedding model are not comparable to the
      // one the question will be embedded with. Rather than trusting that
      // whoever changed AI_EMBED_MODEL re-ran the sync, filter.
      model: AI.embedModel,
      dim: AI.embedDimensions,
    },
  });

  const documents: IndexedDocument[] = rows.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    kind: row.kind,
    title: row.title,
    content: row.content,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    href: row.href,
    vector: unpackEmbedding(row.embedding),
    tokens: new Set(tokenize(`${row.title} ${row.content}`)),
  }));

  const index: LocaleIndex = {
    documents,
    idf: buildIdf(documents.map((d) => d.tokens)),
    loadedAt: Date.now(),
  };
  cache.set(locale, index);
  return index;
}

/** How many documents are searchable right now. Drives the health endpoint. */
export async function corpusSize(locale: string): Promise<number> {
  const index = await loadIndex(locale);
  return index.documents.length;
}

function rank(
  index: LocaleIndex,
  queryVector: Float32Array,
  queryTokens: string[],
  keep: (doc: IndexedDocument) => boolean
): Match[] {
  const matches: Match[] = [];

  for (const document of index.documents) {
    if (!keep(document)) continue;
    const vectorScore = similarity(queryVector, document.vector);
    const lexical = lexicalScore(queryTokens, document.tokens, index.idf);
    matches.push({
      document,
      vectorScore,
      lexicalScore: lexical,
      score: VECTOR_WEIGHT * vectorScore + LEXICAL_WEIGHT * lexical,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * The closest approved card to what was asked, if any is close enough.
 *
 * Matched question-to-question, not question-to-answer. Someone asking
 * "how do I greet an elder" should reach the card that answers exactly
 * that, and a card whose *answer* happens to mention greetings is a
 * weaker signal that belongs in the evidence tier instead.
 *
 * The threshold is high because a false positive here answers the wrong
 * question with total confidence, which is the one failure mode this
 * platform cannot afford.
 */
export async function findCuratedAnswer(
  question: string,
  locale: string,
  queryVector: Float32Array | null
): Promise<{ match: Match; answer: string } | null> {
  const index = await loadIndex(locale);
  const queryTokens = tokenize(question);
  const isQuestionCard = (d: IndexedDocument) =>
    d.kind === "QUESTION" && d.sourceType === "KnowledgeCard";

  let best: Match | undefined;

  if (queryVector) {
    [best] = rank(index, queryVector, queryTokens, isQuestionCard);
    if (!best || best.score < AI.curatedThreshold) return null;
  } else {
    // No embeddings — Ollama is off or unreachable. Word overlap against
    // the card questions still recognises the common phrasings (and the
    // suggested prompts, which match their cards exactly), so the
    // approved answers keep working with no model at all. The threshold
    // is its own: this score is on a different scale from the blend.
    const scored = index.documents
      .filter(isQuestionCard)
      .map((document) => ({
        document,
        vectorScore: 0,
        lexicalScore: lexicalScore(queryTokens, document.tokens, index.idf),
        score: lexicalScore(queryTokens, document.tokens, index.idf),
      }))
      .sort((a, b) => b.score - a.score);
    best = scored[0];
    if (!best || best.score < LEXICAL_ONLY_CURATED_THRESHOLD) return null;
  }

  const answer = best.document.metadata.answer;
  if (typeof answer !== "string" || !answer.trim()) return null;

  return { match: best, answer };
}

/** See findCuratedAnswer — the no-model matching floor. */
export const LEXICAL_ONLY_CURATED_THRESHOLD = 0.55;

/**
 * Evidence for a generated answer, or an empty list meaning "decline".
 *
 * Capped at one passage per source: five chunks of the same longhouse
 * listing are one piece of evidence wearing five hats, and they would push
 * out the corroboration that makes an answer worth trusting.
 */
export async function findEvidence(
  question: string,
  locale: string,
  queryVector: Float32Array
): Promise<Match[]> {
  const index = await loadIndex(locale);
  const queryTokens = tokenize(question);

  const ranked = rank(index, queryVector, queryTokens, (d) => d.kind === "PASSAGE");

  const chosen: Match[] = [];
  const seenSources = new Set<string>();

  for (const match of ranked) {
    if (match.score < AI.evidenceThreshold) break; // sorted, so nothing after clears it either
    const key = `${match.document.sourceType}:${match.document.sourceId}`;
    if (seenSources.has(key)) continue;
    seenSources.add(key);
    chosen.push(match);
    if (chosen.length >= AI.retrieveTopK) break;
  }

  return chosen;
}

/**
 * Every score for a question, for calibration.
 *
 * The thresholds above are the whole safety mechanism, and their right
 * values depend on the embedding model — bge-m3's scores do not sit on
 * the same scale as nomic-embed-text's. `npm run ai:calibrate -w apps/api`
 * uses this to print what the corpus actually scores, so the numbers are
 * chosen from evidence rather than from a plausible-looking default.
 */
export async function scoreAll(
  question: string,
  locale: string,
  queryVector: Float32Array
): Promise<Match[]> {
  const index = await loadIndex(locale);
  return rank(index, queryVector, tokenize(question), () => true);
}
