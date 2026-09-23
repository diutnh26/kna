import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { AI } from "./config";
import { normalize } from "./vector";

/**
 * The seam between this platform and whatever runs the model.
 *
 * It plays the role `src/payments/gateway.ts` plays for money, for the
 * same reason: which model runs, and where, is a decision the community
 * makes on grounds that are not engineering ones — cultural sovereignty
 * over the archive, a pilot budget, Nghị định 13/2023/NĐ-CP. LangChain's
 * model interface is what makes the swap a one-file change: everything
 * downstream types against these exports, so moving between Gemini,
 * Ollama, or any host the Committee ever approves means editing this file
 * and nothing else.
 *
 * Two providers live here today:
 *   gemini — Google's API. Chosen automatically when GEMINI_API_KEY is
 *            set. Everything lazy: nothing here constructs a client or
 *            validates the key at import time, because CI and the test
 *            suite load this module with no key and AI_PROVIDER=off.
 *   ollama — self-hosted models on localhost, the original pilot setup.
 *
 * `AI_PROVIDER=off` is a supported state, not a failure: the graph then
 * serves tier A (Committee-approved answers, verbatim) and tier C
 * (declining), both of which need no model. The assistant gets narrower,
 * never wrong.
 */

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

type AnyChatModel = ChatOllama | ChatGoogleGenerativeAI;
type AnyEmbeddings = OllamaEmbeddings | GoogleGenerativeAIEmbeddings;

let chat: AnyChatModel | undefined;
let queryEmbedder: AnyEmbeddings | undefined;
let documentEmbedder: AnyEmbeddings | undefined;

/** Whether a model is configured at all. The graph checks this before every model-touching node. */
export function modelEnabled(): boolean {
  return AI.provider !== "off";
}

/** The human-readable name of whatever should be answering, for error text. */
function backendLabel(): string {
  return AI.provider === "gemini" ? "the Gemini API" : `Ollama at ${AI.ollamaUrl}`;
}

function requireGeminiKey(): string {
  if (!AI.geminiApiKey) {
    throw new AiUnavailableError(
      "AI_PROVIDER is 'gemini' but GEMINI_API_KEY is not set in apps/api/.env."
    );
  }
  return AI.geminiApiKey;
}

export function chatModel(): AnyChatModel {
  if (!modelEnabled()) {
    throw new AiUnavailableError("No AI provider is configured (AI_PROVIDER=off).");
  }
  if (!chat) {
    if (AI.provider === "gemini") {
      chat = new ChatGoogleGenerativeAI({
        model: AI.chatModel,
        apiKey: requireGeminiKey(),
        // Zero, because this is a factual retrieval task. Sampling variety
        // is a feature when writing prose and a defect when relaying what
        // an elder said.
        temperature: 0,
        maxOutputTokens: AI.maxAnswerTokens,
        streaming: true,
        // Minimal thinking: the graph already did the deciding (retrieval
        // ran, evidence is attached); the model's job is short grounded
        // prose. Thinking tokens also count against maxOutputTokens.
        thinkingConfig: { thinkingLevel: "LOW" },
      });
    } else {
      chat = new ChatOllama({
        baseUrl: AI.ollamaUrl,
        model: AI.chatModel,
        // The fixed seed closes the rest of the temperature-0 gap: without
        // it Ollama still varies between runs, which made the same question
        // pass the verifier in one process and fail in another while this
        // was being built.
        temperature: 0,
        seed: 7,
        numPredict: AI.maxAnswerTokens,
        // Enough for the system prompt, five short cards, and a capped
        // memory window — and no more. Context is VRAM, and VRAM is the
        // constraint on that machine.
        numCtx: 4096,
      });
    }
  }
  return chat;
}

/**
 * Two embedder instances under Gemini, one under Ollama.
 *
 * Gemini's embedding endpoint takes a task type, and retrieval quality is
 * measurably better when passages are embedded as RETRIEVAL_DOCUMENT and
 * questions as RETRIEVAL_QUERY. Ollama's bge-m3 has no such switch, so
 * both roles share an instance there.
 */
