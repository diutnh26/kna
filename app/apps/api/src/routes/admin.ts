import { Router, type NextFunction, type Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fetchPaymentConfig } from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth, type AuthedRequest } from "../middleware/auth";
import { AdminError, describe, diff, serialize, type Resource, type Row } from "../admin/engine";
import { RESOURCES, RESOURCE_BY_NAME } from "../admin/resources";
import { CatalogError } from "../lib/catalog";
import { DecisionError } from "../lib/decisions";
import { PaymentError } from "../chain/payments-onchain";
import { loadChainConfig } from "../chain/config";
import { getChainGateway } from "../chain/gateway";
import { canAutoSubmit, loadRegistrar } from "../chain/accounts-onchain";
import { loadFunder, loadMint } from "../chain/demo-token";

/**
 * The admin console's API: one set of endpoints serving every resource
 * described in admin/resources.ts, each change recorded in AdminAuditLog.
 *
 *   GET    /admin/meta                          what the console can show and do
 *   GET    /admin/system                        configuration and chain status
 *   GET    /admin/:resource                     list (?q, ?page, ?pageSize, ?sort, ?dir, filters)
 *   GET    /admin/:resource/:id                 one record, and the actions open to it
 *   GET    /admin/:resource/:id/history         its audit trail
 *   POST   /admin/:resource                     create
 *   PATCH  /admin/:resource/:id                 update
 *   DELETE /admin/:resource/:id                 remove (delete, or unpublish/disable), with a reason
 *   POST   /admin/:resource/:id/actions/:name   an action, e.g. cancel a booking
 */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin, jsonBodiesOnly);

/**
 * Changes must arrive as JSON. The session cookie is SameSite=None on
 * Render, so a form on another site could otherwise post here with it;
 * a JSON body needs a CORS preflight, which only the web app's origin
 * passes.
 */
function jsonBodiesOnly(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (!req.is("application/json")) {
    return res.status(415).json({ error: "Send changes as JSON." });
  }
  next();
}

type Delegate = {
  findMany: (args: unknown) => Promise<Row[]>;
  findUnique: (args: unknown) => Promise<Row | null>;
  count: (args: unknown) => Promise<number>;
};
const delegate = (r: Resource) => (prisma as unknown as Record<string, Delegate>)[r.model];

function resourceOf(req: AuthedRequest, res: Response): Resource | null {
  const r = RESOURCE_BY_NAME.get(req.params.resource);
  if (!r) {
    res.status(404).json({ error: `No admin resource "${req.params.resource}".` });
    return null;
  }
  return r;
}

function fail(res: Response, err: unknown) {
  if (
    err instanceof AdminError ||
    err instanceof CatalogError ||
    err instanceof DecisionError ||
    err instanceof PaymentError
  ) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: "That would duplicate an existing record." });
    if (err.code === "P2003") return res.status(409).json({ error: "Other records depend on this one." });
    if (err.code === "P2025") return res.status(404).json({ error: "That record no longer exists." });
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError && /check constraint/i.test(err.message)) {
    return res.status(400).json({ error: "The database refused that value." });
  }
  console.error("[admin]", err);
  // Admin-only: say what failed (a chain call, usually) rather than a blank 500.
  return res.status(500).json({ error: err instanceof Error ? `Failed: ${err.message}` : "Something went wrong." });
}

function invalid(res: Response, error: z.ZodError) {
  const issue = error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return res.status(400).json({ error: `${where}${issue?.message ?? "Invalid input."}` });
}

async function audit(
  db: Prisma.TransactionClient | typeof prisma,
  entry: { actor: string; resource: string; recordId: string | null; action: string; changes?: unknown; reason?: string | null }
) {
  await db.adminAuditLog.create({
    data: {
      actorUserId: entry.actor,
      resource: entry.resource,
      recordId: entry.recordId,
      action: entry.action,
      changes: entry.changes === undefined ? Prisma.JsonNull : (entry.changes as Prisma.InputJsonValue),
      reason: entry.reason ?? null,
    },
  });
}

async function runAfter(afters: Array<() => Promise<unknown>>) {
  for (const fn of afters) {
    await fn().catch((err) => console.error("[admin] follow-up failed:", err));
  }
}

// ── Meta and system ──────────────────────────────────────────────────

adminRouter.get("/meta", (_req, res) => {
  res.json({ resources: RESOURCES.map(describe) });
});

function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))]);
}

