import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import { app, giveSeat, makeProvider, makeUser, resetDb, tokenFor } from "./helpers";
import {
  buildIdf,
  foldDiacritics,
  lexicalScore,
  normalize,
  packEmbedding,
  similarity,
  tokenize,
  unpackEmbedding,
} from "../src/ai/vector";
import { verbatimShare, verifyGrounding } from "../src/ai/prompt";
import { Gate, GateFullError } from "../src/ai/queue";
import { buildCorpus } from "../src/ai/corpus";
import { sync } from "../src/scripts/syncKnowledgeBase";
import { invalidateCorpus } from "../src/ai/retrieval";
import { detectTripIntent } from "../src/ai/graph";

/**
 * The assistant, tested the way the guardrails are phrased.
 *
 * The suite runs with AI_PROVIDER=off (tests/setup.ts), so nothing here
 * needs a GPU or a running Ollama — CI has neither. What that leaves is
 * exactly what the platform promises unconditionally: approved answers
 * returned verbatim, everything else declined, unpublished content
 * unreachable, and reports reaching the Committee.
 *
 * Embeddings are faked one-hot per text, so vector search is exercised
 * deterministically where a test needs it.
 */

/** Deterministic 1024-dim stand-in: the same text always lands on the same axis. */
function fakeEmbed(texts: string[]): Promise<number[][]> {
  return Promise.resolve(
    texts.map((text) => {
      let hash = 0;
      for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 1024;
      const v = new Array(1024).fill(0);
      v[hash] = 1;
      return v;
    })
  );
}

// ── Pure pieces ──────────────────────────────────────────────────────

describe("vector math", () => {
  it("round-trips an embedding through its stored bytes", () => {
    const original = normalize([0.5, -1.25, 3, 0.0001]);
    const back = unpackEmbedding(packEmbedding(original));
    expect([...back].map((x) => x.toFixed(5))).toEqual(original.map((x) => x.toFixed(5)));
  });

  it("normalizes to unit length and survives a zero vector", () => {
    const unit = normalize([3, 4]);
    expect(Math.hypot(...unit)).toBeCloseTo(1);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });

  it("scores mismatched dimensions as 0 instead of throwing", () => {
    expect(similarity(Float32Array.from([1, 0]), Float32Array.from([1, 0, 0]))).toBe(0);
  });

  it("folds Vietnamese diacritics, including đ", () => {
    expect(foldDiacritics("Cồng Chiêng ở Đắk Lắk")).toBe("Cong Chieng o Dak Lak");
  });

  it("matches accent-less typing against accented content", () => {
    const doc = new Set(tokenize("Cồng Chiêng là gì"));
    const idf = buildIdf([doc]);
    expect(lexicalScore(tokenize("cong chieng la gi"), doc, idf)).toBeGreaterThan(0.9);
  });
});

describe("grounding verifier", () => {
  const evidence = [
    "The ancestor shelf inside a longhouse is not photographed, and generally not discussed with visitors either.",
    "Funeral gongs are not photographed.",
  ];

  it("refuses an answer with no citations", () => {
    const long = "This sentence is certainly long enough to count as substantial prose.";
    expect(verifyGrounding(`${long} ${long}`, evidence).grounded).toBe(false);
  });

  it("refuses a citation of a source that was never provided", () => {
    const result = verifyGrounding("Something confidently attributed. [#7]", evidence);
    expect(result.grounded).toBe(false);
    expect(result.reason).toBe("citation-out-of-range");
  });

  it("hands a trailing marker back to the sentence it cites", () => {
    // In "A. [#1] B. [#2]" a naive split counts [#1] toward B — the
    // format the prompt itself demands would then fail verification.
    const answer =
      "The ancestor shelf inside a longhouse is never photographed at all. [#1] " +
      "Funeral gongs are likewise not photographed by visiting guests. [#2]";
    expect(verifyGrounding(answer, evidence).grounded).toBe(true);
  });

  it("refuses one decorative citation stapled to a paragraph", () => {
    const sentence = "Here is a confident claim that goes on long enough to be substantial.";
    const answer = `${sentence} ${sentence} ${sentence} ${sentence} ${sentence} [#1]`;
    const result = verifyGrounding(answer, evidence);
    expect(result.grounded).toBe(false);
    expect(result.reason).toBe("sparse-citations");
  });

  it("accepts a verbatim quote of one source, markers or not", () => {
    const result = verifyGrounding(evidence[0], evidence);
    expect(result.grounded).toBe(true);
    expect(result.reason).toBe("verbatim");
    expect(verbatimShare(evidence[0], evidence)).toBeGreaterThanOrEqual(0.8);
  });
});

describe("generation gate", () => {
  it("runs jobs one at a time and refuses past the queue limit", async () => {
    const gate = new Gate(1, 1);
    let release!: () => void;
    const blocker = new Promise<void>((r) => (release = r));

    const first = gate.run(() => blocker);
    const second = gate.run(async () => "queued");
    // Third arrival: one running, one waiting, queue limit 1 → refused now.
    await expect(gate.run(async () => "overflow")).rejects.toBeInstanceOf(GateFullError);

    release();
    await first;
    expect(await second).toBe("queued");
  });
});

