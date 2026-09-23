import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notifyAll, reviewerIds } from "../lib/notify";
import {
  identify,
  requireAuth,
  requireCommittee,
  type AuthedRequest,
} from "../middleware/auth";
import { AI } from "../ai/config";
import { assistantGraph } from "../ai/graph";
import { modelsAvailable } from "../ai/llm";
import { GateFullError } from "../ai/queue";
import { corpusSize } from "../ai/retrieval";
import { ANSWER_TIERS } from "../lib/enums";

export const chatRouter = Router();

/**
 * The assistant's HTTP face.
 *
 * Open to visitors who have not signed in — the people most likely to be
 * about to cause offence by accident are exactly the ones without an
 * account yet — which is why the limiter is strict and the gate exists:
 * an unauthenticated endpoint in front of a GPU is otherwise a free
 * compute donation to whoever finds it.
 */

const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many questions at once — give it a few minutes." },
});

const flagLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reports at once — give it a few minutes." },
});

const askSchema = z.object({
  message: z.string().trim().min(1).max(AI.maxQuestionChars),
  // Client-generated, one per browser session. It is the LangGraph thread
  // id, which is what makes "và ở đó thì sao?" answerable — the
  // checkpointer replays this thread's transcript into the prompts.
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  locale: z.enum(["en", "vi"]).default("en"),
});

interface SseWriter {
  (event: string, data: unknown): void;
}

