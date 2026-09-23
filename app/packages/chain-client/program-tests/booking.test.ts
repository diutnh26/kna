import { afterAll, describe, expect, it } from "vitest";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { FailedTransactionMetadata } from "litesvm";
import {
  createInitializeMint2Instruction,
  createMintToInstruction,
  MINT_SIZE,
} from "@solana/spl-token";
import {
  ACCOUNT_FLAG_GUEST,
  ACCOUNT_FLAG_PROVIDER,
  BOOKING_BOOKED,
  BOOKING_CANCELLED,
  BOOKING_PAID,
  BOOKING_UNPAID,
  accountRecordPda,
  associatedTokenAddress,
  bookingRecordPda,
  buildCancelBookingIx,
  buildCreateAtaIdempotentIx,
  buildCreateBookingIx,
  buildInitializePaymentConfigIx,
  buildMarkUnpaidIx,
  buildPayBookingIx,
  buildRegisterAccountIx,
  buildSetAccountFlagsIx,
  buildSetPausedIx,
  buildSetPaymentWalletIx,
  decodeAccountRecord,
  decodeBookingRecord,
  decodePaymentConfig,
  decodeWalletRecord,
  hashUserId,
  paymentConfigPda,
  TOKEN_PROGRAM_ID,
  walletRecordPda,
} from "../src";
import {
  expectAlreadyInUse,
  expectAnchorError,
  expectOk,
  printComputeUnits,
  setup,
} from "./harness";

/**
 * The guest flow on-chain: one fixed wallet per account, a booking recorded
 * with its split, and payment at check-out from the guest's wallet in three
 * SPL token transfers — 90% provider, 3% Community Fund, 7% platform.
 */

afterAll(printComputeUnits);

const DECIMALS = 6;
const UNITS_PER_VND = 1_000n; // dKNA: 1 dKNA = 1,000 VND
const DAY = 86_400;
const TOTAL = 1_000_000;
const SPLIT = { totalVnd: TOTAL, platformVnd: 70_000, communityVnd: 30_000, providerVnd: 900_000 };

function flowSetup({ guestFundsVnd = BigInt(TOTAL) } = {}) {
  const base = setup();
  const { svm, send, admin, coordinator, vault } = base;

  const mint = Keypair.generate();
  const platform = Keypair.generate();
  const community = vault; // the Community Fund is the committee vault
  const guest = Keypair.generate();
  const provider = Keypair.generate();
  for (const kp of [guest, provider]) svm.airdrop(kp.publicKey, 1_000_000_000n);

  expectOk(
    send(
      "create_mint",
      [
        SystemProgram.createAccount({
          fromPubkey: admin.publicKey,
          newAccountPubkey: mint.publicKey,
          lamports: Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE))),
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(mint.publicKey, DECIMALS, admin.publicKey, null),
      ],
      [admin, mint]
    )
  );
  const ata = (owner: PublicKey) => associatedTokenAddress(mint.publicKey, owner);
  expectOk(
    send(
      "create_atas",
      [guest.publicKey, provider.publicKey, community.publicKey, platform.publicKey].map((o) =>
        buildCreateAtaIdempotentIx(admin.publicKey, o, mint.publicKey)
      ),
      [admin]
    )
  );
  if (guestFundsVnd > 0n) {
    expectOk(
      send(
        "mint_to_guest",
        [createMintToInstruction(mint.publicKey, ata(guest.publicKey), admin.publicKey, guestFundsVnd * UNITS_PER_VND)],
        [admin]
      )
    );
  }

  expectOk(
    send(
      "initialize_payment_config",
      [
        buildInitializePaymentConfigIx({
          authority: admin.publicKey,
          mint: mint.publicKey,
          platformWallet: platform.publicKey,
          communityWallet: community.publicKey,
          unitsPerVnd: UNITS_PER_VND,
        }),
      ],
      [admin]
    )
  );

  const register = (userId: string, wallet: Keypair, flags: number, registrar = coordinator) =>
    send(
      "register_account",
      [buildRegisterAccountIx({ registrar: registrar.publicKey, wallet: wallet.publicKey, userId, flags })],
      [registrar, wallet]
    );
  expectOk(register("user-guest", guest, ACCOUNT_FLAG_GUEST));
  expectOk(register("user-host", provider, ACCOUNT_FLAG_GUEST | ACCOUNT_FLAG_PROVIDER));

  const now = () => Number(svm.getClock().unixTimestamp);
  const setTime = (unix: number) => {
    const clock = svm.getClock();
    clock.unixTimestamp = BigInt(unix);
    svm.setClock(clock);
  };
  const t0 = now();
  const dates = { checkIn: t0 + DAY, checkOut: t0 + 3 * DAY };

  const createBooking = (
    bookingId: string,
    overrides: Partial<Parameters<typeof buildCreateBookingIx>[0]> = {},
    registrar = coordinator
  ) =>
    send(
      "create_booking",
      [
        buildCreateBookingIx({
          registrar: registrar.publicKey,
          bookingId,
          guestUserId: "user-guest",
          providerUserId: "user-host",
          ...dates,
          ...SPLIT,
          ...overrides,
        }),
      ],
      [registrar]
    );

  const pay = (
    bookingId: string,
    payer = guest,
    overrides: Partial<Parameters<typeof buildPayBookingIx>[0]> = {}
  ) =>
    send(
      "pay_booking",
      [
        buildPayBookingIx({
          payer: payer.publicKey,
          bookingId,
          guestUserId: "user-guest",
          mint: mint.publicKey,
          providerWallet: provider.publicKey,
          communityWallet: community.publicKey,
          platformWallet: platform.publicKey,
          ...overrides,
        }),
      ],
      [payer]
    );

  const balance = (owner: PublicKey) => {
    const acct = svm.getAccount(ata(owner));
    return acct ? Buffer.from(acct.data).readBigUInt64LE(64) : null;
  };
  const booking = (bookingId: string) => {
    const acct = base.account(bookingRecordPda(bookingId));
    return acct && decodeBookingRecord(acct.data, acct.owner);
  };

  return {
    ...base,
    mint,
    platform,
    community,
    guest,
    provider,
    ata,
    register,
    createBooking,
    pay,
    balance,
    booking,
    now,
    setTime,
    dates,
  };
}