adminRouter.get("/system", async (_req, res) => {
  const config = loadChainConfig();
  const mint = loadMint();
  const registrar = canAutoSubmit() ? loadRegistrar().publicKey.toBase58() : null;

  const chain: Record<string, unknown> = { registrarSol: null, paymentConfig: null, error: null };
  if (process.env.SOLANA_ENABLED === "true") {
    try {
      const connection = getChainGateway().connection();
      const [lamports, pc] = await withTimeout(
        Promise.all([
          registrar ? connection.getBalance(loadRegistrar().publicKey) : Promise.resolve(null),
          fetchPaymentConfig(connection),
        ])
      );
      chain.registrarSol = lamports === null ? null : lamports / 1e9;
      chain.paymentConfig = pc ? serialize(pc) : null;
    } catch (err) {
      chain.error = err instanceof Error ? err.message : "RPC unavailable";
    }
  }

  const [outbox, bookings, users, providers] = await Promise.all([
    prisma.chainOutbox.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count(),
    prisma.provider.count(),
  ]);

  res.json({
    cluster: config.cluster,
    programId: config.programId,
    solanaEnabled: process.env.SOLANA_ENABLED === "true",
    workerEnabled: process.env.CHAIN_WORKER_ENABLED === "true",
    // Whether each key is set — never the key.
    configured: {
      walletEncryptionKey: Boolean(process.env.WALLET_ENCRYPTION_KEY?.trim()),
      registrarKey: Boolean(registrar),
      demoMint: Boolean(mint),
      demoFunderKey: Boolean(loadFunder()),
      paymentWebhook: Boolean(process.env.PAYMENT_WEBHOOK_SECRET?.trim() || process.env.PAYMENT_WEBHOOK_TOKEN?.trim()),
      smtp: Boolean(process.env.SMTP_HOST?.trim()),
      googleSignIn: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
    },
    registrar,
    mint: mint?.toBase58() ?? null,
    committeeVault: config.committeeVault || null,
    chain,
    counts: {
      users,
      providers,
      outbox: Object.fromEntries(outbox.map((g) => [g.status, g._count._all])),
      bookings: Object.fromEntries(bookings.map((g) => [g.status, g._count._all])),
    },
  });
});

// ── Generic resource endpoints ───────────────────────────────────────

adminRouter.get("/:resource", async (req: AuthedRequest, res) => {
  const r = resourceOf(req, res);
  if (!r) return;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const and: Record<string, unknown>[] = [];

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q && r.search.length) {
    and.push({ OR: r.search.map((f) => ({ [f]: { contains: q, mode: "insensitive" } })) });
  }
  for (const name of r.filters ?? []) {
    const value = req.query[name];
    if (typeof value !== "string" || value === "") continue;
    const field = r.fields.find((f) => f.name === name);
    and.push({ [name]: field?.type === "boolean" ? value === "true" : value });
  }

  const sortable = new Set([...r.fields.map((f) => f.name), "createdAt"]);
  const sortField = typeof req.query.sort === "string" && sortable.has(req.query.sort) ? req.query.sort : r.sort?.field ?? "id";
  const dir = req.query.dir === "asc" || req.query.dir === "desc" ? req.query.dir : r.sort?.dir ?? "desc";

  try {
    const where = and.length ? { AND: and } : {};
    const [rows, total] = await Promise.all([
      delegate(r).findMany({
        where,
        orderBy: { [sortField]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        ...(r.include ? { include: r.include } : {}),
      }),
      delegate(r).count({ where }),
    ]);
    res.json({ rows: rows.map((row) => serialize(row, r.hidden)), total, page, pageSize });
  } catch (err) {
    fail(res, err);
  }
});

async function load(r: Resource, id: string) {
  return delegate(r).findUnique({ where: { id }, ...(r.include ? { include: r.include } : {}) });
}

adminRouter.get("/:resource/:id", async (req: AuthedRequest, res) => {
  const r = resourceOf(req, res);
  if (!r) return;
  const row = await load(r, req.params.id);
  if (!row) return res.status(404).json({ error: "That record no longer exists." });
  res.json({
    record: serialize(row, r.hidden),
    actions: (r.actions ?? []).filter((a) => !a.when || a.when(row)).map((a) => a.name),
  });
});

adminRouter.get("/:resource/:id/history", async (req: AuthedRequest, res) => {
  const r = resourceOf(req, res);
  if (!r) return;
  const rows = await prisma.adminAuditLog.findMany({
    where: { resource: r.name, recordId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((a) => a.actorUserId))] } },
    select: { id: true, email: true },
  });
  const email = new Map(actors.map((a) => [a.id, a.email]));
  res.json(rows.map((a) => ({ ...a, actorEmail: email.get(a.actorUserId) ?? null })));
});