function openSse(res: Response): SseWriter {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Render sits nginx in front of the API; without this it buffers the
    // whole stream and delivers it as one lump at the end.
    "X-Accel-Buffering": "no",
  });
  return (event, data) => {
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

/**
 * POST /chat — ask, and stream the answer.
 *
 * Server-sent events, in order:
 *   token  {t}                     tier B only, as the model writes
 *   done   {tier, answer, sources} always, and `answer` is authoritative —
 *                                  a draft that failed verification streams
 *                                  tokens and is then REPLACED by a tier C
 *                                  refusal, so the client must render
 *                                  done.answer, not its own accumulation
 *   error  {code}                  "busy" | "failed"
 */
chatRouter.post("/", chatLimiter, async (req, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { message, sessionId, locale } = parsed.data;

  // The visitor's language beats the UI toggle: someone typing Vietnamese
  // into the English UI should be answered (and, on refusal, declined) in
  // Vietnamese. Diacritics are the reliable signal; accentless Vietnamese
  // falls back to the toggle, and the prompt still mirrors the question's
  // language when generating.
  const effectiveLocale = /[ăâđêôơưàảãáạèẻẽéẹìỉĩíịòỏõóọùủũúụỳỷỹýỵ]/i.test(message)
    ? ("vi" as const)
    : locale;

  const sse = openSse(res);

  // A closed tab must stop the generation. The GPU serves one request at a
  // time; finishing an answer nobody will read steals seconds from the
  // next person in the queue.
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  const config = {
    version: "v2" as const,
    configurable: { thread_id: sessionId },
    signal: abort.signal,
    recursionLimit: 25,
  };

  try {
    const events = assistantGraph.streamEvents(
      { question: message, locale: effectiveLocale },
      config
    );

    for await (const event of events) {
      if (event.event !== "on_chat_model_stream") continue;
      // Only the answer's own tokens reach the visitor. The condense and
      // tool-selection steps also run the model, and their output is
      // machinery, not prose. "general" is the labelled fallback answer.
      const node = (event.metadata as { langgraph_node?: string })?.langgraph_node;
      if (node !== "generate" && node !== "general") continue;
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

    // Every question the archive could not answer goes on the record —
    // the content team's to-do list writes itself. Fire-and-forget: a
    // logging hiccup must never break the conversation.
    const finalTier = state.tier ?? "C";
    if (finalTier === "C" || finalTier === "D") {
      prisma.assistantGap
        .create({ data: { question: message, locale: effectiveLocale, tier: finalTier } })
        .catch(() => {});
    }
  } catch (err) {
    if (abort.signal.aborted) {
      // The visitor left. There is nobody to tell.
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

/**
 * GET /chat/health — what the assistant can do right now.
 *
 * The UI reads this once on mount: `model: true` means full answers,
 * `model: false` with documents present means approved-answers only, and
 * an empty corpus means the sync has not run.
 */
chatRouter.get("/health", async (_req, res) => {
  const [model, en, vi] = await Promise.all([
    modelsAvailable(),
    corpusSize("en"),
    corpusSize("vi"),
  ]);
  res.json({
    model,
    chatModel: AI.chatModel,
    embedModel: AI.embedModel,
    documents: { en, vi },
  });
});

/**
 * GET /chat/gaps — the questions the archive could not answer.
 *
 * The assistant's own to-do list for the content team: add the missing
 * knowledge (a card, a document in data/, an archive entry), re-run the
 * sync, and the gap closes. Newest first, because what visitors are
 * asking *now* is what the next content sprint should cover.
 */
chatRouter.get(
  "/gaps",
  requireAuth,
  requireCommittee,
  async (_req: AuthedRequest, res) => {
    const gaps = await prisma.assistantGap.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(gaps);
  }
);

// ── Corrections (guardrail four) ─────────────────────────────────────

const flagSchema = z.object({
  question: z.string().trim().min(1).max(AI.maxQuestionChars),
  answer: z.string().trim().min(1).max(8000),
  tier: z.enum(ANSWER_TIERS),
  sourceIds: z.array(z.string().max(100)).max(20).default([]),
  reason: z.string().trim().max(1000).optional(),
});

/** Anyone may report an answer; a signed-in reporter is recorded, an anonymous one accepted. */
chatRouter.post("/flag", flagLimiter, identify, async (req: AuthedRequest, res) => {
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }

  const flag = await prisma.assistantFlag.create({
    data: {
      question: parsed.data.question,
      answer: parsed.data.answer,
      tier: parsed.data.tier,
      sourceIds: parsed.data.sourceIds,
      reason: parsed.data.reason?.trim() || null,
      reportedById: req.user?.id ?? null,
    },
  });

  // The same principle as the archive queue: the people who can act
  // should hear about it, not discover it.
  await notifyAll(prisma, await reviewerIds(), {
    type: "ASSISTANT_FLAGGED",
    params: { question: flag.question.slice(0, 80) },
    href: "#review",
  });

  res.status(201).json({ id: flag.id });
});

/** The Committee's queue, oldest open report first — nothing waits forever. */
chatRouter.get(
  "/flags",
  requireAuth,
  requireCommittee,
  async (_req: AuthedRequest, res) => {
    const flags = await prisma.assistantFlag.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: { reportedBy: { select: { fullName: true } } },
    });
    res.json(flags);
  }
);

const resolveSchema = z.object({
  decision: z.enum(["actioned", "dismissed"]),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Closing a report. "Actioned" means the correction went into the archive
 * — a card edited, added or withdrawn — which is the only place
 * corrections go. There is deliberately no endpoint that edits the
 * model's behaviour directly, because there is nothing of the kind to
 * edit: change the cards, re-run the sync, and the assistant follows.
 */
chatRouter.post(
  "/flags/:id/resolve",
  requireAuth,
  requireCommittee,
  async (req: AuthedRequest, res) => {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "A decision of 'actioned' or 'dismissed' is required." });
    }

    const flag = await prisma.assistantFlag.findUnique({ where: { id: req.params.id } });
    if (!flag) {
      return res.status(404).json({ error: "That report no longer exists." });
    }
    if (flag.status !== "OPEN") {
      return res.status(409).json({ error: "That report has already been handled." });
    }

    const updated = await prisma.assistantFlag.update({
      where: { id: flag.id },
      data: {
        status: parsed.data.decision === "actioned" ? "ACTIONED" : "DISMISSED",
        resolvedById: req.user!.id,
        resolvedAt: new Date(),
        resolutionNote: parsed.data.note?.trim() || null,
      },
    });

    res.json(updated);
  }
);
