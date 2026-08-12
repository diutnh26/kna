import { Router } from "express";
import { prisma } from "../lib/prisma";

export const communityRouter = Router();

// The Phase 1 "Proof of Impact" panel — Landing.jsx's LEDGER sample and
// Community.jsx's QUARTERS table both switch to this once wired up.
// No auth: this table being world-readable *is* the transparency feature.
communityRouter.get("/ledger", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const entries = await prisma.ledgerEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(entries);
});

communityRouter.get("/fund", async (req, res) => {
  const entries = await prisma.communityFundEntry.findMany({
    orderBy: { createdAt: "desc" },
  });
  const byQuarter = entries.reduce<Record<string, { total: number; lines: typeof entries }>>((acc, e) => {
    acc[e.quarter] ??= { total: 0, lines: [] };
    acc[e.quarter].total += e.amountVnd;
    acc[e.quarter].lines.push(e);
    return acc;
  }, {});
  res.json(byQuarter);
});

communityRouter.get("/decisions", async (req, res) => {
  const decisions = await prisma.committeeDecision.findMany({
    orderBy: { date: "desc" },
  });
  res.json(decisions);
});

communityRouter.get("/committee", async (req, res) => {
  const members = await prisma.committeeMember.findMany({
    include: { user: { select: { fullName: true } } },
  });
  res.json(members);
});