describe("payment config", () => {
  it("records the dKNA mint, VND unit and the platform and Community Fund wallets", () => {
    const f = flowSetup();
    const acct = f.account(paymentConfigPda())!;
    const pc = decodePaymentConfig(acct.data, acct.owner);
    expect(pc.mint).toBe(f.mint.publicKey.toBase58());
    expect(pc.decimals).toBe(DECIMALS);
    expect(pc.unitsPerVnd).toBe(UNITS_PER_VND);
    expect(pc.platformWallet).toBe(f.platform.publicKey.toBase58());
    expect(pc.communityWallet).toBe(f.community.publicKey.toBase58());
  });
});

describe("register_account: one account, one fixed wallet", () => {
  it("binds the account to its wallet, looked up either way, with only a hash on-chain", () => {
    const f = flowSetup();
    const acct = f.account(accountRecordPda("user-guest"))!;
    const record = decodeAccountRecord(acct.data, acct.owner);
    expect(record.userHash).toBe(hashUserId("user-guest"));
    expect(record.wallet).toBe(f.guest.publicKey.toBase58());
    expect(record.paymentWallet).toBe(f.guest.publicKey.toBase58());
    expect(record.flags).toBe(ACCOUNT_FLAG_GUEST);

    const byWallet = f.account(walletRecordPda(f.guest.publicKey))!;
    expect(decodeWalletRecord(byWallet.data, byWallet.owner).userHash).toBe(hashUserId("user-guest"));
  });

  it("never gives an account a second wallet", () => {
    const f = flowSetup();
    expectAlreadyInUse(f.register("user-guest", Keypair.generate(), ACCOUNT_FLAG_GUEST));
  });

  it("never registers a wallet to a second account", () => {
    const f = flowSetup();
    expectAlreadyInUse(f.register("user-other", f.guest, ACCOUNT_FLAG_GUEST));
  });

  it("is registered only by the platform's coordinator-role key", () => {
    const f = flowSetup();
    expectAnchorError(f.register("user-x", Keypair.generate(), ACCOUNT_FLAG_GUEST, f.member), "Unauthorized");
    expectAnchorError(f.register("user-y", Keypair.generate(), ACCOUNT_FLAG_GUEST, f.outsider), "AccountNotInitialized");
  });

  it("rejects unknown account flags", () => {
    const f = flowSetup();
    expectAnchorError(f.register("user-z", Keypair.generate(), 0), "InvalidRole");
    expectAnchorError(f.register("user-z", Keypair.generate(), 8), "InvalidRole");
  });

  it("lets a linked wallet (Phantom) pay, only with both wallets' consent, and unlinks", () => {
    const f = flowSetup();
    const phantom = Keypair.generate();
    const link = (identity: Keypair, paying: Keypair) =>
      f.send(
        "set_payment_wallet",
        [buildSetPaymentWalletIx({ wallet: identity.publicKey, paymentWallet: paying.publicKey, userId: "user-guest" })],
        [identity, paying]
      );
    // Someone else's key cannot redirect this account's payments.
    expectAnchorError(link(f.outsider, phantom), "Unauthorized");

    expectOk(link(f.guest, phantom));
    let acct = f.account(accountRecordPda("user-guest"))!;
    expect(decodeAccountRecord(acct.data, acct.owner).paymentWallet).toBe(phantom.publicKey.toBase58());
    // The fixed wallet never changes.
    expect(decodeAccountRecord(acct.data, acct.owner).wallet).toBe(f.guest.publicKey.toBase58());

    expectOk(link(f.guest, f.guest));
    acct = f.account(accountRecordPda("user-guest"))!;
    expect(decodeAccountRecord(acct.data, acct.owner).paymentWallet).toBe(f.guest.publicKey.toBase58());
  });

  it("marks a guest who becomes a host as a provider", () => {
    const f = flowSetup();
    expectOk(
      f.send(
        "set_account_flags",
        [buildSetAccountFlagsIx({ registrar: f.coordinator.publicKey, userId: "user-guest", flags: 3 })],
        [f.coordinator]
      )
    );
    const acct = f.account(accountRecordPda("user-guest"))!;
    expect(decodeAccountRecord(acct.data, acct.owner).flags).toBe(ACCOUNT_FLAG_GUEST | ACCOUNT_FLAG_PROVIDER);
  });
});

