import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const offsetsRouter = Router();

/**
 * Carbon offsets, attached to the booking they belong to.
 *
 * The rate and the joinability of each project live here rather than being
 * accepted from the client. The browser computes a figure to show the guest
 * before they commit, exactly as the booking screen does — and exactly as
 * there, the number that is stored is the one the server worked out. A
 * client that could name its own price could donate 1₫ and have the ledger
 * say so.
 */
const PROJECTS = {
  yokdon: { ratePerKgVnd: 1100, joinable: true },
  lak: { ratePerKgVnd: 950, joinable: true },
  corridor: { ratePerKgVnd: 1350, joinable: false },
} as const;

type ProjectId = keyof typeof PROJECTS;

/** What the household or group behind each project is called on the ledger. */
const PROJECT_LEDGER_LABEL: Record<ProjectId, string> = {
  yokdon: "Yok Đôn buffer replanting",
  lak: "Lắk Lake watershed planting",
  corridor: "Elephant corridor upkeep",
};

const offsetSchema = z.object({
  bookingId: z.string().min(1),
  projectId: z.enum(["yokdon", "lak", "corridor"]),
  // Bounded like every other figure that reaches the public ledger. The
  // tracker's own worst case — Europe by air, fourteen nights — is a little
  // over 2,500kg, so 20,000 is far beyond any real trip.
  kgCo2e: z.number().int().min(1).max(20_000),
  joining: z.boolean().default(false),
});

/**
 * Attach an offset to one of the caller's own bookings.
 *
 * Upsert rather than create: a guest revisiting the tracker and choosing a
 * different project should change their mind, not buy a second offset. The
 * schema enforces one per booking, so without this a second attempt would
 * fail on a unique constraint and read as a bug.
 */
offsetsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = offsetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { bookingId, projectId, kgCo2e, joining } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { select: { title: true } } },
  });

  // Not found and not-yours answer the same way. Distinguishing them would
  // let anyone confirm which booking ids exist.
  if (!booking || booking.guestId !== req.user!.id) {
    return res.status(404).json({ error: "That booking is not on your account." });
  }
  if (booking.status === "CANCELLED") {
    return res.status(409).json({ error: "That booking was cancelled." });
  }

  const project = PROJECTS[projectId];
  if (joining && !project.joinable) {
    return res
      .status(400)
      .json({ error: "That project is maintained year-round and does not take visiting help." });
  }

  const amountVnd = kgCo2e * project.ratePerKgVnd;

  const offset = await prisma.$transaction(async (tx) => {
    const saved = await tx.offsetContribution.upsert({
      where: { bookingId },
      create: { bookingId, projectId, kgCo2e, amountVnd, joining },
      update: { projectId, kgCo2e, amountVnd, joining },
    });

    // One ledger row per offset, replaced rather than added to when the
    // guest changes their mind — the filtered unique index would refuse a
    // second, and two rows would double the figure on the public table.
    await tx.ledgerEntry.deleteMany({ where: { offsetId: saved.id } });
    await tx.ledgerEntry.create({
      data: {
        offsetId: saved.id,
        fromLabel: `Traveler #${req.user!.id.slice(-4).toUpperCase()}`,
        toLabel: PROJECT_LEDGER_LABEL[projectId],
        totalVnd: amountVnd,
        // An offset is not a sale: nothing is retained and nothing is
        // split. The whole amount goes to the project.
        platformFeeVnd: 0,
        communityFundVnd: 0,
      },
    });

    return saved;
  });

  res.status(201).json({
    ...offset,
    listingTitle: booking.listing.title,
    // The guest is told plainly that this is not money yet, matching how
    // the booking itself behaves.
    settled: booking.status === "CONFIRMED" || booking.status === "COMPLETED",
  });
});

/**
 * The caller's bookings, with any offset already attached.
 *
 * Drives the tracker's booking picker: which stays can carry an offset,
 * and which already do.
 */
offsetsRouter.get("/bookings", requireAuth, async (req: AuthedRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { guestId: req.user!.id, status: { not: "CANCELLED" } },
    include: {
      listing: { select: { title: true, provider: { select: { displayName: true, buon: true } } } },
      offset: true,
    },
    orderBy: [{ checkIn: "asc" }, { createdAt: "desc" }],
  });

  res.json(
    bookings.map((b) => ({
      id: b.id,
      status: b.status,
      checkIn: b.checkIn,
      nights: b.nights,
      guests: b.guests,
      listingTitle: b.listing.title,
      provider: b.listing.provider.displayName,
      buon: b.listing.provider.buon,
      offset: b.offset
        ? {
            projectId: b.offset.projectId,
            kgCo2e: b.offset.kgCo2e,
            amountVnd: b.offset.amountVnd,
            joining: b.offset.joining,
          }
        : null,
    }))
  );
});

/** Remove an offset from a booking. */
offsetsRouter.delete("/:bookingId", requireAuth, async (req: AuthedRequest, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { offset: true },
  });
  if (!booking || booking.guestId !== req.user!.id) {
    return res.status(404).json({ error: "That booking is not on your account." });
  }
  if (!booking.offset) {
    return res.status(404).json({ error: "That booking has no offset." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany({ where: { offsetId: booking.offset!.id } });
    await tx.offsetContribution.delete({ where: { id: booking.offset!.id } });
  });

  res.json({ ok: true });
});
