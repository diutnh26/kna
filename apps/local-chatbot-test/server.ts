import "./env"; // MUST be first — loads apps/api/.env before the AI config reads it
import path from "node:path";
import express, { type Response } from "express";
import cors from "cors";
import { z } from "zod";
import { AI } from "../api/src/ai/config";
import { assistantGraph } from "../api/src/ai/graph";
import { modelsAvailable } from "../api/src/ai/llm";
import { GateFullError } from "../api/src/ai/queue";
import { corpusSize } from "../api/src/ai/retrieval";

/**
 * The local chatbot test server.
 *
 * One process, two jobs: serve the static chat page in ./public, and run
 * the SAME assistant pipeline production uses — the three-tier LangGraph
 * graph from apps/api/src/ai/graph.ts, on Gemini — behind the same SSE
 * contract as POST /chat in apps/api/src/routes/chat.ts. Nothing is
 * mocked and nothing is copied: if it answers correctly here, the same
 * code answers correctly on the real website.
 *
 * Deliberately missing versus production: rate limiting, the flag/review
 * endpoints, auth. This is a bench, not a deployment.
 *
 *   npm run dev --workspace apps/local-chatbot-test
 *   → http://localhost:4100
 */

const PORT = Number(process.env.CHATBOT_TEST_PORT) || 4100;

const app = express();
// Wide-open CORS, on purpose: this server only ever runs on a developer's
// machine, and an open header lets the page be served from anywhere while
// testing (file://, another dev server) without ceremony.
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const askSchema = z.object({
  message: z.string().trim().min(1).max(AI.maxQuestionChars),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  locale: z.enum(["en", "vi"]).default("vi"),
});

function openSse(res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  return (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : ((part as { text?: string })?.text ?? "")))
      .join("");
  }
  return content == null ? "" : String(content);
}

/** Same wire contract as POST /chat in apps/api/src/routes/chat.ts. */
app.post("/chat", async (req, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { message, sessionId, locale } = parsed.data;

  const sse = openSse(res);
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const events = assistantGraph.streamEvents(
      { question: message, locale },
      {
        version: "v2" as const,
        configurable: { thread_id: sessionId },
        signal: abort.signal,
        recursionLimit: 25,
      }
    );

    for await (const event of events) {
      if (event.event !== "on_chat_model_stream") continue;
      const node = (event.metadata as { langgraph_node?: string })?.langgraph_node;
      if (node !== "generate") continue;
      const token = textOf((event.data as { chunk?: { content?: unknown } })?.chunk?.content);
      if (token) sse("token", { t: token });
    }

    const snapshot = await assistantGraph.getState({ configurable: { thread_id: sessionId } });
    const state = snapshot.values as {
      tier?: string;
      answer?: string;
      evidence?: Array<{
        id: string;
        sourceType: string;
        sourceId: string;
        title: string;
        href: string | null;
      }>;
    };

    sse("done", {
      tier: state.tier ?? "C",
      answer: state.answer ?? "",
      sources: (state.evidence ?? []).map((e) => ({
        id: e.id,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        title: e.title,
        href: e.href,
      })),
    });
  } catch (err) {
    if (abort.signal.aborted) {
      // The tab closed; nobody is listening.
    } else if (err instanceof GateFullError) {
      sse("error", { code: "busy" });
    } else {
      console.error("chat failed:", err);
      sse("error", { code: "failed" });
    }
  } finally {
    res.end();
  }
});

/** Same shape as GET /chat/health in production. */
app.get("/chat/health", async (_req, res) => {
  const [model, en, vi] = await Promise.all([modelsAvailable(), corpusSize("en"), corpusSize("vi")]);
  res.json({ model, chatModel: AI.chatModel, embedModel: AI.embedModel, documents: { en, vi } });
});

app.listen(PORT, () => {
  console.log("");
  console.log("  KNĂ — local chatbot test bench");
  console.log(`  provider   ${AI.provider}`);
  console.log(`  chat       ${AI.chatModel}`);
  console.log(`  embedder   ${AI.embedModel} (${AI.embedDimensions} dims)`);
  if (AI.provider === "gemini" && !AI.geminiApiKey) {
    console.log("  ⚠  GEMINI_API_KEY missing in apps/api/.env — only curated answers will work");
  }
  console.log("");
  console.log(`  Open http://localhost:${PORT}`);
  console.log("");
});
