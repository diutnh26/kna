import { afterAll, describe, expect, it } from "vitest";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { FailedTransactionMetadata } from "litesvm";
import {
  createInitializeMint2Instruction,
  createMintToInstruction,
  MINT_SIZE,
} from "@solana/spl-token";
import {
  associatedTokenAddress,
  buildCreateAtaIdempotentIx,
  buildInitializeTreasuryIx,
  buildSetPausedIx,
  buildSettleSplitIx,
  decodeSettlementRecord,
  decodeTreasury,
  settlementPdaFromLedgerId,
  TOKEN_PROGRAM_ID,
  treasuryPda,
} from "../src";
import {
  expectAlreadyInUse,
  expectAnchorError,
  expectOk,
  printComputeUnits,
  setup,
} from "./harness";

/**
 * settle_split: a finalized attestation paid out of the treasury escrow in
 * three CPI transfers into SPL Token — 90% provider, 3% Community Fund (the
 * committee vault), 7% platform — for exactly the amounts the committee
 * finalized, once.
 */

afterAll(printComputeUnits);

// dKNA: 6 decimals, 1 dKNA = 1,000 VND, so one VND is 1,000 base units.
const DECIMALS = 6;
const UNITS_PER_VND = 1_000n;
const BOOKING_VND = 1_000_000n;

function settlementSetup({ escrowVnd = BOOKING_VND, initTreasury = true } = {}) {
  const base = setup();
  const { svm, send, admin, coordinator, member, vault } = base;

  const mint = Keypair.generate();
  const platform = Keypair.generate();
  const provider = Keypair.generate();

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

  // Token accounts: escrow (owned by the treasury PDA), provider, Community
  // Fund (owned by the committee vault) and platform.
  const escrow = associatedTokenAddress(mint.publicKey, treasuryPda());
  const providerToken = associatedTokenAddress(mint.publicKey, provider.publicKey);
  const communityToken = associatedTokenAddress(mint.publicKey, vault.publicKey);
  const platformToken = associatedTokenAddress(mint.publicKey, platform.publicKey);
  expectOk(
    send(
      "create_atas",
      [treasuryPda(), provider.publicKey, vault.publicKey, platform.publicKey].map((owner) =>
        buildCreateAtaIdempotentIx(admin.publicKey, owner, mint.publicKey)
      ),
      [admin]
    )
  );

  // The guest's VND, represented in escrow.
  if (escrowVnd > 0n) {
    expectOk(
      send(
        "mint_to_escrow",
        [createMintToInstruction(mint.publicKey, escrow, admin.publicKey, escrowVnd * UNITS_PER_VND)],
        [admin]
      )
    );
  }

  const initialize = (authority = admin, vaultAccount = escrow) =>
    send(
      "initialize_treasury",
      [
        buildInitializeTreasuryIx({
          authority: authority.publicKey,
          mint: mint.publicKey,
          vault: vaultAccount,
          platformWallet: platform.publicKey,
          unitsPerVnd: UNITS_PER_VND,
        }),
      ],
      [authority]
    );
  if (initTreasury) expectOk(initialize());

  const balance = (tokenAccount: PublicKey) => {
    const acct = svm.getAccount(tokenAccount);
    return acct ? Buffer.from(acct.data).readBigUInt64LE(64) : null;
  };

  const settle = (
    ledgerId: string,
    signer = coordinator,
    overrides: Partial<Parameters<typeof buildSettleSplitIx>[0]> = {}
  ) =>
    send(
      "settle_split",
      [
        buildSettleSplitIx({
          settler: signer.publicKey,
          ledgerId,
          mint: mint.publicKey,
          vault: escrow,
          providerToken,
          communityToken,
          platformToken,
          ...overrides,
        }),
      ],
      [signer]
    );

  /** A booking attestation submitted by the coordinator and finalized by a member. */
  const finalized = (ledgerId: string) => {
    expectOk(base.submit(ledgerId, coordinator));
    expectOk(base.finalize(ledgerId, member));
  };

  return {
    ...base,
    mint,
    platform,
    provider,
    escrow,
    providerToken,
    communityToken,
    platformToken,
    balance,
    initialize,
    settle,
    finalized,
  };
}

describe("initialize_treasury", () => {
  it("records the mint, escrow, platform wallet and VND unit", () => {
    const { account, mint, escrow, platform } = settlementSetup();
    const acct = account(treasuryPda())!;
    const treasury = decodeTreasury(acct.data, acct.owner);
    expect(treasury.mint).toBe(mint.publicKey.toBase58());
    expect(treasury.vault).toBe(escrow.toBase58());
    expect(treasury.platformWallet).toBe(platform.publicKey.toBase58());
    expect(treasury.unitsPerVnd).toBe(UNITS_PER_VND);
    expect(treasury.decimals).toBe(DECIMALS);
    expect(treasury.settledCount).toBe(0);
  });

  it("lets only the coordinator authority set it up", () => {
    const s = settlementSetup({ initTreasury: false });
    expectAnchorError(s.initialize(s.outsider), "Unauthorized");
    expectOk(s.initialize());
  });

  it("refuses an escrow account the treasury PDA does not own", () => {
    const s = settlementSetup({ initTreasury: false });
    expectAnchorError(s.initialize(s.admin, s.providerToken), "InvalidTokenAccount");
  });
});

