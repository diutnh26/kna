import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notify, notifyAll, reviewerIds } from "../lib/notify";
import {
  requireAuth,
  requireCommitteeSeat,
  requireContributor,
  type AuthedRequest,
} from "../middleware/auth";

export const archiveRouter = Router();

// ── Public reads ─────────────────────────────────────────────────────
// Every public query filters on PUBLISHED. A contributor's draft and a
// rejected entry are never readable here, only through the review queue.

archiveRouter.get("/", async (req, res) => {
  const { type } = req.query;
  const entries = await prisma.archiveEntry.findMany({
    where: {
      moderationStatus: "PUBLISHED",
      ...(typeof type === "string" && type !== "All" ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      meta: true,
      keeperBuon: true,
      body: true,
      pillar: true,
      // Explicit select, so a new column is invisible until named here.
      // imageUrl was added to the schema, written to every row and
      // rendered by the client, and still came back undefined from this
      // one endpoint — the other three use `include` and had it already.
      imageUrl: true,
      createdAt: true,
    },
  });
  res.json(entries);
});

/** Distinct entry types across published entries — drives the filter row. */
archiveRouter.get("/types", async (_req, res) => {
  const groups = await prisma.archiveEntry.groupBy({
    by: ["type"],
    where: { moderationStatus: "PUBLISHED" },
    _count: { _all: true },
  });
  res.json(groups.map((g) => ({ type: g.type, count: g._count._all })));
});

/** Published entry counts per pillar, so the Explore page stops guessing. */
archiveRouter.get("/pillars", async (_req, res) => {
  const groups = await prisma.archiveEntry.groupBy({
    by: ["pillar"],
    where: { moderationStatus: "PUBLISHED", pillar: { not: null } },
    _count: { _all: true },
  });
  res.json(groups.map((g) => ({ pillar: g.pillar, count: g._count._all })));
});

archiveRouter.get("/phrases", async (_req, res) => {
  const phrases = await prisma.phrase.findMany({
    where: { moderationStatus: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    select: { id: true, ede: true, en: true, note: true },
  });
  res.json(phrases);
});

// Not every record is kept by a village. The phrasebook belongs to the
// Committee, so its keeperBuon reads "Community Council", and counting that
// as a buôn left this screen reporting one more than the buôn figure on
// Landing and Marketplace, which count providers instead.
//
// A buôn is named "Buôn X" and an institution is not, which is the whole
// distinction. Stringly-typed, and the honest fix is a keeper type on the
// column; that is a migration, and this is one screen disagreeing with two
// others a fortnight before it is shown.
const KEEPER_IS_A_BUON = { keeperBuon: { startsWith: "Buôn " } };

archiveRouter.get("/stats", async (_req, res) => {
  const [published, buonGroups] = await Promise.all([
    // Every published entry counts here, the Committee's included: this is
    // how much the archive holds, not how many villages filled it.
    prisma.archiveEntry.count({ where: { moderationStatus: "PUBLISHED" } }),
    prisma.archiveEntry.groupBy({
      by: ["keeperBuon"],
      where: { moderationStatus: "PUBLISHED", ...KEEPER_IS_A_BUON },
    }),
  ]);
  res.json({ publishedEntries: published, contributingBuon: buonGroups.length });
});

// ── Contribution ─────────────────────────────────────────────────────

const submitSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  meta: z.string().min(1),
  keeperBuon: z.string().min(1),
  body: z.string().optional(),
  pillar: z.string().optional(),
});

// Providers and Committee members contribute; guests cannot. A submission
// always lands IN_REVIEW — there is deliberately no way to publish
// straight from this endpoint, whoever is calling it.
archiveRouter.post(
  "/",
  requireAuth,
  requireContributor,
  async (req: AuthedRequest, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const entry = await prisma.archiveEntry.create({
      data: {
        ...parsed.data,
        moderationStatus: "IN_REVIEW",
        contributedById: req.user!.id,
      },
    });

    // The Committee is the reason nothing publishes itself; they should not
    // have to poll the queue to find out there is something in it.
    await notifyAll(prisma, await reviewerIds(), {
      type: "ARCHIVE_AWAITING_REVIEW",
      params: { title: entry.title, type: entry.type },
      href: "#review",
    });

    res.status(201).json(entry);
  }
);

