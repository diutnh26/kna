import crypto from "node:crypto";
import nodemailer from "nodemailer";

/**
 * Soft email delivery. If SMTP is not configured we still issue verify
 * tokens — the link is logged so local/dev can copy it — and never fail
 * the auth flow because mail is missing.
 */
export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info("[mail] SMTP not configured — skipping send:", opts.subject, "→", opts.to);
    console.info("[mail] body:\n", opts.text);
    return { sent: false as const };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      (process.env.SMTP_USERNAME || process.env.SMTP_USER) &&
      (process.env.SMTP_PASSWORD || process.env.SMTP_PASS)
        ? {
            user: process.env.SMTP_USERNAME || process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@kna.local",
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return { sent: true as const };
}

export function hashOpaque(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function newOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
}

export async function sendVerificationEmail(email: string, rawToken: string) {
  const link = `${publicBaseUrl()}/#account?verify=${encodeURIComponent(rawToken)}`;
  await sendMail({
    to: email,
    subject: "Verify your KNĂ account",
    text: `Welcome to KNĂ.\n\nConfirm your email by opening this link:\n${link}\n\nIf you did not create an account, you can ignore this message.`,
    html: `<p>Welcome to KNĂ.</p><p><a href="${link}">Confirm your email</a></p><p>If you did not create an account, you can ignore this message.</p>`,
  });
  return link;
}
