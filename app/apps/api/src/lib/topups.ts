import { PublicKey } from "@solana/web3.js";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { mintDknaTo } from "../chain/demo-token";

/**
 * Credit a paid top-up (or a faucet grant): mint its amount as dKNA into the
 * account's fixed wallet. Once only — the row moves PAID → CREDITED under a
 * conditional update, and a failed mint keeps its error for a retry.
 */
export async function creditTopUp(topUpId: string) {
  const topUp = await prisma.topUp.findUniqueOrThrow({ where: { id: topUpId } });
  if (topUp.status === "CREDITED") return topUp;
  const wallet = await prisma.wallet.findUnique({ where: { userId: topUp.userId } });
  if (!wallet) throw new Error("This account has no wallet to credit.");
  try {
    const mintTx = await mintDknaTo(new PublicKey(wallet.pubkey), topUp.amountVnd);
    const updated = await prisma.topUp.update({
      where: { id: topUp.id },
      data: { status: "CREDITED", mintTx, error: null },
    });
    await notify(prisma, {
      userId: topUp.userId,
      type: "TOPUP_CREDITED",
      params: { amount: topUp.amountVnd },
      href: "#account",
    });
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mint failed";
    await prisma.topUp.update({ where: { id: topUp.id }, data: { error: message } });
    throw err;
  }
}

/** A VietQR payment for a top-up has arrived: mark it paid, then credit it. */
export async function markTopUpPaid(topUpId: string, expectedAmountVnd?: number) {
  const topUp = await prisma.topUp.findUniqueOrThrow({ where: { id: topUpId } });
  if (
    expectedAmountVnd !== undefined &&
    Number.isFinite(expectedAmountVnd) &&
    expectedAmountVnd > 0 &&
    expectedAmountVnd !== topUp.amountVnd
  ) {
    throw new Error(`Webhook amount ${expectedAmountVnd} does not match top-up ${topUp.amountVnd}.`);
  }
  const claimed = await prisma.topUp.updateMany({
    where: { id: topUp.id, status: "AWAITING_PAYMENT" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (claimed.count === 1) {
    await creditTopUp(topUp.id).catch((err) => console.error("[topup] credit failed:", topUp.id, err));
  }
  return prisma.topUp.findUniqueOrThrow({ where: { id: topUp.id } });
}
