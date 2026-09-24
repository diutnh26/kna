import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthedRequest extends Request {
  user?: { id: string; role: string };
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? "30");
/**
 * `lax` when web and API share a site (Docker, a custom domain). `none` when
 * they are on different sites — e.g. two *.onrender.com hosts, which are
 * cross-site because onrender.com is a public suffix — or the browser drops
 * the session cookies on every API call. `none` requires Secure; CORS
 * (credentials only for CORS_ORIGIN) is what then guards the endpoints.
 */
const COOKIE_SAMESITE: "lax" | "none" = process.env.COOKIE_SAMESITE === "none" ? "none" : "lax";
const COOKIE_SECURE =
  COOKIE_SAMESITE === "none" ||
  process.env.COOKIE_SECURE === "true" ||
  process.env.NODE_ENV === "production";

export const ACCESS_COOKIE = "access_token";
export const DISABLED_MESSAGE = "This account has been disabled. Contact KNĂ if you think this is a mistake.";
export const REFRESH_COOKIE = "refresh_token";

export function signToken(payload: { id: string; role: string; tokenVersion: number }) {
  return jwt.sign({ ...payload, type: "user" }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL } as jwt.SignOptions);
}

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    maxAge: maxAgeMs,
  };
}

/** Issue a fresh opaque refresh token, persist its hash, return the raw value for the cookie. */
export async function issueRefreshToken(userId: string) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt,
    },
  });
  return { raw, expiresAt };
}

export function setAuthCookies(res: Response, accessJwt: string, refreshRaw: string) {
  // Access cookie lifetime mirrors the JWT; refresh uses its own TTL.
  const accessMaxAgeMs = parseTtlMs(ACCESS_TOKEN_TTL) ?? 15 * 60 * 1000;
  const refreshMaxAgeMs = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(ACCESS_COOKIE, accessJwt, cookieOptions(accessMaxAgeMs));
  res.cookie(REFRESH_COOKIE, refreshRaw, cookieOptions(refreshMaxAgeMs));
}

export function clearAuthCookies(res: Response) {
  const opts = { httpOnly: true, secure: COOKIE_SECURE, sameSite: COOKIE_SAMESITE, path: "/" };
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}

/**
 * Sign cookies for a freshly authenticated session and return the access JWT
 * (still returned in the JSON body so existing API tests that use Bearer keep working).
 */
export async function establishSession(
  res: Response,
  user: { id: string; role: string; tokenVersion: number }
) {
  const accessJwt = signToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });
  const { raw: refreshRaw } = await issueRefreshToken(user.id);
  setAuthCookies(res, accessJwt, refreshRaw);
  return accessJwt;
}

function parseTtlMs(ttl: string): number | null {
  const m = /^(\d+)([smhd])$/i.exec(ttl.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * mult;
}

function extractAccessToken(req: Request): string | null {
  const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

/**
 * Rejects the request unless a valid access credential is present *and* still
 * matches the account it names.
 *
 * Credentials are read from the HttpOnly `access_token` cookie first; a
 * Bearer header is still accepted so existing tests and operators keep working.
 *
 * The token is not the authority on what someone may do — the database is.
 * Role is re-read on every request and the token's version must match the
 * account's, which is bumped whenever authority changes or the account
 * signs out everywhere.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractAccessToken(req);
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
      select: { id: true, role: true, tokenVersion: true, disabledAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: "That account no longer exists." });
    }
    if (user.disabledAt) {
      return res.status(403).json({ error: DISABLED_MESSAGE });
    }
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
 * Ends every existing session for an account: bump tokenVersion (kills access
 * JWTs) and revoke outstanding refresh rows.
 */
export async function revokeSessions(userId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
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
 * The admin console. ADMIN only — coordinators and Committee members keep
 * their own screens and do not get it.
 */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in required." });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only KNĂ admins can use the admin console." });
  }
  next();
}

/**
 * Publishing to the archive and the phrasebook is the Committee's decision,
 * and only theirs: a seat is required, and the ADMIN role does not stand in
 * for one. An admin who also holds a seat reviews as a Committee member.
 */
export async function requireCommitteeSeat(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Sign in required." });
  }
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
 * Committee authority comes from *holding a seat*, not from the Role enum.
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
