/**
 * The payment seam.
 *
 * Which gateway KNĂ uses — VNPay or MoMo — is not an engineering choice:
 * it depends on which one the pilot buôn's households can actually settle
 * into, and it needs a merchant account nobody has opened yet. So this
 * defines the shape the rest of the system codes against, and ships one
 * honest implementation (manual settlement) that matches how the pilot
 * actually runs today.
 *
 * Adding VNPay or MoMo later means writing one more file in this folder
 * and changing PAYMENT_PROVIDER. Nothing outside `src/payments` should
 * need to know which is in use.
 */

export type PaymentStatus = "AWAITING_PAYMENT" | "PAID" | "FAILED" | "REFUNDED";

export interface PaymentIntent {
  /** Our reference — a Booking or Order id. */
  reference: string;
  amountVnd: number;
  description: string;
  /** Where the gateway should return the payer to, once one exists. */
  returnUrl?: string;
}

export interface PaymentInstruction {
  provider: string;
  status: PaymentStatus;
  /** Present only for gateways that redirect the payer. */
  redirectUrl?: string;
  /** Shown to the payer as-is. For manual settlement this is the actual instruction. */
  instructions: string;
}

export interface PaymentGateway {
  readonly name: string;
  /** Whether money can actually move through this gateway. */
  readonly settlesAutomatically: boolean;
  createIntent(intent: PaymentIntent): Promise<PaymentInstruction>;
  /** Verifies a gateway callback. Throws if the signature doesn't check out. */
  verifyCallback(payload: unknown): Promise<{ reference: string; status: PaymentStatus }>;
}

/**
 * How the pilot actually works: the guest arranges payment with the
 * household directly (cash on arrival, or a bank transfer the coordinator
 * confirms), and KNĂ records it. No money passes through the platform.
 *
 * This is not a stub standing in for a real gateway — it is a correct
 * description of the current arrangement, and the reason bookings sit
 * PENDING until a coordinator confirms them.
 */
export class ManualSettlementGateway implements PaymentGateway {
  readonly name = "manual";
  readonly settlesAutomatically = false;

  async createIntent(_intent: PaymentIntent): Promise<PaymentInstruction> {
    return {
      provider: this.name,
      status: "AWAITING_PAYMENT",
      instructions:
        "A KNĂ coordinator will confirm your dates with the household and arrange payment " +
        "directly with you. Nothing is charged through this site.",
    };
  }

  async verifyCallback(): Promise<{ reference: string; status: PaymentStatus }> {
    throw new Error(
      "Manual settlement has no gateway callback. A coordinator records payment by hand."
    );
  }
}

const GATEWAYS: Record<string, () => PaymentGateway> = {
  manual: () => new ManualSettlementGateway(),
  // vnpay: () => new VnpayGateway(...),   ← Phase 1 completion, once a
  // momo:  () => new MomoGateway(...),      merchant account exists
};

export function getPaymentGateway(): PaymentGateway {
  const configured = process.env.PAYMENT_PROVIDER ?? "manual";
  const factory = GATEWAYS[configured];
  if (!factory) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${configured}". Available: ${Object.keys(GATEWAYS).join(", ")}.`
    );
  }
  return factory();
}
