import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashOpaque, newOpaqueToken, sendVerificationEmail } from "../lib/mail";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  establishSession,
  hashToken,
  issueRefreshToken,
  requireAuth,
  revokeSessions,
  setAuthCookies,
  signToken,
  type AuthedRequest,
} from "../middleware/auth";

export const authRouter = Router();

const passwordPolicy = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/\d/, "Password must include a digit.");

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many attempts. Wait a few minutes and try again." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many attempts. Wait a minute and try again." },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many attempts. Wait a minute and try again." },
});

const googleLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many attempts. Wait a minute and try again." },
});

async function describeUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      committeeSeat: { select: { role: true, buon: true } },
      provider: { select: { id: true, displayName: true, type: true, buon: true, verified: true } },
    },
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    locale: user.locale,
    emailVerified: user.emailVerified,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleSub),
    isCommitteeMember: Boolean(user.committeeSeat),
    committeeRole: user.committeeSeat?.role ?? null,
    provider: user.provider,
  };
}

async function issueVerifyToken(userId: string) {
  const raw = newOpaqueToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifyToken: hashOpaque(raw),
      emailVerifyExpiry: expires,
    },
  });
  return raw;
}

async function respondWithSession(
  res: import("express").Response,
  user: { id: string; role: string; tokenVersion: number },
  status = 200
) {
  const token = await establishSession(res, user);
  return res.status(status).json({ token, user: await describeUser(user.id) });
}

const signupSchema = z.object({
  email: z.string().email(),
  password: passwordPolicy,
  fullName: z.string().min(1),
  locale: z.enum(["en", "vi"]).default("en"),
});

authRouter.post("/signup", registerLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { email, password, fullName, locale } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "GUEST",
      locale,
      emailVerified: false,
    },
  });

  const rawVerify = await issueVerifyToken(user.id);
  try {
    await sendVerificationEmail(email, rawVerify);
  } catch (err) {
    console.error("[mail] verification send failed:", err);
  }

  return respondWithSession(res, user, 201);
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    // Google-only accounts also land here — generic message on purpose.
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  return respondWithSession(res, user);
});

const googleSchema = z.object({
  idToken: z.string().min(1),
});

authRouter.post("/google", googleLimiter, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return res.status(503).json({ error: "Google Sign-In is not configured." });
  }

  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Google ID token is required." });
  }

  const client = new OAuth2Client(clientId);
  let payload: { sub?: string; email?: string; email_verified?: boolean; name?: string };
  try {
    const ticket = await client.verifyIdToken({
      idToken: parsed.data.idToken,
      audience: clientId,
    });
    payload = ticket.getPayload() ?? {};
  } catch {
    return res.status(401).json({ error: "Google sign-in failed. Try again." });
  }

  const googleSub = payload.sub;
  const email = payload.email?.toLowerCase();
  if (!googleSub || !email) {
    return res.status(401).json({ error: "Google did not return a usable account." });
  }

  // 1) Existing googleSub → login
  let user = await prisma.user.findUnique({ where: { googleSub } });
  if (user) {
    return respondWithSession(res, user);
  }

  // 2 / 3) Email match
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (!byEmail.emailVerified) {
      return res.status(409).json({
        error:
          "That email belongs to an unverified password account. Verify the email first, then link Google.",
      });
    }
    user = await prisma.user.update({
      where: { id: byEmail.id },
      data: { googleSub },
    });
    return respondWithSession(res, user);
  }

  // 4) Create
  user = await prisma.user.create({
    data: {
      email,
      fullName: payload.name?.trim() || email.split("@")[0] || "Traveler",
      role: "GUEST",
      googleSub,
      emailVerified: true,
      passwordHash: null,
    },
  });
  return respondWithSession(res, user, 201);
});

authRouter.post("/refresh", credentialLimiter, async (req, res) => {
  const raw =
    (req as typeof req & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE] ?? null;
  if (!raw) {
    return res.status(401).json({ error: "Sign in required." });
  }

  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, role: true, tokenVersion: true } } },
  });

  if (!row || row.revokedAt || row.expiresAt < new Date()) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Session expired — sign in again." });
  }

  // Rotate: revoke the presented token, issue a new pair.
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  const accessJwt = signToken({
    id: row.user.id,
    role: row.user.role,
    tokenVersion: row.user.tokenVersion,
  });
  const { raw: nextRefresh } = await issueRefreshToken(row.user.id);
  setAuthCookies(res, accessJwt, nextRefresh);

  return res.json({ ok: true, token: accessJwt, user: await describeUser(row.user.id) });
});

authRouter.post("/logout", async (req, res) => {
  const raw =
    (req as typeof req & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE] ?? null;
  if (raw) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Prefer bumping tokenVersion when we know who is signed in.
  const access =
    (req as typeof req & { cookies?: Record<string, string> }).cookies?.[ACCESS_COOKIE] ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);
  if (access) {
    try {
      const jwt = await import("jsonwebtoken");
      const claim = jwt.verify(access, process.env.JWT_SECRET ?? "dev-only-change-me") as {
        id?: string;
      };
      if (claim.id) await revokeSessions(claim.id);
    } catch {
      // Cookie may already be expired — still clear client cookies.
    }
  }

  clearAuthCookies(res);
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    res.json({ user: await describeUser(req.user!.id) });
  } catch {
    res.status(401).json({ error: "That account no longer exists." });
  }
});

/** @deprecated Prefer POST /auth/logout — kept so older clients still work. */
authRouter.post("/sign-out-everywhere", requireAuth, async (req: AuthedRequest, res) => {
  await revokeSessions(req.user!.id);
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get("/verify-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    return res.status(400).json({ error: "Missing verification token." });
  }

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: hashOpaque(token),
      emailVerifyExpiry: { gt: new Date() },
    },
  });
  if (!user) {
    return res.status(400).json({ error: "That verification link is invalid or has expired." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiry: null,
    },
  });

  return res.json({ ok: true, user: await describeUser(user.id) });
});

authRouter.post("/resend-verification", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (user.emailVerified) {
    return res.json({ ok: true, alreadyVerified: true });
  }

  const raw = await issueVerifyToken(user.id);
  try {
    await sendVerificationEmail(user.email, raw);
  } catch (err) {
    console.error("[mail] resend failed:", err);
    return res.status(500).json({ error: "Could not send the verification email." });
  }
  return res.json({ ok: true });
});
