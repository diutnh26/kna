import { Router } from "express";
import { prisma } from "../lib/prisma";
import { PENDING_LEDGER_WHERE, SETTLED_LEDGER_WHERE } from "../lib/ledger";

export const communityRouter = Router();

// Nothing here requires auth: this table being world-readable *is* the
// transparency feature. It is the Phase 1 "Proof of Impact" — a plain
// database ledger, and the reconciliation target for the Phase 2 contract.

// Only settled rows. A pending booking is a promise, not a distribution,
// and publishing it as one is the single thing that would most undermine
// the claim this ledger exists to make. See lib/ledger.ts.
communityRouter.get("/ledger", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const entries = await prisma.ledgerEntry.findMany({
    where: SETTLED_LEDGER_WHERE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(entries);
});

/** "Q2 2026" -> 20262, so quarters sort newest-first as numbers. */
function quarterRank(quarter: string) {
  const match = /^Q([1-4])\s+(\d{4})$/.exec(quarter);
  if (!match) return 0;
  return Number(match[2]) * 10 + Number(match[1]);
}

// Returns an array, not an object keyed by quarter: the client renders
// these as an ordered set of tabs, and JSON object key order is not
// something to rely on.
communityRouter.get("/fund", async (_req, res) => {
  const entries = await prisma.communityFundEntry.findMany({
    orderBy: { amountVnd: "desc" },
  });

  const byQuarter = new Map<string, { quarter: string; totalVnd: number; lines: typeof entries }>();
  for (const entry of entries) {
    const bucket = byQuarter.get(entry.quarter) ?? { quarter: entry.quarter, totalVnd: 0, lines: [] };
    bucket.totalVnd += entry.amountVnd;
    bucket.lines.push(entry);
    byQuarter.set(entry.quarter, bucket);
  }

  const quarters = [...byQuarter.values()].sort((a, b) => quarterRank(b.quarter) - quarterRank(a.quarter));
  res.json(quarters);
});

communityRouter.get("/decisions", async (_req, res) => {
  const decisions = await prisma.committeeDecision.findMany({
    orderBy: { date: "desc" },
  });
  res.json(decisions);
});

communityRouter.get("/committee", async (_req, res) => {
  const members = await prisma.committeeMember.findMany({
    // The portrait hangs off Provider, not CommitteeMember: a seat-holder
    // who is also a host already has one, and asking for a second copy of
    // the same photograph would be asking the same person twice.
    include: {
      user: { select: { fullName: true, provider: { select: { imageUrl: true } } } },
    },
    orderBy: { sortOrder: "asc" },
  });
  // Flatten so the client isn't reaching through a relation for a name.
  res.json(
    members.map((m) => ({
      id: m.id,
      name: m.user.fullName,
      role: m.role,
      buon: m.buon,
      since: m.since,
      imageUrl: m.user.provider?.imageUrl ?? null,
    }))
  );
});

// Aggregates the public pages quote. Computed, never hardcoded in the UI —
// a transparency page that hardcodes its own numbers is the thing this
// platform exists to argue against.
communityRouter.get("/stats", async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    committeeCount,
    providerCount,
    artisanCount,
    ledgerToday,
    awaiting,
    fundTotal,
    buonGroups,
    demoAccounts,
  ] =
    await Promise.all([
      prisma.committeeMember.count(),
      prisma.provider.count({ where: { verified: true } }),
      prisma.provider.count({ where: { verified: true, type: "ARTISAN" } }),
      // Settled only, matching /ledger — otherwise the landing page's
      // "N more today" counted rows the table itself will not show.
      prisma.ledgerEntry.count({
        where: { AND: [SETTLED_LEDGER_WHERE, { createdAt: { gte: startOfToday } }] },
      }),
      prisma.ledgerEntry.count({ where: PENDING_LEDGER_WHERE }),
      prisma.communityFundEntry.aggregate({ _sum: { amountVnd: true } }),
      prisma.provider.groupBy({ by: ["buon"] }),
      // Drives the "demonstration data" banner. Derived from the data
      // rather than an environment flag on purpose: a flag someone forgets
      // to unset would label real pilot records as a demo, and a flag
      // someone forgets to set would present demo figures as real. This
      // clears itself the moment the demo accounts are removed.
      prisma.user.count({ where: { email: { endsWith: "@example.kna" } } }),
    ]);

  res.json({
    committeeMembers: committeeCount,
    verifiedProviders: providerCount,
    verifiedArtisans: artisanCount,
    buonOnboarded: buonGroups.length,
    ledgerEntriesToday: ledgerToday,
    // Surfaced rather than hidden. "3 bookings awaiting confirmation" is a
    // true and useful thing for a visitor to read; a pending booking shown
    // as settled revenue is not.
    ledgerEntriesAwaiting: awaiting,
    communityFundTotalVnd: fundTotal._sum.amountVnd ?? 0,
    isDemoData: demoAccounts > 0,
  });
});