describe("settle_split", () => {
  it("pays the finalized 90 / 3 / 7 split out of escrow in three token transfers", () => {
    const s = settlementSetup();
    s.finalized("ledger-settle");
    expectOk(s.settle("ledger-settle"));

    expect(s.balance(s.providerToken)).toBe(900_000n * UNITS_PER_VND);
    expect(s.balance(s.communityToken)).toBe(30_000n * UNITS_PER_VND);
    expect(s.balance(s.platformToken)).toBe(70_000n * UNITS_PER_VND);
    expect(s.balance(s.escrow)).toBe(0n);

    const recordAcct = s.account(settlementPdaFromLedgerId("ledger-settle"))!;
    const record = decodeSettlementRecord(recordAcct.data, recordAcct.owner);
    expect(record.providerVnd).toBe(900_000);
    expect(record.communityVnd).toBe(30_000);
    expect(record.platformVnd).toBe(70_000);
    expect(record.providerToken).toBe(s.providerToken.toBase58());
    expect(record.settledBy).toBe(s.coordinator.publicKey.toBase58());

    const treasuryAcct = s.account(treasuryPda())!;
    const treasury = decodeTreasury(treasuryAcct.data, treasuryAcct.owner);
    expect(treasury.settledCount).toBe(1);
    expect(treasury.settledTotalVnd).toBe(1_000_000);
  });

  it("cannot settle the same attestation twice", () => {
    const s = settlementSetup({ escrowVnd: 2n * BOOKING_VND });
    s.finalized("ledger-twice");
    expectOk(s.settle("ledger-twice"));
    expectAlreadyInUse(s.settle("ledger-twice"));
    expect(s.balance(s.providerToken)).toBe(900_000n * UNITS_PER_VND);
  });

  it("cannot settle an attestation the committee has not finalized", () => {
    const s = settlementSetup();
    expectOk(s.submit("ledger-pending", s.coordinator));
    expectAnchorError(s.settle("ledger-pending"), "AccountNotInitialized");
    expect(s.balance(s.escrow)).toBe(BOOKING_VND * UNITS_PER_VND);
  });

  it("cannot settle an attestation that was withdrawn", () => {
    const s = settlementSetup();
    expectOk(s.submit("ledger-withdrawn", s.coordinator));
    expectOk(s.cancel("ledger-withdrawn", s.coordinator));
    expectAnchorError(s.settle("ledger-withdrawn"), "AccountNotInitialized");
  });

  it("refuses a settler without the coordinator role", () => {
    const s = settlementSetup();
    s.finalized("ledger-member-settles");
    expectAnchorError(s.settle("ledger-member-settles", s.member), "Unauthorized");
  });

  it("refuses a Community Fund account the committee vault does not own", () => {
    const s = settlementSetup();
    s.finalized("ledger-fund-redirect");
    // The provider's account offered as the Community Fund destination.
    const res = s.settle("ledger-fund-redirect", s.coordinator, { communityToken: s.providerToken });
    expectAnchorError(res, "InvalidTokenAccount");
  });

  it("refuses a platform account other than the treasury's platform wallet", () => {
    const s = settlementSetup();
    s.finalized("ledger-platform-redirect");
    const res = s.settle("ledger-platform-redirect", s.coordinator, { platformToken: s.providerToken });
    expectAnchorError(res, "InvalidTokenAccount");
  });

  it("refuses an escrow other than the treasury's", () => {
    const s = settlementSetup();
    s.finalized("ledger-other-escrow");
    const res = s.settle("ledger-other-escrow", s.coordinator, { vault: s.platformToken });
    expectAnchorError(res, "InvalidTokenAccount");
  });

  it("refuses a destination holding a different token", () => {
    const s = settlementSetup();
    s.finalized("ledger-other-mint");
    const other = Keypair.generate();
    expectOk(
      s.send(
        "create_mint",
        [
          SystemProgram.createAccount({
            fromPubkey: s.admin.publicKey,
            newAccountPubkey: other.publicKey,
            lamports: Number(s.svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE))),
            space: MINT_SIZE,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMint2Instruction(other.publicKey, DECIMALS, s.admin.publicKey, null),
          buildCreateAtaIdempotentIx(s.admin.publicKey, s.provider.publicKey, other.publicKey),
        ],
        [s.admin, other]
      )
    );
    const res = s.settle("ledger-other-mint", s.coordinator, {
      providerToken: associatedTokenAddress(other.publicKey, s.provider.publicKey),
    });
    expectAnchorError(res, "InvalidMint");
  });

  it("fails as a whole, recording nothing, when escrow cannot cover the split", () => {
    const s = settlementSetup({ escrowVnd: 500_000n });
    s.finalized("ledger-underfunded");
    expect(s.settle("ledger-underfunded")).toBeInstanceOf(FailedTransactionMetadata);
    expect(s.account(settlementPdaFromLedgerId("ledger-underfunded"))).toBeNull();
    expect(s.balance(s.providerToken)).toBe(0n);
    expect(s.balance(s.escrow)).toBe(500_000n * UNITS_PER_VND);
  });

  it("refuses while the program is paused", () => {
    const s = settlementSetup();
    s.finalized("ledger-paused-settle");
    expectOk(s.send("set_paused", [buildSetPausedIx(s.admin.publicKey, true)], [s.admin]));
    expectAnchorError(s.settle("ledger-paused-settle"), "Paused");
  });
});