describe("create_booking", () => {
  it("records guest, host wallet, dates and the 7 / 3 / 90 split", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-1"));
    const b = f.booking("booking-1")!;
    expect(b.status).toBe(BOOKING_BOOKED);
    expect(b.guestUserHash).toBe(hashUserId("user-guest"));
    expect(b.providerWallet).toBe(f.provider.publicKey.toBase58());
    expect(b.checkIn).toBe(f.dates.checkIn);
    expect(b.checkOut).toBe(f.dates.checkOut);
    expect(b.providerVnd).toBe(900_000);
  });

  it("records a booking once", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-once"));
    expectAlreadyInUse(f.createBooking("booking-once"));
  });

  it("only pays hosts registered as providers", () => {
    const f = flowSetup();
    expectAnchorError(f.createBooking("booking-guest-host", { providerUserId: "user-guest" }), "NotProvider");
  });

  it("refuses check-out on or before check-in", () => {
    const f = flowSetup();
    expectAnchorError(f.createBooking("booking-dates", { checkOut: f.dates.checkIn }), "InvalidDates");
  });

  it("refuses a split other than 7 / 3 / 90", () => {
    const f = flowSetup();
    expectAnchorError(
      f.createBooking("booking-split", { platformVnd: 50_000, providerVnd: 920_000 }),
      "SplitMismatch"
    );
  });

  it("is recorded only by the platform's coordinator-role key", () => {
    const f = flowSetup();
    expectAnchorError(f.createBooking("booking-member", {}, f.member), "Unauthorized");
  });
});

