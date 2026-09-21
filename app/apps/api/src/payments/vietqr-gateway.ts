import crypto from "node:crypto";
import type {
  PaymentGateway,
  PaymentInstruction,
  PaymentIntent,
  PaymentStatus,
} from "./gateway";

function bankId() {
  return process.env.PAYMENT_BANK_ID ?? "TCB";
}

function bankAccount() {
  return process.env.PAYMENT_BANK_ACCOUNT ?? "";
}

function orderPrefix() {
  return process.env.ORDER_ID_PREFIX ?? "TWRTCK";
}

/** Transfer content for VietQR addInfo — unique enough to avoid collisions. */
export function buildPaymentRef(reference: string): string {
  const cleaned = reference.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  // Prefer a long unique suffix (cuid/order id). Cap length for bank addInfo limits.
  const suffix = (cleaned.length >= 12 ? cleaned.slice(-16) : cleaned) || crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${orderPrefix()}${suffix}`;
}

function buildQrUrl(amountVnd: number, paymentRef: string): string {
  const account = encodeURIComponent(bankAccount());
  const id = encodeURIComponent(bankId());
  const addInfo = encodeURIComponent(paymentRef);
  const name = encodeURIComponent("KNĂ");
  return `https://img.vietqr.io/image/${id}-${account}-compact2.png?amount=${amountVnd}&addInfo=${addInfo}&accountName=${name}`;
}

function verifyWebhookAuth(payload: unknown, headers?: Record<string, string | undefined>): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  const bearer = process.env.PAYMENT_WEBHOOK_TOKEN?.trim();

  if (secret) {
    const sig =
      headers?.["x-webhook-signature"] ??
      headers?.["X-Webhook-Signature"] ??
      "";
    const body = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (!sig || sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }

  if (bearer) {
    const auth =
      headers?.authorization ??
      headers?.Authorization ??
      "";
    const expected = `Bearer ${bearer}`;
    const a = Buffer.from(auth);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // Dev fallback: accept when neither secret nor token is configured.
  return process.env.NODE_ENV !== "production";
}

/**
 * Bank-transfer QR via img.vietqr.io. Settlement is confirmed by webhook
 * or coordinator verify (transaction-sync), not by the QR image itself.
 */
export class VietQRGateway implements PaymentGateway {
  readonly name = "vietqr";
  readonly settlesAutomatically = true;

  async createIntent(intent: PaymentIntent): Promise<PaymentInstruction & { paymentRef: string; qrUrl: string }> {
    if (!bankAccount()) {
      throw new Error("PAYMENT_BANK_ACCOUNT is not configured for VietQR.");
    }

    const paymentRef = buildPaymentRef(intent.reference);
    const qrUrl = buildQrUrl(intent.amountVnd, paymentRef);
    const holdMin = process.env.BOOKING_HOLD_MINUTES ?? "10";

    return {
      provider: this.name,
      status: "AWAITING_PAYMENT",
      paymentRef,
      qrUrl,
      amountVnd: intent.amountVnd,
      bankId: bankId(),
      bankAccount: bankAccount(),
      instructions:
        `Transfer ${intent.amountVnd.toLocaleString("vi-VN")} ₫ to ${bankId()} ${bankAccount()} ` +
        `with content "${paymentRef}". Hold expires in ~${holdMin} minutes. ` +
        `Demo token mint (devnet) runs after payment is confirmed — not real money on Solana.`,
    };
  }

  async verifyCallback(
    payload: unknown,
    headers?: Record<string, string | undefined>
  ): Promise<{
    reference: string;
    status: PaymentStatus;
    paymentRef?: string;
    amountVnd?: number;
  }> {
    if (!verifyWebhookAuth(payload, headers)) {
      throw new Error("Webhook authentication failed.");
    }

    const body = (payload ?? {}) as {
      reference?: string;
      paymentRef?: string;
      content?: string;
      addInfo?: string;
      status?: string;
      amount?: number;
      amountVnd?: number;
    };

    const paymentRef =
      body.paymentRef ?? body.reference ?? body.content ?? body.addInfo ?? "";
    if (!paymentRef) {
      throw new Error("Webhook payload missing payment reference.");
    }

    const statusRaw = String(body.status ?? "PAID").toUpperCase();
    const status: PaymentStatus =
      statusRaw === "FAILED" || statusRaw === "CANCELLED"
        ? "FAILED"
        : statusRaw === "REFUNDED"
          ? "REFUNDED"
          : "PAID";

    const amountVnd =
      typeof body.amountVnd === "number"
        ? body.amountVnd
        : typeof body.amount === "number"
          ? body.amount
          : undefined;

    return { reference: paymentRef, paymentRef, status, amountVnd };
  }
}
