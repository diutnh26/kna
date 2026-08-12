import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthedRequest extends Request {
  user?: { id: string; role: string };
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

export function signToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

/** Rejects the request unless a valid Bearer token is present. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    next();
  } catch {
    return res.status(401).json({ error: "Session expired — sign in again." });
  }
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