function rawEmbedder(role: "query" | "document"): AnyEmbeddings {
  if (!modelEnabled()) {
    throw new AiUnavailableError("No AI provider is configured (AI_PROVIDER=off).");
  }
  if (AI.provider === "gemini") {
    if (role === "query") {
      queryEmbedder ??= new GoogleGenerativeAIEmbeddings({
        model: AI.embedModel,
        apiKey: requireGeminiKey(),
        taskType: TaskType.RETRIEVAL_QUERY,
      });
      return queryEmbedder;
    }
    documentEmbedder ??= new GoogleGenerativeAIEmbeddings({
      model: AI.embedModel,
      apiKey: requireGeminiKey(),
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });
    return documentEmbedder;
  }
  if (!queryEmbedder) {
    queryEmbedder = new OllamaEmbeddings({ baseUrl: AI.ollamaUrl, model: AI.embedModel });
    documentEmbedder = queryEmbedder;
  }
  return queryEmbedder;
}

function checkDimensions(vector: number[]): number[] {
  if (vector.length !== AI.embedDimensions) {
    // Caught here rather than at insert time, because the failure this
    // prevents is silent: vectors of the wrong width still store, still
    // compare, and simply return nonsense.
    throw new AiUnavailableError(
      `"${AI.embedModel}" returned ${vector.length} dimensions, but AI_EMBED_DIMENSIONS ` +
        `is ${AI.embedDimensions}. Set them to match, then re-run the sync.`
    );
  }
  return vector;
}

/**
 * Embeds one query, unit length.
 *
 * Normalised here rather than at call sites so that every vector in the
 * system is comparable by plain dot product and no caller can forget —
 * Ollama's bge-m3 output arrives at magnitude ~25, and Gemini only
 * guarantees pre-normalised output at its default dimensionality.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const vector = await rawEmbedder("query")
    .embedQuery(text)
    .catch((err: Error) => {
      throw new AiUnavailableError(`Could not reach ${backendLabel()}: ${err.message}`);
    });
  return normalize(checkDimensions(vector));
}

/** Embeds a batch of passages, unit length, in order. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const vectors = await rawEmbedder("document")
    .embedDocuments(texts)
    .catch((err: Error) => {
      throw new AiUnavailableError(`Could not reach ${backendLabel()}: ${err.message}`);
    });
  return vectors.map((v) => normalize(checkDimensions(v)));
}

// A positive Gemini health probe is trusted for a minute so that every
// page-load of the Assistant screen does not spend a metadata request on
// Google. Failures are never cached — recovery should show immediately.
let geminiHealthyUntil = 0;

/**
 * True when the model backend is reachable and configured.
 *
 * Ollama: reachable *and* has both configured models pulled — being up is
 * not enough, because a running Ollama with neither model pulled fails
 * every request, and "healthy" would be a lie the UI then repeats to the
 * visitor. Gemini: the key is set and the configured chat model exists,
 * checked against the models endpoint (a free metadata read, not an
 * inference call). The frontend uses this to decide between "ask me
 * anything" and the approved-answers-only notice.
 */
export async function modelsAvailable(): Promise<boolean> {
  if (!modelEnabled()) return false;

  if (AI.provider === "gemini") {
    if (!AI.geminiApiKey) return false;
    if (Date.now() < geminiHealthyUntil) return true;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(AI.chatModel)}`,
        {
          headers: { "x-goog-api-key": AI.geminiApiKey },
          signal: AbortSignal.timeout(AI.healthTimeoutMs),
        }
      );
      if (res.ok) geminiHealthyUntil = Date.now() + 60_000;
      return res.ok;
    } catch {
      return false;
    }
  }

  try {
    const res = await fetch(`${AI.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(AI.healthTimeoutMs),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    const installed = (body.models ?? []).map((m) => m.name ?? "");
    return [AI.embedModel, AI.chatModel].every((wanted) =>
      installed.some((name) => name === wanted || name === `${wanted}:latest`)
    );
  } catch {
    return false;
  }
}

/** Test seam: lets the suite swap in fake models without a live backend. */
export function setModelsForTest(fakes: { chat?: AnyChatModel; embeddings?: AnyEmbeddings }) {
  if (fakes.chat) chat = fakes.chat;
  if (fakes.embeddings) {
    queryEmbedder = fakes.embeddings;
    documentEmbedder = fakes.embeddings;
  }
}
