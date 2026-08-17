import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const notificationsRouter = Router();

/**
 * A person's own notifications.
 *
 * Every route here is scoped to the caller. There is no notion of reading
 * somebody else's, and no admin view — a coordinator who needs to know
 * about a pending booking gets their own row for it, rather than a window
 * onto a guest's.
 */

/** The newest first, with the unread count the bell renders. */
notificationsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);

  res.json({ items, unread });
});

/**
 * Just the count.
 *
 * Separate from the list because the bell polls this and the list is only
 * fetched when somebody opens the panel — one small query on a timer
 * rather than thirty rows nobody is looking at.
 */
notificationsRouter.get("/unread-count", requireAuth, async (req: AuthedRequest, res) => {
  const unread = await prisma.notification.count({
    where: { userId: req.user!.id, readAt: null },
  });
  res.json({ unread });
});

const idsSchema = z.object({
  // Omitted means "everything", which is what the "mark all read" control
  // sends. Bounded so one request cannot ask for an unbounded update.
  ids: z.array(z.string().min(1)).max(200).optional(),
});

notificationsRouter.post("/read", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = idsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }

  const { count } = await prisma.notification.updateMany({
    // userId in the filter, not just the ids: without it, knowing an id
    // would be enough to mark somebody else's notification read.
    where: {
      userId: req.user!.id,
      readAt: null,
      ...(parsed.data.ids ? { id: { in: parsed.data.ids } } : {}),
    },
    data: { readAt: new Date() },
  });

  const unread = await prisma.notification.count({
    where: { userId: req.user!.id, readAt: null },
  });
  res.json({ marked: count, unread });
});
