import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import {
  ACCOUNT_FLAG_GUEST,
  ACCOUNT_FLAG_PROVIDER,
  buildRegisterAccountIx,
  buildSetPaymentWalletIx,
  buildSubmitAttestationIx,
  fetchAccountRecord,
  recordedAtUnixFromIso,
  type LedgerAttestationPayload,
} from "@kna/chain-client";
import { prisma } from "../lib/prisma";
import { getChainGateway } from "./gateway";
import { loadWalletKeypair } from "./wallets";

/**
 * The platform registrar: a coordinator-role key that registers accounts,
 * records bookings and pays network fees, so users never need devnet SOL.
 */
export function loadRegistrar(): Keypair {
  const raw = process.env.KNA_REGISTRAR_KEYPAIR_B58?.trim();
  if (!raw) throw new Error("KNA_REGISTRAR_KEYPAIR_B58 is not configured");
  return Keypair.fromSecretKey(bs58.decode(raw));
}

export async function accountFlags(userId: string) {
  const provider = await prisma.provider.findUnique({ where: { userId }, select: { id: true } });
  return ACCOUNT_FLAG_GUEST | (provider ? ACCOUNT_FLAG_PROVIDER : 0);
}

/**
 * register_account for one user, signed by the registrar and by the user's
 * own fixed wallet. Idempotent: an account already on-chain with this
 * wallet is simply recorded as registered.
 */
export async function registerAccountOnChain(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("No wallet to register");
  if (wallet.registeredTx) return wallet;

  const connection = getChainGateway().connection();
  const onChain = await fetchAccountRecord(connection, userId);
  if (onChain) {
    if (onChain.wallet !== wallet.pubkey) {
      throw new Error("This account is already bound on-chain to a different wallet");
    }
    return prisma.wallet.update({
      where: { userId },
      data: { registeredTx: "already-registered", registeredAt: new Date(), registerError: null },
    });
  }

  const registrar = loadRegistrar();
  const walletKeypair = await loadWalletKeypair(userId);
  const flags = await accountFlags(userId);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: registrar.publicKey, blockhash, lastValidBlockHeight }).add(
    buildRegisterAccountIx({
      registrar: registrar.publicKey,
      wallet: walletKeypair.publicKey,
      userId,
      flags,
    })
  );
  const sig = await connection.sendTransaction(tx, [registrar, walletKeypair], {
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

  // Believe the chain: read the record back before saying it is registered.
  const record = await fetchAccountRecord(connection, userId);
  if (!record || record.wallet !== wallet.pubkey || record.flags !== flags) {
    throw new Error("Account record on-chain does not match after register_account");
  }
  return prisma.wallet.update({
    where: { userId },
    data: { registeredTx: sig, registeredAt: new Date(), registerError: null },
  });
}

/**
 * After a booking is paid: the registrar (a coordinator-role key) submits
 * its attestation, so the committee has something to finalize without a
 * coordinator opening Phantom. Verified on-chain like any submission.
 */
export async function submitAttestationAsRegistrar(opts: {
  ledgerEntryId: string;
  providerLabel: string;
  payload: LedgerAttestationPayload;
}) {
  const registrar = loadRegistrar();
  const gateway = getChainGateway();
  const connection = gateway.connection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: registrar.publicKey, blockhash, lastValidBlockHeight }).add(
    buildSubmitAttestationIx({
      coordinator: registrar.publicKey,
      ledgerId: opts.ledgerEntryId,
      providerLabel: opts.providerLabel,
      payload: opts.payload,
      recordedAtUnix: recordedAtUnixFromIso(opts.payload.recordedAtIso),
    })
  );
  const sig = await connection.sendTransaction(tx, [registrar], { preflightCommitment: "confirmed" });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return gateway.verifyPendingSubmission({
    ledgerEntryId: opts.ledgerEntryId,
    pendingTxSig: sig,
    providerLabel: opts.providerLabel,
    payload: opts.payload,
    expectedCoordinator: registrar.publicKey.toBase58(),
  });
}

export const canAutoSubmit = () => Boolean(process.env.KNA_REGISTRAR_KEYPAIR_B58?.trim());

/**
 * set_payment_wallet: pay this account's bookings from a linked Phantom.
 * The registrar (fee payer) and the account's fixed wallet sign here; the
 * browser adds Phantom's signature. `phantom === fixed wallet` unlinks, and
 * then the server holds every key it needs and sends it itself.
 */
export async function preparePaymentWallet(userId: string, phantom: PublicKey) {
  const connection = getChainGateway().connection();
  if (!(await fetchAccountRecord(connection, userId))) {
    throw new Error("This account is still being registered on-chain. Try again shortly.");
  }
  const registrar = loadRegistrar();
  const fixed = await loadWalletKeypair(userId);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: registrar.publicKey, blockhash, lastValidBlockHeight }).add(
    buildSetPaymentWalletIx({ wallet: fixed.publicKey, paymentWallet: phantom, userId })
  );
  tx.partialSign(registrar, fixed);
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function resetPaymentWallet(userId: string) {
  const connection = getChainGateway().connection();
  const registrar = loadRegistrar();
  const fixed = await loadWalletKeypair(userId);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: registrar.publicKey, blockhash, lastValidBlockHeight }).add(
    buildSetPaymentWalletIx({ wallet: fixed.publicKey, paymentWallet: fixed.publicKey, userId })
  );
  const sig = await connection.sendTransaction(tx, [registrar, fixed], { preflightCommitment: "confirmed" });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

/** The account's paying wallet as the chain has it. */
export async function onchainPaymentWallet(userId: string) {
  const record = await fetchAccountRecord(getChainGateway().connection(), userId);
  return record?.paymentWallet ?? null;
}
