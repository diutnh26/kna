import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

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