describe("trip intent", () => {
  it("routes booking-shaped questions, accents or not", () => {
    expect(detectTripIntent("Which homestays can I book?")).toBe(true);
    expect(detectTripIntent("Lên giúp tôi lịch trình ba ngày")).toBe(true);
    expect(detectTripIntent("lich trinh ba ngay o Dak Lak")).toBe(true);
  });

  it("leaves cultural questions to the knowledge route", () => {
    expect(detectTripIntent("What is Cồng Chiêng?")).toBe(false);
    expect(detectTripIntent("Tôi nên chào người lớn tuổi thế nào?")).toBe(false);
  });
});

// ── What the assistant is allowed to know ────────────────────────────

describe("corpus rules", () => {
  beforeAll(async () => {
    await resetDb();
    const { provider } = await makeProvider("host@corpus.test");

    await prisma.listing.create({
      data: {
        providerId: provider.id,
        category: "STAY",
        title: "Longhouse stay",
        blurb: "Two rooms at the quiet end.",
        priceVnd: 500_000,
        unit: "per night",
        duration: "1 night minimum",
        groupSize: "Up to 4 guests",
        carbonRating: "Low",
        customs: "Remove shoes at the ladder.",
        published: true,
      },
    });

    await prisma.archiveEntry.createMany({
      data: [
        {
          type: "Oral history",
          title: "With a transcript",
          meta: "Narrated · 14 min",
          keeperBuon: "Buôn Test",
          body: "The full transcribed testimony lives here.",
          moderationStatus: "PUBLISHED",
        },
        {
          type: "Recording",
          title: "Catalogue card only",
          meta: "Six players · 22 min",
          keeperBuon: "Buôn Test",
          moderationStatus: "PUBLISHED",
        },
      ],
    });

    await prisma.knowledgeCard.createMany({
      data: [
        {
          topic: "etiquette",
          question: "Published card?",
          questionVi: "Card đã duyệt?",
          answer: "Yes.",
          answerVi: "Có.",
          moderationStatus: "PUBLISHED",
        },
        {
          topic: "etiquette",
          question: "Still in review?",
          questionVi: "Đang chờ duyệt?",
          answer: "Should never be retrievable.",
          answerVi: "Không bao giờ được truy xuất.",
          moderationStatus: "IN_REVIEW",
        },
      ],
    });
  });

  it("includes only published, prose-bearing material", async () => {
    const docs = await buildCorpus(prisma);
    const titles = docs.map((d) => d.title);

    // The unreviewed card is nowhere — not as a question, not as a passage.
    expect(JSON.stringify(docs)).not.toContain("Still in review");
    // Media without a transcript is a spine label, not knowledge.
    expect(titles).not.toContain("Catalogue card only");
    expect(titles).toContain("With a transcript");
  });

  it("keeps prices out of embedded text but in metadata", async () => {
    const docs = await buildCorpus(prisma);
    const listing = docs.find((d) => d.sourceType === "Listing" && d.locale === "en")!;
    expect(listing.content).not.toMatch(/500/);
    expect(listing.metadata.priceVnd).toBe(500_000);
    // The household's own rule is the point of including listings at all.
    expect(listing.content).toContain("Remove shoes at the ladder.");
  });

  it("emits each card once per language per kind", async () => {
    const docs = await buildCorpus(prisma);
    const cardDocs = docs.filter((d) => d.sourceType === "KnowledgeCard");
    expect(cardDocs).toHaveLength(4); // 1 published card × {en,vi} × {QUESTION,PASSAGE}
  });
});

describe("sync reconciliation", () => {
  it("removes documents whose source the Committee withdrew", async () => {
    await resetDb();
    invalidateCorpus();

    const card = await prisma.knowledgeCard.create({
      data: {
        topic: "culture",
        question: "What are the gongs?",
        questionVi: "Cồng chiêng là gì?",
        answer: "Tuned gongs.",
        answerVi: "Cồng chiêng đã chỉnh âm.",
        moderationStatus: "PUBLISHED",
      },
    });

    await sync(prisma, fakeEmbed);
    expect(await prisma.knowledgeDocument.count()).toBe(4);

    // The Committee changes its mind. This is the case the old
    // delete-then-insert sync silently got wrong: the embedding outlived
    // the decision, and the assistant kept citing withdrawn content.
    await prisma.knowledgeCard.update({
      where: { id: card.id },
      data: { moderationStatus: "REJECTED" },
    });

    await sync(prisma, fakeEmbed);
    expect(await prisma.knowledgeDocument.count()).toBe(0);
  });

  it("re-embeds only what changed", async () => {
    await resetDb();
    invalidateCorpus();

    await prisma.knowledgeCard.create({
      data: {
        topic: "culture",
        question: "Stable card?",
        questionVi: "Card ổn định?",
        answer: "Unchanged.",
        answerVi: "Không đổi.",
        moderationStatus: "PUBLISHED",
      },
    });

    let calls = 0;
    const counting = (texts: string[]) => {
      calls += texts.length;
      return fakeEmbed(texts);
    };

    await sync(prisma, counting);
    const afterFirst = calls;
    expect(afterFirst).toBe(4);

    await sync(prisma, counting);
    expect(calls).toBe(afterFirst); // second pass found nothing stale
  });
});