adminRouter.post("/:resource", async (req: AuthedRequest, res) => {
  const r = resourceOf(req, res);
  if (!r) return;
  if (!r.create) return res.status(405).json({ error: `${r.name} cannot be created here.` });
  const parsed = r.create.schema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);

  const afters: Array<() => Promise<unknown>> = [];
  try {
    const created = await prisma.$transaction(async (tx) => {
      const record = await r.create!.run({ actor: req.user!, after: (fn) => afters.push(fn), tx }, parsed.data);
      const out = serialize(record, r.hidden);
      await audit(tx, {
        actor: req.user!.id,
        resource: r.name,
        recordId: typeof record.id === "string" ? record.id : null,
        action: "create",
        changes: diff(null, out, [...(r.hidden ?? []), "password"]),
      });
      return out;
    });
    await runAfter(afters);
    res.status(201).json(created);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.patch("/:resource/:id", async (req: AuthedRequest, res) => {
  const r = resourceOf(req, res);
  if (!r) return;
  if (!r.update) return res.status(405).json({ error: `${r.name} cannot be edited here.` });
  const parsed = r.update.schema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const row = await load(r, req.params.id);
  if (!row) return res.status(404).json({ error: "That record no longer exists." });

  const afters: Array<() => Promise<unknown>> = [];
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const record = await r.update!.run({ actor: req.user!, after: (fn) => afters.push(fn), tx }, row, parsed.data);
      const out = serialize(record, r.hidden);
      await audit(tx, {
        actor: req.user!.id,
        resource: r.name,
        recordId: row.id,
        action: "update",
        changes: diff(serialize(row, r.hidden), out, r.hidden),
      });
      return out;
    });
    await runAfter(afters);
    res.json(updated);
  } catch (err) {
    fail(res, err);
  }
});

const reasonSchema = z.object({ reason: z.string().trim().min(3, "Give a reason.").max(1000) });

adminRouter.delete("/:resource/:id", async (req: AuthedRequest, res) => {
  const r = resourceOf(req, res);
  if (!r) return;
  if (!r.remove) return res.status(405).json({ error: `${r.name} cannot be removed here.` });
  const parsed = reasonSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const row = await load(r, req.params.id);
  if (!row) return res.status(404).json({ error: "That record no longer exists." });

  const afters: Array<() => Promise<unknown>> = [];
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const result = await r.remove!({ actor: req.user!, after: (fn) => afters.push(fn), tx }, row);
      await audit(tx, {
        actor: req.user!.id,
        resource: r.name,
        recordId: row.id,
        action: `remove:${result.outcome}`,
        changes: result.outcome === "deleted" ? diff(serialize(row, r.hidden), null, r.hidden) : undefined,
        reason: parsed.data.reason,
      });
      return result;
    });
    await runAfter(afters);
    res.json(outcome);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/:resource/:id/actions/:action", async (req: AuthedRequest, res) => {
  const r = resourceOf(req, res);
  if (!r) return;
  const action = r.actions?.find((a) => a.name === req.params.action);
  if (!action) return res.status(404).json({ error: `No action "${req.params.action}" on ${r.name}.` });
  const row = await load(r, req.params.id);
  if (!row) return res.status(404).json({ error: "That record no longer exists." });
  if (action.when && !action.when(row)) {
    return res.status(409).json({ error: "That action does not apply to this record now." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  let reason: string | null = null;
  if (action.reason) {
    const parsed = reasonSchema.safeParse(body);
    if (!parsed.success) return invalid(res, parsed.error);
    reason = parsed.data.reason;
  }
  let input: Record<string, unknown> = {};
  if (action.schema) {
    const parsed = action.schema.safeParse(body);
    if (!parsed.success) return invalid(res, parsed.error);
    input = parsed.data as Record<string, unknown>;
  }

  const afters: Array<() => Promise<unknown>> = [];
  const entry = { actor: req.user!.id, resource: r.name, recordId: row.id, action: action.name, reason };
  // Never keep a password an admin typed, even in the audit trail.
  const logged = Object.fromEntries(Object.entries(input).filter(([k]) => k !== "password"));
  const changes = Object.keys(logged).length ? logged : undefined;
  try {
    let result: unknown;
    if (action.transactional === false) {
      result = await action.run(
        { actor: req.user!, after: (fn) => afters.push(fn), tx: prisma as unknown as Prisma.TransactionClient, reason },
        row,
        input
      );
      await audit(prisma, { ...entry, changes });
    } else {
      result = await prisma.$transaction(async (tx) => {
        const out = await action.run({ actor: req.user!, after: (fn) => afters.push(fn), tx, reason }, row, input);
        await audit(tx, { ...entry, changes });
        return out;
      });
    }
    await runAfter(afters);
    res.json({ ok: true, result: result === undefined ? null : serialize(result) });
  } catch (err) {
    fail(res, err);
  }
});