describe("pay_booking: payment at check-out", () => {
  it("cannot be paid before the check-out date", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-early"));
    f.setTime(f.dates.checkOut - 1);
    expectAnchorError(f.pay("booking-early"), "NotPayableYet");
  });

  it("pays 90% to the provider, 3% to the Community Fund and 7% to the platform", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-pay"));
    f.setTime(f.dates.checkOut);
    expectOk(f.pay("booking-pay"));

    expect(f.balance(f.provider.publicKey)).toBe(900_000n * UNITS_PER_VND);
    expect(f.balance(f.community.publicKey)).toBe(30_000n * UNITS_PER_VND);
    expect(f.balance(f.platform.publicKey)).toBe(70_000n * UNITS_PER_VND);
    expect(f.balance(f.guest.publicKey)).toBe(0n);

    const b = f.booking("booking-pay")!;
    expect(b.status).toBe(BOOKING_PAID);
    expect(b.paidBy).toBe(f.guest.publicKey.toBase58());
    expect(b.paidAt).toBe(f.dates.checkOut);
  });

  it("cannot be paid twice", () => {
    const f = flowSetup({ guestFundsVnd: 2n * BigInt(TOTAL) });
    expectOk(f.createBooking("booking-twice"));
    f.setTime(f.dates.checkOut);
    expectOk(f.pay("booking-twice"));
    expectAnchorError(f.pay("booking-twice"), "InvalidState");
    expect(f.balance(f.provider.publicKey)).toBe(900_000n * UNITS_PER_VND);
  });

  it("is paid only from the guest's paying wallet", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-stranger"));
    f.setTime(f.dates.checkOut);
    // The provider holds dKNA-able accounts too, but is not this guest.
    expectAnchorError(f.pay("booking-stranger", f.provider), "Unauthorized");
  });

  it("is paid from the linked Phantom once linked, and no longer from the fixed wallet", () => {
    const f = flowSetup({ guestFundsVnd: 0n });
    const phantom = Keypair.generate();
    f.svm.airdrop(phantom.publicKey, 1_000_000_000n);
    expectOk(
      f.send(
        "fund_phantom",
        [
          buildCreateAtaIdempotentIx(f.admin.publicKey, phantom.publicKey, f.mint.publicKey),
          createMintToInstruction(f.mint.publicKey, f.ata(phantom.publicKey), f.admin.publicKey, BigInt(TOTAL) * UNITS_PER_VND),
          buildSetPaymentWalletIx({ wallet: f.guest.publicKey, paymentWallet: phantom.publicKey, userId: "user-guest" }),
        ],
        [f.admin, f.guest, phantom]
      )
    );
    expectOk(f.createBooking("booking-phantom"));
    f.setTime(f.dates.checkOut);
    expectAnchorError(f.pay("booking-phantom", f.guest), "Unauthorized");
    expectOk(f.pay("booking-phantom", phantom));
    expect(f.booking("booking-phantom")!.paidBy).toBe(phantom.publicKey.toBase58());
  });

  it("refuses a provider, Community Fund or platform account that is not the booked one", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-redirect"));
    f.setTime(f.dates.checkOut);
    const own = f.ata(f.guest.publicKey);
    expectAnchorError(f.pay("booking-redirect", f.guest, { providerToken: own }), "InvalidTokenAccount");
    expectAnchorError(f.pay("booking-redirect", f.guest, { communityToken: own }), "InvalidTokenAccount");
    expectAnchorError(f.pay("booking-redirect", f.guest, { platformToken: own }), "InvalidTokenAccount");
    expect(f.booking("booking-redirect")!.status).toBe(BOOKING_BOOKED);
  });

  it("fails as a whole when the wallet cannot cover the stay", () => {
    const f = flowSetup({ guestFundsVnd: 500_000n });
    expectOk(f.createBooking("booking-short"));
    f.setTime(f.dates.checkOut);
    expect(f.pay("booking-short")).toBeInstanceOf(FailedTransactionMetadata);
    expect(f.booking("booking-short")!.status).toBe(BOOKING_BOOKED);
    expect(f.balance(f.provider.publicKey)).toBe(0n);
  });

  it("refuses while the program is paused", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-paused"));
    f.setTime(f.dates.checkOut);
    expectOk(f.send("set_paused", [buildSetPausedIx(f.admin.publicKey, true)], [f.admin]));
    expectAnchorError(f.pay("booking-paused"), "Paused");
  });
});

describe("unpaid and cancelled bookings", () => {
  const markUnpaid = (f: ReturnType<typeof flowSetup>, id: string) =>
    f.send("mark_unpaid", [buildMarkUnpaidIx(f.coordinator.publicKey, id)], [f.coordinator]);
  const cancel = (f: ReturnType<typeof flowSetup>, id: string) =>
    f.send("cancel_booking", [buildCancelBookingIx(f.coordinator.publicKey, id)], [f.coordinator]);

  it("marks a booking UNPAID only after check-out, and it stays payable", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-late"));
    expectAnchorError(markUnpaid(f, "booking-late"), "NotPayableYet");
    f.setTime(f.dates.checkOut + DAY);
    expectOk(markUnpaid(f, "booking-late"));
    expect(f.booking("booking-late")!.status).toBe(BOOKING_UNPAID);
    expectOk(f.pay("booking-late"));
    expect(f.booking("booking-late")!.status).toBe(BOOKING_PAID);
  });

  it("cancels only before check-in, and a cancelled booking cannot be paid", () => {
    const f = flowSetup();
    expectOk(f.createBooking("booking-cancel"));
    expectOk(cancel(f, "booking-cancel"));
    expect(f.booking("booking-cancel")!.status).toBe(BOOKING_CANCELLED);
    f.setTime(f.dates.checkOut);
    expectAnchorError(f.pay("booking-cancel"), "InvalidState");

    expectOk(f.createBooking("booking-too-late"));
    expectAnchorError(cancel(f, "booking-too-late"), "InvalidDates");
  });
});