// ── The wire ─────────────────────────────────────────────────────────

/** Parses the SSE text supertest hands back into its events. */
function sseEvents(text: string): Array<{ event: string; data: Record<string, unknown> }> {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const block of text.split("\n\n")) {
    const event = /event: (\w+)/.exec(block)?.[1];
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (event && dataLine) events.push({ event, data: JSON.parse(dataLine.slice(6)) });
  }
  return events;
}

describe("POST /chat, with the model off", () => {
  beforeAll(async () => {
    await resetDb();
    invalidateCorpus();

    await prisma.knowledgeCard.create({
      data: {
        topic: "etiquette",
        question: "How do I greet an elder?",
        questionVi: "Tôi nên chào người lớn tuổi thế nào?",
        answer: "Let the elder speak first.",
        answerVi: "Hãy để người lớn tuổi lên tiếng trước.",
        href: "#explore",
        moderationStatus: "PUBLISHED",
      },
    });
    await sync(prisma, fakeEmbed);
  });

  it("returns the approved answer verbatim for a matching question", async () => {
    const res = await request(app)
      .post("/chat")
      .send({ message: "How do I greet an elder?", sessionId: "vitest-session-a", locale: "en" });

    expect(res.status).toBe(200);
    const done = sseEvents(res.text).find((e) => e.event === "done")!;
    expect(done.data.tier).toBe("A");
    expect(done.data.answer).toBe("Let the elder speak first.");
    expect((done.data.sources as unknown[]).length).toBe(1);
  });

  it("declines what the archive does not cover, instead of guessing", async () => {
    const res = await request(app)
      .post("/chat")
      .send({ message: "What is the capital of France?", sessionId: "vitest-session-b", locale: "en" });

    const done = sseEvents(res.text).find((e) => e.event === "done")!;
    expect(done.data.tier).toBe("C");
    expect(done.data.sources).toEqual([]);
  });

  it("rejects malformed input before any work happens", async () => {
    const short = await request(app)
      .post("/chat")
      .send({ message: "hello", sessionId: "nope", locale: "en" });
    expect(short.status).toBe(400);

    const long = await request(app)
      .post("/chat")
      .send({ message: "x".repeat(501), sessionId: "vitest-session-c", locale: "en" });
    expect(long.status).toBe(400);
  });
});

describe("the correction loop", () => {
  let chairToken: string;

  beforeAll(async () => {
    await resetDb();
    const chair = await makeUser("chair@flags.test", "COMMITTEE");
    await giveSeat(chair.id);
    await makeUser("guest@flags.test", "GUEST");
    chairToken = await tokenFor(request, "chair@flags.test");
  });

  it("takes a report from someone with no account, and tells the Committee", async () => {
    const res = await request(app).post("/chat/flag").send({
      question: "How do I greet an elder?",
      answer: "A wrong answer somebody saw.",
      tier: "B",
      sourceIds: ["doc-1"],
      reason: "This is not what my host told me.",
    });
    expect(res.status).toBe(201);

    const flag = await prisma.assistantFlag.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(flag.reportedById).toBeNull();
    expect(flag.status).toBe("OPEN");

    // The bell rings for the people who can act — same rule as the
    // archive queue.
    const heard = await prisma.notification.findFirst({ where: { type: "ASSISTANT_FLAGGED" } });
    expect(heard).not.toBeNull();
  });

  it("shows the queue only to the Committee", async () => {
    const guestToken = await tokenFor(request, "guest@flags.test");
    const denied = await request(app)
      .get("/chat/flags")
      .set("Authorization", `Bearer ${guestToken}`);
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .get("/chat/flags")
      .set("Authorization", `Bearer ${chairToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.length).toBeGreaterThan(0);
  });

  it("resolves a report once, and only once", async () => {
    const open = await prisma.assistantFlag.findFirstOrThrow({ where: { status: "OPEN" } });

    const resolved = await request(app)
      .post(`/chat/flags/${open.id}/resolve`)
      .set("Authorization", `Bearer ${chairToken}`)
      .send({ decision: "actioned", note: "Card corrected." });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe("ACTIONED");

    const again = await request(app)
      .post(`/chat/flags/${open.id}/resolve`)
      .set("Authorization", `Bearer ${chairToken}`)
      .send({ decision: "dismissed" });
    expect(again.status).toBe(409);
  });
});
