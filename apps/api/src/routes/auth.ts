import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../middleware/auth";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().min(1),
  role: z.enum(["GUEST", "PROVIDER"]).default("GUEST"),
  locale: z.enum(["en", "vi"]).default("en"),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { email, password, fullName, role, locale } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role, locale },
  });

  const token = signToken({ id: user.id, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, locale: user.locale },
  });
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
  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, locale: user.locale },
  });
});