/** What the signed-in contributor has submitted, in any state. */
archiveRouter.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const entries = await prisma.archiveEntry.findMany({
    where: { contributedById: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(entries);
});

// ── Moderation ───────────────────────────────────────────────────────

archiveRouter.get(
  "/queue",
  requireAuth,
  requireCommitteeSeat,
  async (_req: AuthedRequest, res) => {
    const entries = await prisma.archiveEntry.findMany({
      where: { moderationStatus: "IN_REVIEW" },
      orderBy: { createdAt: "asc" }, // oldest first — nothing waits forever
      include: { contributedBy: { select: { fullName: true } } },
    });
    res.json(entries);
  }
);

/** Everything already decided, so the record is auditable after the fact. */
archiveRouter.get(
  "/reviewed",
  requireAuth,
  requireCommitteeSeat,
  async (_req: AuthedRequest, res) => {
    const entries = await prisma.archiveEntry.findMany({
      where: { moderationStatus: { in: ["PUBLISHED", "REJECTED"] } },
      orderBy: { moderatedAt: "desc" },
      include: {
        contributedBy: { select: { fullName: true } },
        moderatedBy: { select: { fullName: true } },
      },
    });
    res.json(entries);
  }
);

const reviewSchema = z.object({
  decision: z.enum(["publish", "reject"]),
  note: z.string().optional(),
});

archiveRouter.post(
  "/:id/review",
  requireAuth,
  requireCommitteeSeat,
  async (req: AuthedRequest, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "A decision of 'publish' or 'reject' is required." });
    }
    const { decision, note } = parsed.data;

    if (decision === "reject" && !note?.trim()) {
      return res.status(400).json({ error: "A reason is required when refusing an entry." });
    }

    const entry = await prisma.archiveEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) {
      return res.status(404).json({ error: "That entry no longer exists." });
    }
    if (entry.moderationStatus !== "IN_REVIEW") {
      return res.status(409).json({ error: "That entry has already been reviewed." });
    }

    const updated = await prisma.archiveEntry.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: decision === "publish" ? "PUBLISHED" : "REJECTED",
        moderatedById: req.user!.id,
        moderatedAt: new Date(),
        moderationNote: note?.trim() || null,
      },
    });

    // A refusal reaches the contributor with the reason attached. A
    // governance record nobody is told about is not much of a record.
    if (entry.contributedById) {
      await notify(prisma, {
        userId: entry.contributedById,
        type: decision === "publish" ? "ARCHIVE_PUBLISHED" : "ARCHIVE_REJECTED",
        params: { title: entry.title, note: note?.trim() ?? "" },
        href: "#account",
      });
    }

    res.json(updated);
  }
);

// ── Phrasebook review ────────────────────────────────────────────────
// Phrases publish the same way archive entries do: the Committee decides.
// New and edited phrases arrive IN_REVIEW (from the admin console) and wait
// here for a seat-holder.

archiveRouter.get(
  "/phrases/queue",
  requireAuth,
  requireCommitteeSeat,
  async (_req: AuthedRequest, res) => {
    const phrases = await prisma.phrase.findMany({
      where: { moderationStatus: "IN_REVIEW" },
      orderBy: { createdAt: "asc" },
    });
    res.json(phrases);
  }
);

archiveRouter.post(
  "/phrases/:id/review",
  requireAuth,
  requireCommitteeSeat,
  async (req: AuthedRequest, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "A decision of 'publish' or 'reject' is required." });
    }
    const { decision, note } = parsed.data;
    if (decision === "reject" && !note?.trim()) {
      return res.status(400).json({ error: "A reason is required when refusing a phrase." });
    }
    const claimed = await prisma.phrase.updateMany({
      where: { id: req.params.id, moderationStatus: "IN_REVIEW" },
      data: {
        moderationStatus: decision === "publish" ? "PUBLISHED" : "REJECTED",
        moderatedById: req.user!.id,
        moderatedAt: new Date(),
        moderationNote: note?.trim() || null,
      },
    });
    if (claimed.count !== 1) {
      const exists = await prisma.phrase.findUnique({ where: { id: req.params.id } });
      return exists
        ? res.status(409).json({ error: "That phrase has already been reviewed." })
        : res.status(404).json({ error: "That phrase no longer exists." });
    }
    res.json(await prisma.phrase.findUnique({ where: { id: req.params.id } }));
  }
);
