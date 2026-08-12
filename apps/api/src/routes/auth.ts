import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

/**
 * What the client is told about the signed-in person.
 *
 * `role` alone can't answer "may this person review submissions?" — a
 * Committee seat and a Provider record are separate things and one person
 * can hold both. So the client gets both facts explicitly rather than
 * trying to infer them from the enum.
 */
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
    isCommitteeMember: Boolean(user.committeeSeat),
    committeeRole: user.committeeSeat?.role ?? null,
    provider: user.provider,
  };
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().min(1),
  locale: z.enum(["en", "vi"]).default("en"),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { email, password, fullName, locale } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  // Self-signup always creates a guest. Becoming a provider means being
  // verified by a community representative, and a Committee seat is
  // nominated by a buôn — neither is something a signup form can grant.
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role: "GUEST", locale },
  });

  const token = signToken({ id: user.id, role: user.role });
  res.status(201).json({ token, user: await describeUser(user.id) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok || !user) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = signToken({ id: user.id, role: user.role });
  res.json({ token, user: await describeUser(user.id) });
});

/**
 * Re-reads the current user. The client restores its session from
 * localStorage, where a stored `user` can be stale — a seat granted or
 * withdrawn since the token was issued wouldn't show up otherwise.
 */
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    res.json({ user: await describeUser(req.user!.id) });
  } catch {
    res.status(401).json({ error: "That account no longer exists." });
  }
});
