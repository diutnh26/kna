import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthedRequest extends Request {
  user?: { id: string; role: string };
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

export function signToken(payload: { id: string; role: string; tokenVersion: number }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Rejects the request unless a valid Bearer token is present *and* still
 * matches the account it names.
 *
 * The token is not the authority on what someone may do — the database is.
 * Previously `role` was read straight off the claim, so demoting a
 * coordinator left their existing token working for up to seven days, and
 * a leaked token could not be revoked at all. Now the role is re-read on
 * every request and the token's version must match the account's, which is
 * bumped whenever authority changes or the account signs out everywhere.
 *
 * The cost is one primary-key lookup per authenticated request. At pilot
 * scale that is not a consideration worth trading correctness for; if it
 * ever becomes one, the answer is a short-lived token with a refresh, not
 * trusting a week-old claim.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
  }

  let claim: { id: string; tokenVersion?: number };
  try {
    claim = jwt.verify(token, JWT_SECRET) as { id: string; tokenVersion?: number };
  } catch {
    return res.status(401).json({ error: "Session expired — sign in again." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: claim.id },
      select: { id: true, role: true, tokenVersion: true },
    });

    if (!user) {
      return res.status(401).json({ error: "That account no longer exists." });
    }
    // Tokens issued before this change carry no version; treat them as 0 so
    // an existing session survives the deploy rather than logging everyone
    // out — and any real revocation still invalidates them, because the
    // bump moves the account past 0.
    if ((claim.tokenVersion ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: "Session ended — sign in again." });
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Attaches the account if a valid token is present, and stays quiet if not.
 *
 * For routes that serve everyone but record *who*, when they happen to
 * know — the assistant's flag endpoint being the case in point: a visitor
 * reporting a wrong answer should not be turned away for lacking an
 * account, and a signed-in elder's report should carry their name.
 * Deliberately the same checks as requireAuth (version included), so a
 * revoked token cannot keep attributing actions to its old account; it
 * just downgrades to anonymous instead of failing the request.
 */
export async function identify(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const claim = jwt.verify(token, JWT_SECRET) as { id: string; tokenVersion?: number };
    const user = await prisma.user.findUnique({
      where: { id: claim.id },
      select: { id: true, role: true, tokenVersion: true },
    });
    if (user && (claim.tokenVersion ?? 0) === user.tokenVersion) {
      req.user = { id: user.id, role: user.role };
    }
  } catch {
    // An unreadable token on an optional-identity route is anonymity, not an error.
  }
  next();
}

/**
 * Ends every existing session for an account.
 *
 * Call this wherever authority changes — granting or withdrawing a
 * Committee seat, changing a role, a password reset, or a "sign out
 * everywhere" — so the change binds immediately instead of whenever the
 * old token happens to expire.
 */
export async function revokeSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

/** Restricts a route to one or more roles. Use after requireAuth. */
export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not allowed for this account type." });
    }
    next();
  };
}

/**
 * Committee authority comes from *holding a seat*, not from the Role enum.
 * A person can be a host and a Committee member at once — Amí H'Bia is
 * both — and a single-valued enum can't express that. So this checks for a
 * CommitteeMember record, which is also what the governance model says
 * confers the authority. ADMIN passes as a platform-operations escape
 * hatch (someone has to be able to unstick the queue).
 */
export async function requireCommittee(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in required." });
  }
  if (req.user.role === "ADMIN") return next();

  try {
    const seat = await prisma.committeeMember.findUnique({ where: { userId: req.user.id } });
    if (!seat) {
      return res
        .status(403)
        .json({ error: "Only Community Governance Committee members can review submissions." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Booking coordination — confirming that a household actually has the
 * dates — is platform operations, not governance. Committee members can
 * do it too, since in the pilot the same people often are the community
 * coordinators, but it does not require a seat the way reviewing does.
 */
export async function requireCoordinator(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in required." });
  }
  if (req.user.role === "ADMIN" || req.user.role === "COORDINATOR") return next();

  try {
    const seat = await prisma.committeeMember.findUnique({ where: { userId: req.user.id } });
    if (!seat) {
      return res.status(403).json({ error: "Only KNĂ coordinators can confirm bookings." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Contributing to the archive requires being someone the community can
 * identify: a verified provider, a Committee member, or platform staff.
 */
export async function requireContributor(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in required." });
  }
  if (req.user.role === "ADMIN") return next();

  try {
    const [provider, seat] = await Promise.all([
      prisma.provider.findUnique({ where: { userId: req.user.id } }),
      prisma.committeeMember.findUnique({ where: { userId: req.user.id } }),
    ]);
    if (!provider && !seat) {
      return res
        .status(403)
        .json({ error: "Only verified providers and Committee members can contribute entries." });
    }
    next();
  } catch (err) {
    next(err);
  }
}
